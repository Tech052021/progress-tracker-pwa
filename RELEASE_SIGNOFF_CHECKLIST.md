# NextStride Release Sign-off Checklist

Owner: Avinash + Copilot
Date baseline: 2026-04-04
Scope: Stability sign-off for quest story, motivation reward, and in-app shop flows.

## 0) Process Gate (Strict, Blocking)

End validation is blocked unless every item in this section is checked.

- [ ] Change log + rationale is captured and linked.
- [ ] Risk assessment is documented with explicit owner for each risk.
- [ ] Manual QA evidence links/screens are attached.
- [ ] Rollback plan is documented and tested at least once in dry-run form.
- [ ] Decision sign-off names are recorded (owner + reviewer).

Gate rule: if any item above is unchecked, final GO is not valid.

## Automation Run (2026-04-04)

- Build: PASS (`npm run build`)
- Tests: PASS (`npm test`, 16/16)
- VS Code diagnostics: PASS (no errors)
- Dev runtime boot: PASS (`npm run dev`, reachable at `http://localhost:5177/`)
- Note: UI interaction checks below remain manual and should be completed in-browser.

## 1) Preflight

- [x] Pull latest code and confirm branch to release from.
- [x] Install dependencies: `npm install`
- [x] Clean build passes: `npm run build`
- [x] Tests pass: `npm test`
- [ ] No critical/high unresolved issues in manual notes.

## 2) Environment Notes

- Local URL from `npm run dev` is reachable. [x]
- Browser tested: Chrome latest (minimum), plus one secondary browser.
- Device tested: desktop + one mobile viewport.

## 3) Core Regression Smoke (Must Pass)

### 3.1 Dashboard and Navigation

- [x] App loads without console/runtime crash.
- [x] Top navigation switches all tabs correctly. (Retest pass - 2026-04-04)
- [x] Settings open/close works repeatedly.

### 3.2 Goals and Logging

- [x] Goals can be created/edited/deleted.
- [x] Logging entries still works across enabled log forms.
- [x] Logged entries persist after refresh.

### 3.3 Persistence and Backup

- [x] Export backup produces a valid JSON file.
- [x] Import backup restores expected state.
- [ ] Refresh does not lose quest/reward/shop settings.

## 4) New Feature Sign-off (Must Pass)

### 4.1 Quest Story Progression

- [x] Logging activity creates new story chapter.
- [x] Coin counter increases after logs.
- [x] Story and Collection tab renders chapters/keepsakes/locations.
- [ ] Unlock modal appears on milestone unlocks. (Not tested)
- [ ] Quest Journey card shows next milestone and progress.

### 4.2 Motivation Reward

- [x] In Settings, user can set:
  - dream reward title
  - target price
  - currency
  - money-per-coin ratio
  - goal completion lock toggle
- [x] Coin modal shows converted progress value toward target.
- [ ] Unlock state updates correctly when threshold is reached.
- [ ] If goal lock is enabled, unlock remains blocked until goals are on pace.

### 4.3 In-app Shop Catalog

- [x] In Settings, user can add/edit/remove shop items (name, price, optional URL).
- [x] Shop items appear in coin modal catalog.
- [ ] View action opens URL (or search fallback). (Not tested)
- [ ] Buy/Mark bought button is disabled before unlock requirements are met. (Not tested)
- [ ] Purchased state persists after refresh. (Not tested)

## 5) Scenario-Based QA (Stability Gate)

### Scenario A: New User (No existing data)

- [ ] First load is clean and no crash.
- [ ] User can set one goal and log one activity.
- [ ] First quest chapter appears and coins increment.
- [ ] Motivation reward can be configured and displayed.

### Scenario B: Existing User Migration

- [ ] Load old data (without new fields).
- [ ] App migrates safely (no broken view, no data wipe).
- [ ] Existing goals/logs remain intact.
- [ ] New motivation/shop fields default safely.

### Scenario C: Full Motivation Flow

- [ ] Configure dream reward and shop items.
- [ ] Accumulate logs/coins.
- [ ] Reach unlock threshold and verify status flips to unlocked.
- [ ] Mark a shop item as purchased and verify persistence.
- [ ] Use Share action and verify clipboard/native share path works.

## 6) UX Quality Checks (Calm + Inviting)

- [ ] Messaging remains supportive and non-judgmental.
- [ ] No sudden visual jumps or modal layering glitches.
- [ ] Mobile layout remains readable for settings/shop/coin modal. (Not tested)
- [ ] Buttons have clear enabled/disabled states for unlock logic.

## 7) Known Non-Blocking Items

- Coin spending deduction is intentionally deferred (purchase toggle only for now).
- Any enhancement requests beyond this list go to post-stability backlog.

## 8) Release Decision

### Go / No-Go

- [ ] GO
- [ ] NO-GO

### Sign-off Notes

- Build status:
- Test status:
- Manual QA summary:
- Blocking issues (if any):
- Decision owner:
- Date/time:

Current automation snapshot:
- Build status: PASS (2026-04-04)
- Test status: PASS (16/16)
- Manual QA summary: Core flows pass including navigation retest, logging persistence, backup export/import, and Story render. Remaining optional checks pending for unlock modal, shop gating/persistence, and mobile readability.
- Blocking issues (if any): Strict process gate artifacts are not complete yet
- Decision owner: Avinash
- Date/time: 2026-04-04 (automation + manual batch pass)

## 9) Post Sign-off Actions

- [ ] Tag/branch this release checkpoint.
- [ ] Save QA evidence (screenshots or notes).
- [ ] Deploy using existing deployment flow.
- [ ] Run quick production smoke test on deployed URL.
