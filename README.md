# Progress Tracker PWA

A mobile-friendly React app for tracking:
- workouts and weight
- career growth and learning
- LeetCode and interview prep
- UVM / AI experiments / mentor insights
- pool practice and match consistency

It is intentionally dynamic so anyone can adapt it to different goals.

## Core features
- responsive mobile-first UI
- local data storage in the browser
- export / import JSON backups
- weight trend chart
- weekly and monthly goal progress bars
- installable PWA behavior on phones
- no backend required

## Who can use it
This app is not tied to one user. Anyone can open it, set their own goals in **Settings**, and use it for their own progress tracking.

## Quick start
```bash
npm install
npm run dev
```
Then open the local URL shown in the terminal.

## Production build
```bash
npm install
npm run build
```
The production files will be created in the `dist/` folder.

## Publish options
- Netlify
- Vercel
- GitHub Pages
- any static hosting provider

## Notes
- Data is stored in the current browser using localStorage.
- If you switch devices or browsers, export a backup first and then import it on the other device.
- If you publish it publicly, each user keeps their own data in their own browser.

## App-readiness rules (web -> mobile app)
- Build mobile-first UI interactions (touch targets, no hover-only flows).
- Keep business logic in service modules (avoid browser API calls directly in UI components).
- Preserve offline-first behavior for planner, goals, and check-ins.
- Queue local mutations for future cloud sync conflict handling.
- Keep date-based planner state and stable IDs so data can sync across devices.
