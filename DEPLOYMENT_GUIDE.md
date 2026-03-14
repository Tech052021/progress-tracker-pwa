# Deployment Guide

## 1. What is this app?
This is a React web app. You run it locally on your computer, or publish it to the web so you and others can use it from a browser.

## 2. Install Node.js
Install the current LTS version of Node.js from the official website.
After installing, open a terminal and check:

```bash
node -v
npm -v
```

## 3. Run the app locally
Open a terminal in the project folder and run:

```bash
npm install
npm run dev
```

Vite will show a local address, usually something like:

```bash
http://localhost:5173/
```

Open that in your browser.

## 4. Build for production
```bash
npm install
npm run build
```

This creates a `dist` folder.

## 5. Publish to Netlify
### Option A: drag and drop
1. Create a Netlify account.
2. Run `npm run build`.
3. Open Netlify.
4. Drag the `dist` folder into Netlify's deploy page.
5. Netlify will give you a public URL.

### Option B: connect GitHub
1. Put the project in a GitHub repo.
2. Connect the repo to Netlify.
3. Build command: `npm run build`
4. Publish directory: `dist`

## 6. Publish to Vercel
1. Create a Vercel account.
2. Import the project from GitHub.
3. Framework preset: Vite
4. Build command: `npm run build`
5. Output directory: `dist`

## 7. Use on your phone
After publishing:
1. Open the public URL on your phone.
2. In Chrome on Android, tap the browser menu and choose **Add to Home screen**.
3. In Safari on iPhone, tap Share and choose **Add to Home Screen**.
4. The app can now open like an installed app.

## 8. Share with other people
Yes. If you publish it publicly, anyone with the link can use it.
Each person keeps their own data in their own browser.

## 9. Important limitation
Because this version has no backend or login, data does **not** automatically sync across devices.
Use the built-in export/import backup feature if you want to move data from one device to another.

## 10. Best next upgrade if you want multi-device sync
Add one of these later:
- Firebase
- Supabase
- your own backend API

That would let users create accounts and sync data across phone and desktop.
