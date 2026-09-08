# CRRT in One Word — AP AKI CRRT 2026

A mobile-first Gala Dinner poll that accepts one free-text word per submission and turns the room's answers into a live word cloud. It also shows the exact cumulative count for every submitted word. Participants may submit as many times as they wish from the same device.

The project is plain HTML, CSS, and JavaScript, with no build step. Firebase Realtime Database stores shared counts and streams updates to every open screen. The included GitHub Actions workflow publishes the `dist` folder to GitHub Pages.

## Features

- One-word validation with Unicode support
- Case and full-width character normalization (`Efficient`, `efficient`, and `ＥＦＦＩＣＩＥＮＴ` count together)
- Atomic cumulative counters for simultaneous submissions
- Live response total, unique-word total, proportional word cloud, and complete ranked tally
- Unlimited submissions per device
- Projector-friendly **Present** button and results-only URL
- Mobile, tablet, desktop, and safe-area responsive styling
- Empty, connecting, reconnecting, preview, success, and error states
- Firebase rules that allow counters to increase by exactly one and prevent edits or decrements

## 1. Create the Firebase database

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. In **Project overview**, add a **Web app**.
3. Open **Build → Realtime Database → Create database**. Choose the region closest to the event and start in locked mode.
4. In **Project settings → Your apps**, copy the web app configuration.
5. Paste those values into `dist/firebase-config.js`. Confirm that `databaseURL` exactly matches the URL on the Realtime Database page.

Firebase's web configuration is included in client-side code by design. Keep administrative credentials and service-account keys out of this repository.

## 2. Publish the database rules

The included rules permit public reading of the poll and only allow a word record to be created with a count of 1 or incremented by exactly 1. Labels and normalized values cannot be changed after creation. Unlimited repeat submissions remain possible, as requested.

### Firebase Console

1. Open **Realtime Database → Rules**.
2. Replace the editor contents with `firebase/database.rules.json`.
3. Click **Publish**.

### Firebase CLI

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc
# Replace YOUR_FIREBASE_PROJECT_ID inside .firebaserc.
firebase deploy --only database
```

## 3. Test locally

The project uses JavaScript modules, so serve it over HTTP rather than opening `index.html` directly:

```bash
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000` in two browser windows. Until you add Firebase configuration, the site runs in clearly labeled preview mode with sample data. Once configured, answers entered in either window appear in both.

Run the automated checks with:

```bash
npm test
```

## 4. Deploy to GitHub Pages

1. Create a GitHub repository and upload this complete project.
2. Commit and push it to the `main` branch.
3. Open **Repository Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. The included `deploy-pages.yml` workflow publishes the `dist` folder. The public URL appears in the workflow summary and Pages settings.

## Presentation view

- Tap **Present** above the word cloud to show the live results full screen.
- Add `?view=results` to the deployed URL to hide the response form on a projector, for example: `https://YOUR-NAME.github.io/YOUR-REPO/?view=results`.
- Keep the ordinary URL or a QR code pointing to it on participants' phones.

## Reset before the Gala Dinner

In **Firebase Console → Realtime Database → Data**, delete this node:

```text
polls/crrtOneWord/words
```

The total, cloud, and tally return to zero on every open screen. This operation permanently removes the current poll results, so export them first if you need a record.

## Data structure

```text
polls/
  crrtOneWord/
    words/
      <safe-normalized-word-key>/
        label: "Precise"
        normalized: "precise"
        count: 12
```

The total response number is calculated by summing the word counters, avoiding a single global counter bottleneck.

## Notes for event use

- Test the venue Wi-Fi and mobile data path before the dinner.
- Rehearse with at least two phones and the projector computer.
- Because repeat answers are intentionally unlimited, this is an audience-engagement poll rather than a controlled one-person-one-vote survey.
- Public client-side polls cannot fully prevent scripted repeat submissions. Firebase App Check or a small trusted server can be added later if abuse resistance is required.

## Project map

- `dist/` — complete public website
- `dist/firebase-config.js` — paste the Firebase Web app configuration here
- `firebase/database.rules.json` — database permissions and counter validation
- `.github/workflows/deploy-pages.yml` — automatic GitHub Pages deployment
- `tests/` — normalization, validation, aggregation, key-safety, and layout checks

Copyright: AP AKI CRRT 2026. CC-BY-NC.
