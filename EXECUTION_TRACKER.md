# NextStride Execution Tracker

Owner: Avinash + Copilot
Plan start date: 2026-03-30
Cadence: 2 hours per day
Tracking rule: A phase is done only when all exit criteria are validated.

## 1) Timeline and Phase Status

| Phase | Dates | Focus | Status | Exit Criteria |
|---|---|---|---|---|
| Phase 0 | 2026-03-30 to 2026-03-31 | Scope lock + metrics + acceptance tests | Completed | MVP scope approved, non-goals locked, acceptance checklist finalized |
| Phase 1 | 2026-04-01 to 2026-04-10 | Core web MVP (plan -> edit -> track) | In progress | User can create/edit/track plan end-to-end without data loss |
| Phase 2 | 2026-04-11 to 2026-04-16 | Motivation loop (in-app encouragement) | Not started | Evidence-based messages and weekly reflection working |
| Phase 3 | 2026-04-17 to 2026-04-26 | Account + cloud sync (web first) | Not started | Auth, sync, guest merge and conflict-safe behavior validated |
| Phase 4 | 2026-04-27 to 2026-04-30 | Stabilization + private access readiness | Not started | Critical paths stable and private access checklist passed |

## 2) Delivery Dates

- Private access target: 2026-04-30
- Public beta target: 2026-05-14
- Production target: 2026-05-28

## 3) Feature Work Tracker

| Feature Area | Scope | Phase | Status | Notes |
|---|---|---|---|---|
| Goal intake and plan generation | Convert natural-language goal into editable draft plan | 1 | In progress | Session A+B+C+D complete: guided planner, realism checks, live preview, regenerate flow, richer goal generation, tested draft replacement helpers |
| Plan editing and persistence | Category, goals, milestones, action items, safe save | 1 | In progress | Draft-generation logic extracted into pure helpers and covered by automated non-destructive tests |
| Data safety and migrations | Preserve user data, backup before migration, no overwrite | 1 | In progress | Planner metadata stripping and replace-vs-append flows now covered by tests |
| IA and interaction refinement | Remove clutter, simplify navigation, one-pane workflow | 1 | In progress | Added top-level tabs, moved roadmap/progress to single-pane sub-tabs, removed duplicate in-page navigation, improved touch workflows |
| Goal progress UX | Let users update goal progress directly from goals view | 1 | In progress | Added inline "Add progress" on goal cards and integrated manual updates into progress counting |
| Category-scoped analysis | Ensure roadmap/progress are category-aware and understandable | 1 | In progress | Added category tabs and category-based filtering for roadmap and progress views |
| Baseline and check-ins | Before/after reference timeline per goal | 2 | In progress | `createdAt` baseline on new goals; weekly check-in card with 1-5 rating + notes live on dashboard; needs check-in history view in progress tab |
| Encouragement engine | Trigger messages from progress + consistency + baseline | 2 | Partially done | Welcome popup, motivational quote splash, and NBA card deliver early motivation layer; evidence-based context-aware messages still pending |
| Theming and auto-contrast | Luminance-based hero text color and brand-grad-hero cards | 1 | Done | Auto-contrast keeps text readable on all 8 themes |
| Welcome and quote popups | Temu-style welcome splash + random wisdom quote splash | 1 | Done | Welcome: once/day + after new work; Quote: 50 attributed quotes, random each open, user-dismissed |
| Journal entry | Renamed AI form to Journal with reflection-focused prompts | 1 | Done | Bucket accepts 'journal', 'journey', or legacy 'ai' entries |
| Notification preferences | Channel and timing controls | 2 | Not started | UI first, sending later |
| Event instrumentation | Track all 10 MVP analytics events locally | 1 | Done | localStorage-based trackEvent with 500-event cap; all 10 events from Section 9 instrumented |
| Authentication | Sign up, sign in, sign out, session handling | 3 | Not started | Supabase-first path. **Must capture schedule profile during onboarding (see Section 14 design note)** |
| Schedule-aware recommendations | Use working/non-working day schedule to surface context-aware Next Best Actions | 3 | Not started | Schedule data collected at account creation; drives daily action suggestions and pacing |
| Cloud sync | Per-user data sync and offline-safe behavior | 3 | Not started | Include conflict-safe merge |
| Guest-to-account merge | Keep local data when user signs in | 3 | Not started | Must be non-destructive |
| Beta hardening | Performance, reliability, bug triage | 4 | Not started | Gate for private access |

