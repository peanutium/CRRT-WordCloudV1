export const MAX_WORD_LENGTH = 32;
export const MAX_CLOUD_WORDS = 60;

const ONE_WORD_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}'’\-]*$/u;

export function normalizeAnswer(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("en-US");
}

export function formatDisplayWord(normalized) {
  if (!normalized) return "";
  if (/^[a-z]/.test(normalized)) {
    return normalized.charAt(0).toLocaleUpperCase("en-US") + normalized.slice(1);
  }
  return normalized;
}

export function validateAnswer(rawValue) {
  const normalized = normalizeAnswer(rawValue);

  if (!normalized) {
    return { valid: false, message: "Please enter one word." };
  }

  if (/\s/u.test(normalized)) {
    return { valid: false, message: "Please use just one word, without spaces." };
  }

  if ([...normalized].length > MAX_WORD_LENGTH) {
    return {
      valid: false,
      message: `Please keep your word to ${MAX_WORD_LENGTH} characters or fewer.`,
    };
  }

  if (!ONE_WORD_PATTERN.test(normalized)) {
    return {
      valid: false,
      message: "Please use letters, numbers, apostrophes, or hyphens only.",
    };
  }

  return {
    valid: true,
    normalized,
    label: formatDisplayWord(normalized),
  };
}

export function makeWordKey(normalized) {
  const bytes = new TextEncoder().encode(normalized);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function summarizeWordRecords(rawRecords) {
  const words = Object.values(rawRecords ?? {})
    .filter((record) => {
      return (
        record &&
        typeof record.label === "string" &&
        typeof record.normalized === "string" &&
        Number.isSafeInteger(record.count) &&
        record.count > 0
      );
    })
    .map((record) => ({
      label: record.label,
      normalized: record.normalized,
      count: record.count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    words,
    total: words.reduce((sum, word) => sum + word.count, 0),
    unique: words.length,
  };
}

function estimateTextWidth(label, fontSize) {
  let units = 0;
  for (const character of label) {
    units += /[\u0000-\u00ff]/.test(character) ? 0.59 : 1;
  }
  return Math.max(fontSize, units * fontSize);
}

function overlaps(candidate, placed, gap = 7) {
  return placed.some((item) => {
    return !(
      candidate.right + gap < item.left ||
      candidate.left - gap > item.right ||
      candidate.bottom + gap < item.top ||
      candidate.top - gap > item.bottom
    );
  });
}

export function buildWordLayout(words, width = 900, height = 500) {
  const selected = words.slice(0, MAX_CLOUD_WORDS);
  if (selected.length === 0) return [];

  const maximum = selected[0].count;
  const minimum = selected[selected.length - 1].count;
  const placed = [];
  const padding = 16;

  for (const [index, word] of selected.entries()) {
    const denominator = Math.log1p(maximum) - Math.log1p(minimum);
    const scale = denominator === 0
      ? 0.55
      : (Math.log1p(word.count) - Math.log1p(minimum)) / denominator;
    let fontSize = 20 + scale * 62;
    let didPlace = false;

    for (let shrink = 0; shrink < 4 && !didPlace; shrink += 1) {
      const textWidth = estimateTextWidth(word.label, fontSize);
      const textHeight = fontSize * 1.04;

      for (let step = 0; step < 1050; step += 1) {
        const angle = step * 0.34 + index * 0.61;
        const radius = 2.15 * angle;
        const x = width / 2 + Math.cos(angle) * radius * 1.58;
        const y = height / 2 + Math.sin(angle) * radius;
        const candidate = {
          left: x - textWidth / 2,
          right: x + textWidth / 2,
          top: y - textHeight / 2,
          bottom: y + textHeight / 2,
        };

        const inside =
          candidate.left >= padding &&
          candidate.right <= width - padding &&
          candidate.top >= padding &&
          candidate.bottom <= height - padding;

        if (inside && !overlaps(candidate, placed)) {
          placed.push({
            ...candidate,
            x,
            y,
            fontSize,
            label: word.label,
            count: word.count,
          });
          didPlace = true;
          break;
        }
      }

      fontSize *= 0.86;
    }
  }

  return placed;
}
