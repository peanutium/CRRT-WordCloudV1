import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getDatabase,
  onValue,
  ref,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  MAX_CLOUD_WORDS,
  buildWordLayout,
  makeWordKey,
  summarizeWordRecords,
  validateAnswer,
} from "./poll-utils.js";

const POLL_PATH = "polls/crrtOneWord/words";
const CLOUD_WIDTH = 900;
const CLOUD_HEIGHT = 500;
const SVG_NS = "http://www.w3.org/2000/svg";
const CLOUD_COLORS = ["#ffffff", "#75e6ff", "#ff86ce", "#b9c8ff", "#8ff0c2", "#ffd47a"];
const DEMO_RECORDS = {
  efficient: { label: "Efficient", normalized: "efficient", count: 12 },
  lifesaving: { label: "Lifesaving", normalized: "lifesaving", count: 10 },
  precise: { label: "Precise", normalized: "precise", count: 8 },
  complex: { label: "Complex", normalized: "complex", count: 6 },
  continuous: { label: "Continuous", normalized: "continuous", count: 5 },
  essential: { label: "Essential", normalized: "essential", count: 4 },
};

const answerForm = document.querySelector("#answerForm");
const answerInput = document.querySelector("#answerInput");
const answerLength = document.querySelector("#answerLength");
const submitButton = document.querySelector("#submitButton");
const formMessage = document.querySelector("#formMessage");
const setupNotice = document.querySelector("#setupNotice");
const connectionPill = document.querySelector("#connectionPill");
const connectionText = document.querySelector("#connectionText");
const totalResponses = document.querySelector("#totalResponses");
const responseLabel = document.querySelector("#responseLabel");
const uniqueWords = document.querySelector("#uniqueWords");
const cloudSvg = document.querySelector("#wordCloud");
const cloudEmpty = document.querySelector("#cloudEmpty");
const cloudNote = document.querySelector("#cloudNote");
const tallyList = document.querySelector("#tallyList");
const tallyEmpty = document.querySelector("#tallyEmpty");
const resultsPanel = document.querySelector("#resultsPanel");
const presentButton = document.querySelector("#presentButton");
const liveSummary = document.querySelector("#liveSummary");

let database;
let isConnected = false;
let isSubmitting = false;
let isDemoMode = false;
let currentRecords = {};

function hasValidConfig(config) {
  const requiredKeys = ["apiKey", "databaseURL", "projectId", "appId"];
  return requiredKeys.every((key) => {
    const value = config[key];
    return typeof value === "string" && value.length > 0 && !value.includes("REPLACE_WITH");
  });
}

function setConnectionState(state, text) {
  connectionPill.dataset.state = state;
  connectionText.textContent = text;
}

function setMessage(text, kind = "neutral") {
  formMessage.textContent = text;
  formMessage.dataset.kind = kind;
}

function refreshSubmitState() {
  submitButton.disabled = isSubmitting || (!isDemoMode && !isConnected);
  answerInput.disabled = isSubmitting;
}

function clearSvgWords() {
  cloudSvg.querySelectorAll("text[data-cloud-word]").forEach((element) => element.remove());
}

function renderCloud(words) {
  clearSvgWords();
  cloudEmpty.hidden = words.length > 0;
  cloudSvg.hidden = words.length === 0;

  if (words.length === 0) return;

  const layout = buildWordLayout(words, CLOUD_WIDTH, CLOUD_HEIGHT);
  for (const [index, word] of layout.entries()) {
    const textElement = document.createElementNS(SVG_NS, "text");
    textElement.dataset.cloudWord = "true";
    textElement.setAttribute("x", word.x.toFixed(1));
    textElement.setAttribute("y", word.y.toFixed(1));
    textElement.setAttribute("font-size", word.fontSize.toFixed(1));
    textElement.setAttribute("font-weight", index < 4 ? "780" : "650");
    textElement.setAttribute("fill", CLOUD_COLORS[index % CLOUD_COLORS.length]);
    textElement.setAttribute("text-anchor", "middle");
    textElement.setAttribute("dominant-baseline", "central");
    textElement.setAttribute("aria-label", `${word.label}: ${word.count}`);
    textElement.textContent = word.label;
    cloudSvg.append(textElement);
  }
}

function renderTally(words) {
  tallyList.replaceChildren();
  tallyEmpty.hidden = words.length > 0;
  tallyList.hidden = words.length === 0;
  if (words.length === 0) return;

  const maximum = words[0].count;
  for (const [index, word] of words.entries()) {
    const row = document.createElement("li");
    row.className = "tally-row";

    const rank = document.createElement("span");
    rank.className = "tally-rank";
    rank.textContent = String(index + 1).padStart(2, "0");

    const details = document.createElement("div");
    details.className = "tally-details";

    const labelLine = document.createElement("div");
    labelLine.className = "tally-label-line";

    const label = document.createElement("span");
    label.className = "tally-label";
    label.textContent = word.label;

    const count = document.createElement("span");
    count.className = "tally-count";
    count.textContent = word.count.toLocaleString();
    count.setAttribute("aria-label", `${word.count} ${word.count === 1 ? "response" : "responses"}`);

    const track = document.createElement("span");
    track.className = "tally-track";
    track.setAttribute("aria-hidden", "true");

    const fill = document.createElement("span");
    fill.className = "tally-fill";
    fill.style.width = `${Math.max(4, (word.count / maximum) * 100)}%`;

    track.append(fill);
    labelLine.append(label, count);
    details.append(labelLine, track);
    row.append(rank, details);
    tallyList.append(row);
  }
}

