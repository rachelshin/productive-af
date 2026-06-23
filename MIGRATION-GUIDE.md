# LG Dashboard → hosted web app (Firebase + Netlify)

Goal: move the dashboard off browser-only `localStorage` and onto Firebase
Firestore, behind a login, hosted on Netlify — so your data is durable, backed
up, and synced live between your computer and your phone. The app's UI does not
change. Only the storage layer is swapped.

You'll do the account setup in the browser (Parts A, D, E). The code is already
written for you (`firebase-sync.js`, `firestore.rules`) — Part B is the only
edit to `index.html`, and you can hand that to Claude Code (Part C) instead of
doing it by hand.

---

## What's in this package

| File | What it is |
|---|---|
| `firebase-sync.js` | Drop-in module: Firebase init, login gate, and a `store` object that replaces `localStorage` with Firestore (local cache + live sync). |
| `firestore.rules` | Security rules that lock all data to your signed-in account. |
| `MIGRATION-GUIDE.md` | This file. |

---

## Part A — Create the Firebase project (~5 min, browser)

1. Go to the Firebase console and **Add project** (any name, e.g. `lg-dashboard`). Google Analytics is optional — you can skip it.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Authentication → Users → Add user.** Create your login (email + a strong password). This is the only account that will be able to see the data.
4. **Build → Firestore Database → Create database.** Start in **production mode** (rules below will secure it), pick a region close to you.
5. **Firestore → Rules tab.** Replace what's there with the contents of `firestore.rules`, then **Publish**.
6. **Project settings (gear icon) → General → Your apps → Web app (`</>`).** Register the app, and copy the `firebaseConfig` object it shows you.

> The `apiKey` in that config is **not a secret** — it's a public identifier. Your data is protected by the login + the rules you just published, not by hiding the key. So it's fine that it sits in the page source.

---

## Part B — Wire the code into `index.html`

Five small edits. (Or skip to **Part C** and let Claude Code do them.)

**1. Paste your config.** In `firebase-sync.js`, replace the `PASTE_ME`
placeholders in `firebaseConfig` with the values from Part A step 6.

**2. Load Firebase + the module.** In `index.html`, just before `</head>`, add:

```html
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
```

Then add the sync module **after the main app `<script>` block** (right before
`</body>`). Either link it:

```html
<script src="firebase-sync.js"></script>
```

…or paste the whole contents of `firebase-sync.js` inline inside a
`<script>…</script>` tag there (keeps the app a single self-contained file).

**3. Swap `localStorage` → `store` in the four storage functions.** These are
the only data-access points. Change the object name only; everything else stays:

| Function | Find | Replace with |
|---|---|---|
| `loadConsulting` | `localStorage.getItem(consultingKey())` | `store.getItem(consultingKey())` |
| `saveConsulting` | `localStorage.setItem(consultingKey(),JSON.stringify(consulting))` | `store.setItem(consultingKey(),JSON.stringify(consulting))` |
| `loadCreator` | `localStorage.getItem(storageKey())` | `store.getItem(storageKey())` |
| `saveCreator` | `localStorage.setItem(storageKey(),JSON.stringify({clips:clips,nextId:nextId}))` | `store.setItem(storageKey(),JSON.stringify({clips:clips,nextId:nextId}))` |

**4. Make Import sync to the cloud.** In `importData`, change the two
`localStorage.setItem(...)` lines (the `'lg-v8-'+k` and `'lg-consulting-'+k`
ones) to `store.setItem(...)`. (Leave `exportData` as-is — reading the local
cache is fine.)

**5. Remove the old boot line.** At the very end of the main app `<script>`,
delete (or comment out) the line:

```js
loadCreator();loadConsulting();render();
```

`firebase-sync.js` now runs this for you **after** you log in.

---

## Part C — Or hand it to Claude Code

Open the project in Claude Code and paste this:

> I have a single-file HTML app (`index.html`) that currently persists all data
> in `localStorage`. I'm migrating it to Firebase Firestore with email/password
> auth, using the provided `firebase-sync.js` (which exposes a global `store`
> with the same API as localStorage) and `firestore.rules`.
>
> Please make exactly these changes to `index.html`:
> 1. Add the three Firebase 10.12.2 compat SDK `<script>` tags before `</head>`
>    (app, auth, firestore).
> 2. Inline the full contents of `firebase-sync.js` in a `<script>` block right
>    before `</body>`, after the existing main app script.
> 3. In the functions `loadConsulting`, `saveConsulting`, `loadCreator`,
>    `saveCreator`, and `importData`, replace `localStorage` with `store`
>    (getItem/setItem only — do not touch any other logic).
> 4. Remove the final boot line `loadCreator();loadConsulting();render();` at the
>    end of the main app script — `firebase-sync.js` handles boot after login.
>
> Do not change any UI, rendering, or business logic. After editing, run the app
> locally, confirm the login overlay appears, sign in with my test user, and
> verify that adding a clip writes a document under `users/{uid}/kv/` in
> Firestore and that it reloads correctly after a refresh.

Then paste your `firebaseConfig` into the inlined module.

---

## Part D — Move your existing data over

`localStorage` is per-website, so the data living in your current Artifact will
**not** appear automatically on the Netlify site. Carry it across with the app's
built-in backup:

1. In the **current** dashboard (the Artifact), use **Export** to download the
   `lg-dashboard-backup-YYYY-MM-DD.json` file.
2. Open the **new** hosted site (Part E) and sign in.
3. Use **Import** and choose that JSON file. Because Import now writes through
   `store`, every clip, timer, and invoice is pushed straight up to Firestore.
4. Refresh, and confirm everything is there. From now on it syncs automatically.

---

## Part E — Deploy to Netlify

Same as your other apps:

- **Drag-and-drop:** zip the folder (must contain `index.html`, and
  `firebase-sync.js` if you linked it rather than inlined it) and drop it on the
  Netlify "Deploy" area; **or**
- **Git:** push the folder to a repo and connect it in Netlify. No build command
  is needed — it's a static site, publish directory is the project root.

After it deploys, open the Netlify URL on your computer **and** your phone, sign
in on both, and confirm an edit on one shows up on the other.

> **Auth domain note:** if sign-in is ever rejected on the live URL, add your
> Netlify domain under Firebase console → Authentication → Settings →
> **Authorized domains**.

---

## Notes on cost & safety

- **Free tier is plenty** for this: Firestore's no-cost plan allows ~50k reads
  and ~20k writes per day and 1 GB stored — far beyond a personal tracker.
- **Backups:** Firestore keeps your data server-side, but for true point-in-time
  backups keep using the app's **Export** button occasionally, or enable managed
  backups in Google Cloud later if this becomes critical.
- **Privacy:** with the rules in `firestore.rules` published and Email/Password
  as the only sign-in method, the data is reachable only by your account. Keep
  the password strong and don't add other sign-in providers unless you mean to.
