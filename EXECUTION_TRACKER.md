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
| Goal intake and plan generation | Convert natural-language goal into editable draft plan | 1 | Not started | Web-first implementation |
| Plan editing and persistence | Category, goals, milestones, action items, safe save | 1 | In progress | Non-destructive handling already started |
| Data safety and migrations | Preserve user data, backup before migration, no overwrite | 1 | In progress | Continue hardening and tests |
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

## 5) Phase 0 Checklist (Current)

- [ ] Final MVP must-have list
- [ ] Final non-goals list
- [ ] Acceptance checklist for each phase
- [ ] Event tracking list for validation
- [ ] Risk list and fallback options

## 6) How We Keep This Updated

At the end of every session:

1. Update the Session Tracker row.
2. Move feature statuses (Not started, In progress, Done).
3. Update phase status if exit criteria changed.
4. Add blockers and next concrete task.

This file is the source of truth for what is done and what is remaining.
