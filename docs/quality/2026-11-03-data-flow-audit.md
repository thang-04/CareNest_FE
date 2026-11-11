# Data flow audit — 03/11/2026

Reviewed local BE bbe4895 and FE d1232c1 in D:/FULearning/Fall2026. Read-only product review, no API/business changes, commits or PR updates. Synthetic tests use isolated PostgreSQL containers, not the user's application database. Earlier technical PRs do not resolve the business-history findings below.

## Result

Not ready to claim that all three flows preserve and display data correctly across class/year transitions. Core source rows survive in the audited cases, but several read models hide or mix them. Ordinary child placement/withdrawal also remains demo-only on FE.

| Area | Evidence | Outcome |
| --- | --- | --- |
| New school year | YearTransitionIntegrationTest, 13 cases | Passing activation, readiness, age/capacity, historical room snapshot and old/new enrollment dates |
| School-year lifecycle | SchoolYearServiceIntegrationTest, 6 cases | Passed |
| Attendance/health | AttendanceIntegrationTest, 15 cases | Passed repeated-save history, closed-year read-only, lock/unlock, health after cutoff |
| Meal confirmation | MealCountIntegrationTest, 7 cases | Passed incomplete attendance guard, confirmed counts, reconfirmation and substitute preservation |
| Concurrent daily assessment/leave | ConcurrentDailyAssessmentIntegrationTest, 1 case | Passed real concurrent transactions |
| FE related suites | selective-merge, hardening, dashboard | 148 passed, 0 failed/skipped; mocked adapters/storage, not browser-to-real-BE end-to-end |
| Transfer assessment audit | SQL count after flush/clear is 2; old-class summary returns 2 instead of 1 | Source data retained, class-specific aggregation incorrect |
| Withdrawn profile audit | SQL count after flush/clear is 1; range encloses complete enrollment | DEVELOPMENT_CHILD_NO_CLASS despite stored data |
| Historical attendance summary audit | A attendance row retained; child leaves A before selected range ends | Child omitted from A summary; 1 assertion failure, 0 errors/skips |

Batch BE audit: 44 tests, 42 passed, 1 assertion failure, 1 error, 0 skipped. Log: ../CareNest_BE/target/flow-data-audit-20261103.log. Temporary audit fixture extends existing synthetic DailyAssessmentIntegrationTest setup and is removed afterward. Flush/clear tests demonstrate database round-trip within the test transaction, not durability after production restart.

## Confirmed findings

1. **High — ordinary child transfer/withdrawal is demo-only.** integrationModules.js children.source is demo; childrenService placeChild/withdrawChild choose the mock repository. Proposed childrenApi placement endpoints have no ordinary corresponding BE implementation. New-year placement is a separate real API and must not be confused with this screen.
2. **High — class-specific assessments mix another class's attendance.** EvaluationSources.load reads child/date across classes but projects against one class's lessons. Reproduced after A to B transfer; see BE BUG-261102-assessment-history-scope.
3. **Medium — profile fails for enrollment wholly inside selected range.** ChildEvaluationServiceImpl.development resolves class only at range endpoints. Source attendance is present in PostgreSQL; lookup still rejects.
4. **Medium — new teacher cannot open old confirmed assessment detail.** Existing DailyAssessmentIntegrationTest explicitly expects EVALUATION_VIEW_FORBIDDEN for teacher B opening teacher A's result. This preserves original class authorization but does not fulfill the user's request for read-only longitudinal child history. A scoped child-history read path is needed, without old-class edit rights.
5. **Medium — historical ticket summaries use today's roster.** BehaviourTicketServiceImpl.getSummary selects children at today's clamped date, and board uses period-end roster. Static review: departed/transferred children can disappear from historical views; not yet runtime-tested in this audit.
6. **High — historical attendance/meal summary omits transferred children.** AttendanceServiceImpl.summarize builds the roster only at range end, then queries only those IDs. Reproduced: SQL still holds A's attendance, but A's September summary contains only the other child after transfer to B. See BE BUG-261103-attendance-summary-history and target/attendance-history-audit-20261103.log. This affects report totals; it does not prove confirmed kitchen meal-count records were modified.

## Coverage gaps and unresolved decisions

- Year transition implementation is transactional, but tests do not inject a failure between year activation and enrollment flush, then verify rollback through an independent transaction. No concurrent activation/config edit test or full browser-to-real-BE transfer E2E found.
- Current source keeps enrollment dates and child IDs when transitioning years; this alone does not prove every historical screen is correct.
- Weekly/semester independent periodic assessments are absent from BE MONTH/YEAR evaluation types. Profile range filters are not persisted semester assessments.
- Profile rewards are not returned in DevelopmentResponse; stored approved reward and UI profile are not fully linked.
- Chuyen-can denominator for entering/leaving mid-month, report eligible tickets versus issued tickets, and school total deduplication across classes remain decisions to confirm. No formula changed here; keep Be ngoan/Be ngoan toan dien behavior as requested.
- Real health bridge still returns no parent contacts and notification is a no-op; App is outside this review.

## Recommended order

First repair class/date source selection and historical roster reads with failing regressions retained. Then add child-scoped read-only history access, finish ordinary child enrollment/transfer/withdrawal API integration, and add commit/rollback plus real FE-to-BE transition tests. Confirm pending calculation definitions before changing formulas. Existing technical PR test results must not be used as proof these business gaps are fixed.
