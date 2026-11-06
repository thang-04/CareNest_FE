# Review of current uncommitted BE/FE repairs — 03/11/2026

Scope: school configuration, attendance/meals and child assessment. Reviewed D:/FULearning/Fall2026/CareNest_BE and CareNest_FE working trees, not only committed bbe4895/d1232c1. Many new uncommitted external changes are present. No product edits, commits, pushes or PR changes made by this review. Earlier audit reports describe older source and must not be read as the status of these repairs.

## Verification executed

- BE: `mvnw.cmd test -Dtest=AttendanceHistoryIntegrationTest,AssessmentHistoryIntegrationTest,DailyAssessmentIntegrationTest,AttendanceIntegrationTest,MealCountIntegrationTest,LeaveRequestIntegrationTest,ResponseContractTest`: 62 passed, 0 failures/errors/skips. Log ../CareNest_BE/target/review-current-20261103.log.
- FE: `node --import ./scripts/register-auth-test-loader.mjs --test tests/menu/*.test.mjs tests/dashboard/*.test.mjs tests/integration/selective-merge/*.test.mjs`: 192 passed, 0 failures/skips. Log .git/review-current-20261103.log.
- Read-only independent review confirms remaining code paths below. It did not execute extra tests.
- This is targeted verification, not full verify or live-browser E2E for all three roles. No claim of independent commit/rollback/restart durability testing.

## Previously reproduced issues now addressed in current code

Attendance summaries use historical stays and count missing children only on their enrollment days. Assessment sources are now class-scoped for class-specific evaluation. Development profile uses overlapping enrollment instead of only range endpoints. Ticket summary and overview use historical roster overlap. The six new history tests pass. These improvements do not cover every history read path below.

## Remaining findings

### High: longitudinal profile resolves the wrong class's lessons

BE EvaluationSources.java:76 and :112–118: loadTimeline includes daily activity results across classes, but approved lessons are loaded only with the final cls.id. AssessmentResultProjection uses those day/activity targets to map goals, and the goal-name map also comes from that final class. A child moving A to B can lose old-class goal results or receive the wrong projection/name in the longitudinal view. Resolve lesson/goal projection by each result's source classroom and date. Confirmed by source path; a dedicated cross-class lesson regression has not been executed in this review.

### Medium: assessment list flag counts still combine classes

BE ChildEvaluationServiceImpl.java:866–872 accepts an allowed set of child/class pairs but stores matching flags under child ID only. toRows at :778–780 counts that combined map for each evaluation. If one list contains A and B evaluations for the same child/month, both can receive the union of their flags. Preserve the class key through storage and counting. Static confirmed; current new history tests do not cover this scenario.

### Medium: historical ticket board still uses period-end membership

BE BehaviourTicketServiceImpl.java:400–401 still selects children at period end. The newly repaired summary/overview use rosterDuring, but boardRows/issue call childrenOf. A child who left during the period can remain in summary while disappearing from the historical board. Separate historical issued-ticket visibility from any policy for new issuance. Test an existing issued ticket before transfer; do not silently change eligibility rules.

### Medium: ticket flags and attendance lack class scope

BE BehaviourTicketServiceImpl.java:410–420 reads attendance and observations by child/date across classes. Summary calls it via flagCounts at :435–439 although issued tickets themselves are correctly class-filtered at :192. Class A's summary can therefore include class B's flags for the same transferred child. For class-specific statistics pass classroom identity through reads. ticketsOf and weeklyTicketCounts are also unscoped: determine explicitly which counts should follow the child and which belong to a class before changing eligibility or duplicate prevention.

### Medium: receiving teacher still cannot open old confirmed evaluation

BE ChildEvaluationServiceImpl.java:145–153 permits detail only to the evaluation's original-class teacher or the campus leader. development at :447 returns old confirmed records and FE ChildDevelopmentProfilePage.jsx:25 links to the detail route. A newly assigned teacher can see a historical row but get 403 opening it. Add a child-scoped read-only history access path; do not grant old-class editing rights. Existing DailyAssessmentIntegrationTest explicitly expects the old prohibition and needs a new requirement-specific test.

### High integration gap: ordinary child transfer/withdrawal remains demo-only

FE integrationModules.js:117–121 children.source remains demo; childrenService.js placeChild/withdrawChild still dispatch to mock storage. Next-year placement is a separate real BE flow. Ordinary transfer/withdrawal must be connected to agreed BE APIs before UI save success can mean production database persistence.

## Still unresolved, not silently changed

- QualityReportServiceImpl.java:215–224 uses classroom school-day count as the denominator for every child. Join/leave midmonth treatment needs the agreed definition before formula changes; Be ngoan/Be ngoan toan dien must retain the approved behavior.
- Role completeness is not established by menu/unit tests. Receiving-teacher history is a demonstrated broken path; test GV/PHT/HT through real APIs after repair. School-year transaction rollback injection/concurrency and full transition E2E remain coverage gaps from the earlier audit.
- Parent contacts/notification remain an incomplete real-health bridge. App implementation is outside this review.

## Recommendation

Keep the successful repairs. Add focused regressions for cross-class lessons, per-class flags, historical issued-ticket board and receiving-teacher read access, then repair the proven paths. Complete ordinary transfer/withdrawal API integration separately. Re-run full verification and role-based real-API smoke before calling the entire business flow complete.