## 4) Session Tracker (Daily)

Use this format every work session.

| Date | Planned (2h) | Done | Validation | Blockers | Next Session |
|---|---|---|---|---|---|
| 2026-03-29 | Define phases, dates, execution model, and tracker | Created plan and tracker structure | N/A (planning) | None | Start Phase 0 checklist |
| 2026-03-29 (Session 2) | Lock MVP scope, non-goals, acceptance criteria, and risks | Drafted complete Phase 0 scope pack below | Internal review complete | None | Begin Phase 1 Day 1 implementation |
| 2026-03-29 (Session 3) | Build goal-intake entry point and structured form | Added "Build plan from goal" modal and draft generation into editable categories/goals/milestones/actions | npm run build passed | None | Session B: improve mapping quality and add regenerate controls |
| 2026-03-29 (Session 4) | Improve mapping quality and add regenerate controls | Added smarter plan blueprints for language/career goals and safe regenerate-last-draft flow before Apply | npm run build passed | None | Session C: add plan preview and better validation |
| 2026-03-29 (Session 5) | Redesign planner around guided category creation and realism checks | Added structured planner fields (current state, target, unit, timeline, constraints), gentle feasibility feedback, and richer weight-goal generation | npm run build passed | None | Session C: add lightweight plan preview before final generation |
| 2026-03-29 (Session 6) | Add lightweight plan preview before final generation | Added live draft preview in planner modal showing generated category, goals, milestones, and first action steps before insertion | npm run build passed | None | Session D: add non-destructive persistence tests for generated drafts |
| 2026-03-29 (Session 7) | Add non-destructive persistence tests for generated drafts | Extracted planner draft mutation logic into pure helpers and added automated tests for metadata stripping, append preservation, and replace-only-generated behavior | npm test and npm run build passed | None | Session E: add baseline/check-in schema draft for outcome tracking |
| 2026-03-29 (Session 8) | Stabilize nested modal sizing and scroll behavior | Implemented layered modal architecture where active popup owns scroll, child popup size is dynamically computed from parent modal bounds, and extracted reusable `useLayeredModalSizing` hook for future popups | npm run build passed | None | Reuse hook for any future nested popup before adding custom modal CSS |
| 2026-03-29 (Session 9) | Start Session E baseline/check-in schema | Session E was intentionally paused to prioritize urgent UX/IA issues raised during review | npm run build passed | Scope interruption: user-directed pivot to UI clarity before schema work | Rework information architecture without losing existing settings functionality |
| 2026-03-29 (Session 10) | Simplify app IA and declutter main workflows | Added clearer top navigation and separated Goals, Roadmap, Progress, Log concerns | npm run build passed | Regression risk: earlier over-simplification hid prior settings work and required restoration | Restore complete SettingsEditor behind Settings and preserve all existing planner capabilities |
| 2026-03-29 (Session 11) | Stabilize modal behavior and reduce accidental exits | Enforced explicit-button close behavior (no backdrop dismiss) and continued nested modal fixes | npm run build passed | Interruption: repeated nested-scroll/overlay issues consumed planned implementation time | Consolidate one-scroll-per-view behavior and remove split screens |
| 2026-03-29 (Session 12) | Improve goals/readability and move roadmap concerns | Introduced dedicated Roadmap tab and removed roadmap/history from Goals main view | npm run build passed | IA churn required multiple layout iterations before user acceptance | Convert Progress and Roadmap to single-pane sub-tab flows |
| 2026-03-29 (Session 13) | Reduce clutter and duplicate navigation controls | Removed duplicate roadmap/analytics actions from Goals; kept top-header tabs as source of navigation truth | npm run build passed | Navigation duplication previously caused confusion and noisy UI | Make progress and roadmap category-aware |
| 2026-03-29 (Session 14) | Make roadmap/progress category-aware and fix data mismatch | Added category tabs + filtering in roadmap/progress and corrected goal-progress data source from legacy fixed rows to live goal data | npm run build passed | Mapping ambiguity for old roadmap items without explicit category metadata | Add explicit category metadata to new generated milestones/actions and keep fallback inference for legacy data |
| 2026-03-29 (Session 15) | Remove nested scrollbars and split-screen behavior | Fixed roadmap nested scroll and converted log to single-pane top-subtab flow | npm run build passed | Visual consistency interruptions from proportional/tab styling and mobile readability | Refine tab proportions and maintain touch-friendly controls |
| 2026-03-29 (Session 16) | Close key goals UX gap | Added inline goal progress update controls in Goals cards; persisted manual updates and included them in counting logic | npm run build passed | This work was unplanned but required to meet "update progress in goals" requirement | Verify end-to-end counts for bucket-based and manual progress updates |
| 2026-03-30 (Session 17) | Goals UX stabilization + responsive polish + data correctness fixes | Added weekly check calendar UX (including compact ordinal date labels), unified goal-row layout across goal types, simplified category tabs, improved mobile responsiveness, fixed deleted-category progress reuse, and removed implicit legacy bucket carryover so recreated goals start clean | Multiple npm run build validations passed across checkpoints | Scope still drifting from Session E baseline/check-in due to repeated UI refinement loops | Freeze UI changes and resume Session E baseline/check-in schema wiring |
| 2026-03-30 (Session 18) | Category tabs visual distinction and tab/content separation | Added top border (2px #e2e8f0) and increased spacing between category tabs and goals content for clear visual hierarchy | npm run build passed (25.03 kB CSS, 212.57 kB JS gzipped, 1.06s build time) | None | Ready for checkpoint and Session E-Resume | 
| 2026-03-30/31 (Session 19) | Dashboard UX polish and motivation layer | Auto-contrast theming (luminance-based hero text), brand-grad-hero on all cards, moved NBA above greeting, Today box full-width fix, Temu-style welcome splash popup (streak + stats + quote), removed hero card from dashboard, AI→Journal rename, smart welcome popup frequency (once/day + after new work), motivational quote splash popup with 50 attributed wisdom quotes (random each open, user-dismissed) | npm run build passed at each checkpoint | Execution drift: UI polish consumed planned Session E time | Freeze UI; begin Session E-Resume baseline/check-in schema |
| 2026-03-31 (Session 21 / F) | Event instrumentation for all 10 planned analytics events | Built `trackEvent` utility (localStorage-based, capped at 500 events). Instrumented: plan_created, goal_added, goal_deleted, settings_applied in SettingsEditor; log_added, export_used, import_used, encouragement_shown, streak_updated in App.jsx. Passed trackEvent as prop to SettingsEditor. | npm run build passed | None | Session G: encouragement rules |
| 2026-04-01 (Session 22 / G) | Encouragement rules engine | Built priority-based encouragement engine via `useMemo` evaluating 12 data signals (streak milestones, daily target, goal proximity, category completion, check-in sentiment, weekly trend, milestone counts, onboarding). Renders top-priority message in a new full-width dashboard card between NBA and This Week. Tracks `encouragement_shown` with card type via `useEffect`. Added `.dash-encouragement-card` CSS with brand-grad-hero background. | npm run build passed | None | Session H: check-in history + baseline comparison |
| 2026-03-31 (Session 23 / H) | Check-in history view + baseline comparison | Added "Check-in history" sub-tab in Progress tab showing all past weekly check-ins (rating, notes, snapshot stats). Added baseline row on non-milestone goal cards showing creation date and days active. | npm run build passed | None | Session I: Phase 1 exit validation |
| 2026-03-31 (Session 24 / I) | Phase 1 exit validation | Fixed critical category overwrite bug in `deriveCategories()` — now preserves stored categories when import data is empty. Added try-catch on localStorage writes. Improved all empty-state messages to be actionable with inline CTAs. | npm run build passed | None | Session J: Phase 2 exit validation |
| 2026-03-31 (Session 25 / J) | Phase 2 exit validation | Audited all 19 encouragement rules, 50+ quotes, all empty states, achievement hints, and check-in prompts for tone. Added neutral check-in rating (3) encouragement message. All Phase 2 criteria pass: context-aware messaging, auto-rendering weekly reflection, 100% positive non-judgmental tone. | npm run build passed | None | Phase 3: accounts and sync |

### Execution Drift Summary (2026-03-29)

1. Planned path after Session 8 was Session E (baseline/check-ins), but execution shifted heavily into UX/IA stabilization.
2. Primary interruption cause: repeated user-requested UI pivots to improve readability, reduce clutter, and remove split-screen patterns.
3. Secondary interruption cause: nested modal and nested scroll ownership issues requiring multiple correction passes.
4. Result: substantial Phase 1 UI/interaction progress delivered; Phase 2 baseline/check-in and encouragement work deferred.
5. Recovery action: freeze current IA for at least one session and resume deferred Session E schema work before new major UI changes.

## 5) Phase 0 Checklist (Current)

- [x] Final MVP must-have list
- [x] Final non-goals list
- [x] Acceptance checklist for each phase
- [x] Event tracking list for validation
- [x] Risk list and fallback options

## 6) MVP Must-Haves (Locked)

1. User can create and edit categories and goals.
2. User can create and edit short-term milestones and action items.
3. User can log activity consistently from dashboard/category log flows.
4. User can see progress and momentum on dashboard cards.
5. User can set flexible frequency terms (day/week/month/year/hour/minute/target).
6. User data is preserved across app updates and migrations.
7. User can export/import backup JSON.
8. Settings language is intuitive and easy for non-native English users.

## 7) Non-Goals For MVP (Locked)

1. Full AI coach conversation and autonomous planning.
2. Medical or academic outcome guarantees.
3. Native app store release in MVP window.
4. Full multi-channel messaging delivery (email/SMS/push) in MVP window.
5. Team/collaborative goals.

## 8) Phase Acceptance Criteria (Locked)

### Phase 1: Core web MVP

1. A user can create plan -> edit plan -> track plan in one session.
2. Page refresh keeps all user changes.
3. Update/migration does not overwrite user-owned categories/goals.
4. Empty-state and onboarding are understandable.

### Phase 2: Motivation loop

1. In-app messages are context-aware (progress, streak, consistency).
2. Weekly reflection summary renders without manual setup.
3. Messaging tone remains positive and non-judgmental.

### Phase 3: Account and sync

1. User can sign up, sign in, sign out.
2. Data sync works across two devices for same account.
3. Guest-to-account merge keeps local data non-destructively.

### Phase 4: Stabilization

1. Critical user paths pass smoke tests.
2. No unresolved critical/high bugs.
3. Private access checklist passed.

## 9) Event Tracking Plan (MVP Analytics)

1. plan_created
2. plan_edited
3. goal_added
4. goal_deleted
5. log_added
6. settings_applied
7. export_used
8. import_used
9. encouragement_shown
10. streak_updated

## 10) Risk Register and Fallbacks

1. Risk: Data loss in migration.
Fallback: Pre-migration backup + versioned normalization + rollback path.

2. Risk: Scope creep delays timeline.
Fallback: Freeze MVP scope and defer non-goals to post-MVP.

3. Risk: Auth/sync complexity overruns Phase 3.
Fallback: Keep local-first mode default and release private access with local + backup if needed.

4. Risk: Notification infra delays motivation feature.
Fallback: Keep motivation in-app first, defer external channel delivery.

## 11) Next 3 Sessions (Concrete)

1. Session K (2h): Phase 3 kickoff — auth provider setup (sign up, sign in, sign out).
2. Session L (2h): Cloud data sync — store/retrieve user data across devices.
3. Session M (2h): Guest-to-account merge — preserve local data when signing up.

## 12) Restart Checkpoint (2026-03-31, Session 19)

Use this as the exact restart point for the next work block.

1. Branch state at checkpoint: `main` pushed to origin.
2. Working tree at checkpoint (Session 19 final):
	- Modified: `src/App.jsx` — auto-contrast hero text tokens, welcome splash popup (once/day + after new work), motivational quote splash (50 random attributed quotes, user-dismissed), AI→Journal rename, NBA above greeting, hero card removed
	- Modified: `src/styles.css` — brand-grad-hero on all cards, hero-text tokens on collapse sections, welcome-overlay/popup CSS, quote-overlay/popup/author CSS
	- Modified: `src/components/themes.js` — `_getHeroTextColors()` luminance helper, `--hero-text` / `--hero-text-muted` tokens
	- Modified: `EXECUTION_TRACKER.md`
3. Functional state locked:
	- All 8 themes auto-compute readable text colors via HSL lightness analysis.
	- Dashboard order: NBA → Encouragement → This Week → Today → Goals (no hero card).
	- Welcome popup shows once per day or after logging new work (streak ring + stats + fixed quote).
	- Quote popup shows every other open with a random wisdom quote from 50 curated entries; dismissed by tap/click only.
	- Journal entry replaces AI entry (bucket: journal).
4. Scope freeze for restart:
	- No new UI/UX/theme work until Session E-Resume baseline/check-in schema is complete.
5. First task when resuming:
	- Start with Session E-Resume from Section 11.

## 13) How We Keep This Updated

At the end of every session:

1. Update the Session Tracker row.
2. Move feature statuses (Not started, In progress, Done).
3. Update phase status if exit criteria changed.
4. Add blockers and next concrete task.

This file is the source of truth for what is done and what is remaining.

## 14) Design Decisions (Future Implementation Notes)

### Schedule-Aware Recommendations (Phase 3 — Account Creation)

**Decision (2026-03-30):** The "Next Best Action" card on the dashboard should be schedule-aware, not just data-aware.

**Problem it solves:**
Suggesting a 45-minute career block on a Sunday is unhelpful. Suggesting a workout on a work-from-home day is different from an office day. Without knowing the user's week shape, recommendations are blind to context.

**What to capture during account creation (onboarding step):**
- Working days (e.g. Mon–Fri) vs non-working days (Sat–Sun)
- Typical available time per day type (e.g. 60 min on workdays, 2 hr on weekends)
- Optional: early morning / evening preference
- Optional: any fixed blocked days (travel, recurring commitments)

**How to use it:**
- On working days: surface career/learning goals first
- On non-working days: surface health/hobby goals first
- Account for available time when choosing which goal to recommend (don't suggest a 2-hour task on a 30-min day)
- Feed this schedule context into the encouragement engine (Phase 2 G) and the pacing calculations

**Schema shape (draft, to be finalized in Phase 3):**
```json
{
  "schedule": {
    "workingDays": ["mon", "tue", "wed", "thu", "fri"],
    "availableMinutes": { "workday": 60, "offday": 120 },
    "preferredTime": "evening"
  }
}
```

**Implementation gate:** Do not implement custom logic for this before account creation (Phase 3). For MVP local-first mode, treat every day equally. Mark this as Phase 3 dependency when wiring the NBA algorithm in Session F.