function renderResults(rawRecords) {
  currentRecords = rawRecords ?? {};
  const { words, total, unique } = summarizeWordRecords(currentRecords);

  totalResponses.textContent = total.toLocaleString();
  responseLabel.textContent = total === 1 ? "response" : "responses";
  uniqueWords.textContent = unique.toLocaleString();
  cloudNote.textContent = words.length > MAX_CLOUD_WORDS
    ? `Showing the top ${MAX_CLOUD_WORDS} words. Every answer is included in the tally.`
    : "Word size reflects how often it was submitted.";
  liveSummary.textContent = `${total} ${total === 1 ? "response" : "responses"}, ${unique} unique ${unique === 1 ? "word" : "words"}.`;

  renderCloud(words);
  renderTally(words);
}

function addDemoAnswer(answer) {
  const key = makeWordKey(answer.normalized);
  const existing = currentRecords[key];
  currentRecords = {
    ...currentRecords,
    [key]: existing
      ? { ...existing, count: existing.count + 1 }
      : { label: answer.label, normalized: answer.normalized, count: 1 },
  };
  renderResults(currentRecords);
}

async function saveLiveAnswer(answer) {
  const wordRef = ref(database, `${POLL_PATH}/${makeWordKey(answer.normalized)}`);
  let keyMismatch = false;
  const result = await runTransaction(wordRef, (currentValue) => {
    if (!currentValue) {
      return { label: answer.label, normalized: answer.normalized, count: 1 };
    }

    if (currentValue.normalized !== answer.normalized) {
      keyMismatch = true;
      return;
    }

    const currentCount = Number(currentValue.count);
    return {
      label: currentValue.label,
      normalized: currentValue.normalized,
      count: Number.isSafeInteger(currentCount) && currentCount > 0 ? currentCount + 1 : 1,
    };
  });

  if (keyMismatch || !result.committed) {
    throw new Error("The answer could not be committed.");
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const answer = validateAnswer(answerInput.value);

  if (!answer.valid) {
    setMessage(answer.message, "error");
    answerInput.focus();
    return;
  }

  if (!isDemoMode && (!database || !isConnected)) {
    setMessage("The live poll is reconnecting. Please try again in a moment.", "error");
    return;
  }

  isSubmitting = true;
  submitButton.querySelector("span").textContent = "Submitting…";
  setMessage("");
  refreshSubmitState();

  try {
    if (isDemoMode) {
      addDemoAnswer(answer);
      setMessage("Added to this preview. Connect Firebase to share results across devices.", "success");
    } else {
      await saveLiveAnswer(answer);
      setMessage("Your word is in the cloud. Thank you!", "success");
    }

    answerForm.reset();
    answerLength.textContent = "0 / 32";
    resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Answer submission failed:", error);
    setMessage("Your answer was not submitted. Check the connection and try again.", "error");
  } finally {
    isSubmitting = false;
    submitButton.querySelector("span").textContent = "Add my word";
    refreshSubmitState();
  }
}

function startPreviewMode() {
  isDemoMode = true;
  currentRecords = { ...DEMO_RECORDS };
  setupNotice.hidden = false;
  setConnectionState("preview", "Preview mode");
  renderResults(currentRecords);
  refreshSubmitState();
}

function startLivePoll() {
  if (!hasValidConfig(firebaseConfig)) {
    startPreviewMode();
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    database = getDatabase(app);

    onValue(
      ref(database, POLL_PATH),
      (snapshot) => renderResults(snapshot.val()),
      (error) => {
        console.error("Results listener failed:", error);
        setConnectionState("offline", "Results unavailable");
      },
    );

    onValue(ref(database, ".info/connected"), (snapshot) => {
      isConnected = snapshot.val() === true;
      setConnectionState(isConnected ? "live" : "offline", isConnected ? "Room live" : "Reconnecting…");
      refreshSubmitState();
    });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    startPreviewMode();
  }
}

async function togglePresentation() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await resultsPanel.requestFullscreen();
    }
  } catch (error) {
    console.error("Fullscreen mode is unavailable:", error);
  }
}

answerInput.addEventListener("input", () => {
  const length = [...answerInput.value].length;
  answerLength.textContent = `${length} / 32`;
  setMessage("");
});

answerForm.addEventListener("submit", handleSubmit);
presentButton.addEventListener("click", togglePresentation);

document.addEventListener("fullscreenchange", () => {
  presentButton.querySelector("span").textContent = document.fullscreenElement ? "Exit" : "Present";
});

if (!document.fullscreenEnabled) presentButton.hidden = true;
if (new URLSearchParams(window.location.search).get("view") === "results") {
  document.body.classList.add("results-only");
}

renderResults(null);
startLivePoll();
