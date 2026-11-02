# Review regression verification — 02/11/2026

Changes are in the working tree, no commit/push in this task.

| Review item | Result |
| --- | --- |
| Active parent leave | Teacher status controls blocked, bulk save excludes locked rows, mock and BE reject override |
| Missing report/reward mocks | Facade routes to mock; GV submits, PHT forwards, HT decides; draft privacy and campus rejection tested |
| CSV formula injection | Shared export escapes formula/control prefixes while retaining numeric negatives and CSV quoting |
| VP area localStorage | Removed browser override persistence in real mode; campus assignment uses BE, rights managed at Vai trò & quyền |
| Unlock timezone | Default and submitted deadline both use school time; UTC, Bangkok and Los Angeles tested, including midnight/year end |
| Dead reward form | Removed unreferenced RewardProposalFormPage |
| Retired facilities | Removed owned source, routes, menu, dashboards, permissions and seeds; preserved rooms, food stock, healthcare place-of-exam fields and existing stored data |

Verification after source edits:

- `node scripts/verify.mjs`: VERIFY PASS full; 484 Node tests total across suites, zero failures/skips; lint, format, design/API checks and build passed.
- Six new regression tests cover reward role chain/privacy/validation, mock reports, CSV, school timezone, removed feature entry points and no localStorage VP grants.
- Headless installed Chrome smoke: 9/9 pages opened without runtime errors: HT rewards/quality/rooms/VP assignments; PHT rewards/quality; GV attendance/rewards/daily assessment. Temporary isolated Vite port 5196, demo accounts only. Script/log retained locally under `.git/review-browser.cjs` and `.git/review-browser.log`.
- Existing ImportGoalFileModal ref warning remains; unused route REPORTERS warning also remains. Neither is a failed lint check. Build has dependency deprecation/lottie warnings.
- BE full verification: 729 tests, zero failures/errors/skips; real PostgreSQL containers. See sibling BE plan `BE:docs/plans/active/2026-11-02-review-regressions.md`.

Limits: Chrome checks verify page loading, not every click path. Full role transitions validated at mock-service level. Browser against real BE, APP notification rendering and production deployment were not tested. Development BE remains running its existing bytecode until restart. No production data or user databases reset.

Additional browser observation: React warned about duplicate child key ch_037 in demo attendance. This was not a page crash and is not one of the supplied review defects; demo seed identity consistency remains to investigate. Browser smoke did not assert console-warning absence.
