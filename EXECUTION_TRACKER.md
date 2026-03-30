# NextStride Execution Tracker

Owner: Avinash + Copilot
Plan start date: 2026-03-30
Cadence: 2 hours per day
Tracking rule: A phase is done only when all exit criteria are validated.

## 1) Timeline and Phase Status

| Phase | Dates | Focus | Status | Exit Criteria |
|---|---|---|---|---|
| Phase 0 | 2026-03-30 to 2026-03-31 | Scope lock + metrics + acceptance tests | In progress | MVP scope approved, non-goals locked, acceptance checklist finalized |
| Phase 1 | 2026-04-01 to 2026-04-10 | Core web MVP (plan -> edit -> track) | Not started | User can create/edit/track plan end-to-end without data loss |
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
| Baseline and check-ins | Before/after reference timeline per goal | 2 | Not started | Needed for meaningful analysis and motivation |
| Encouragement engine | Trigger messages from progress + consistency + baseline | 2 | Not started | Positive tone only, anti-spam limits |
| Notification preferences | Channel and timing controls | 2 | Not started | UI first, sending later |
| Authentication | Sign up, sign in, sign out, session handling | 3 | Not started | Supabase-first path |
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

1. Session E (2h): Add baseline/check-in schema draft for outcome tracking.
2. Session F (2h): Connect generated plans to evidence-based encouragement rules.
3. Session G (2h): Add event instrumentation for planner creation, apply, and regenerate flows.

## 12) How We Keep This Updated

At the end of every session:

1. Update the Session Tracker row.
2. Move feature statuses (Not started, In progress, Done).
3. Update phase status if exit criteria changed.
4. Add blockers and next concrete task.

This file is the source of truth for what is done and what is remaining.
