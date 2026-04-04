# Revisit Prompt

Use this prompt later when you want to continue improving this project:

---
I have a React PWA called "NextStride" — a personal progress tracker and AI-style coach that helps users build discipline and consistency across career, health, learning, and habit goals. It uses localStorage, has export/import JSON backups, mobile-friendly UI, and is published as a static web app.

Please help me continue building it.

## Current app state (as of 2026-04-04, Session 26):

### What's live and working:
- Goal intake guided planner (natural-language → structured categories/goals/milestones/actions)
- Plan edit and persistence with safe migration (no data overwrite on update)
- Dashboard with NBA card, encouragement engine (19 rules), weekly check calendar, daily streak
- 8 themes with luminance-based auto-contrast hero text
- Welcome popup (once/day, streak ring + stats) + random wisdom quote popup (50 curated)
- Roadmap tab and Progress tab (both category-aware)
- Journal entry tab
- Full event instrumentation (10 analytics events, localStorage-capped)
- Phase 1 + Phase 2 exit criteria verified
- **Weekly scheduling engine (Session 26)**:
  - `weeklyScheduleService.js` distributes goals Mon–Sun with timed tasks
  - Task status tracking (planned/completed/missed/rescheduled)
  - Deadline shifts: +1 day per missed task, logged in `goalDeadlineLog`
  - Carryover tasks for incomplete work
  - Accountability messages by performance tier
  - `WeeklyPlanView.jsx` — Mon–Sun grid, checkboxes, alarm toggles, deadline stats
  - `alarmService.js` — Notification API integration with fallback
  - "Weekly Schedule" sub-tab in Goals view wired and tested

### Next immediate work (Session L):
- Phase 3 auth: Supabase sign up, sign in, sign out
- Cloud sync: store/retrieve user data per account
- Guest-to-account merge: preserve local data on sign-up

### Working rules:
1. Preserve existing features unless I ask otherwise
2. Provide production-safe code
3. Keep the UI clean and mobile-friendly
4. Run npm run build and npm test to validate before calling a session done
5. Update EXECUTION_TRACKER.md session row at end of each session

### Key product direction:
- Reduce decision fatigue: the app tells users what to do, when to do it
- Pre-planned weekly schedules with alarms so users "look at the clock and execute"
- Missed tasks = deadline pushes — accountability builds discipline
- End goal: calm 24x7 AI coach that guides users conversationally and reduces manual entry
- Build schedule-aware recommendations in Phase 3 using working/non-working day profile

### Source of truth files:
- `EXECUTION_TRACKER.md` — phase status, session log, feature tracker, checkpoints
- `src/services/weeklyScheduleService.js` — core scheduling + accountability engine
- `src/services/alarmService.js` — bracket notification system
- `src/components/WeeklyPlanView.jsx` — weekly plan UI
---
