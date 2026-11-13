# Deep review of the current three-flow code

Reviewed BE 7c90f0a and FE 0c540dc plus their current uncommitted changes. This is a new code state: semesters, school holidays, class ratings, monthly class comments and draft-history support now exist. Earlier missing-screen reports do not describe this state. No product source edits or Git publication performed.

## Findings, ordered by impact

| Priority | Finding | Evidence | Suggested direction |
| --- | --- | --- | --- |
| P1 | Concurrent changes in two classes collide in one campus meal count | Actual service call in two independent PostgreSQL transactions: uk_meal_count_lines, one transaction fails. MealCountServiceImpl:281; MealCount:148–154 | Common aggregate/campus-day coordination across listener, confirm, adjust and initial aggregation, acquired before loading state |
| P2 | School-year shrink leaves existing holiday outside year | PostgreSQL accepts end 15/05 while holiday remains 22–23/05. SchoolYearServiceImpl:161–172 | Revalidate existing holidays before changing year dates |
| P2 | Deleted year's holiday remains in day cache | Database holiday count zero; isSchoolDay still false. SchoolYearServiceImpl:236,475–479 | Correct cache lifecycle/removal; include deletion, rollback and concurrent reload |
| P2 | Class monthly comment accepts outside-year month | September-start class accepts August comment and creates draft. ClassMonthlyCommentServiceImpl:56–72,117–140 | Shared month/year-range validation in get/save/confirm |
| P2 | Parent leave changes are not reconciled on open attendance sheet | Source-confirmed FE AttendancePage:136,174–190,262–266 | Reload authoritative row state on safe signal/failure, preserve other children's drafts |

## Why the meal collision matters

Classroom locks differ, but the pending meal snapshot contains every class of the campus. Both requests can read no pending lines and copy the entire snapshot. Actual audit reproduced duplicate key uk_meal_count_lines. Production MealCountAttendanceListener uses an after-commit REQUIRES_NEW transaction: this class of failure can leave already-saved attendance without its matching meal refresh. The audit controlled reads using a barrier and called the actual update service; it did not simulate the entire HTTP listener delivery chain.

## Other concurrency risks requiring dedicated reproduction

- DailyHealthServiceImpl:105 checks idempotency UUID before insert :148, with a DB unique constraint but no recovery for two simultaneous retries. Sequential retries are covered; simultaneous retries need a same-UUID transaction test. Do not claim this case was executed here.
- AttendanceDayUnlockServiceImpl:120–123 checks then inserts without class locking/one-active-grant constraint. Two HT/PHT requests may create active duplicates; revoking one may leave the other. Source-supported, not reproduced in this review.
- replaceHolidays clears holidayCache before commit. Another transaction may load old committed data and retain it; only the delete-cache variant was runtime-tested here.

## Validation executed

- FE node scripts/verify.mjs: PASS full, 789 tests plus lint/format/design/API/build checks. Includes current staged renames/uncommitted draft components; source not reset or overwritten.
- Three synthetic school/comment tests: 3 assertion failures, 0 infrastructure errors/skips; target/deep-flow-review.log.
- One controlled concurrent-meal test: 1 assertion failure with actual duplicate-key/DataIntegrityViolationException, 0 infrastructure errors/skips; target/meal-concurrency-audit.log.
- These are intentional audit regressions exposing bugs, not a passing BE full gate. No full BE verify was claimed in this review.
- Temporary audit source/compiled classes are removed from test discovery after execution; reproducible source archived in BE .git/DeepFlowAuditTest.java and .git/MealConcurrencyAuditTest.java. Existing dirty test files/SQL/config are preserved. Real application data was not used.

## Recommendation

Prioritize the campus-meal transaction boundary, then holiday lifecycle and monthly comment bounds, then attendance leave reconciliation. Keep the added semester/holiday/monthly-comment screens; these findings require correcting validation/state coordination, not rebuilding the modules. Add the independent concurrency regressions before implementing locks so lock-order changes do not introduce deadlocks. No formula changes or new business rules are implied by this review.
