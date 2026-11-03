---
id: FE-BUG-261102-demo-child-ticket-identity
type: bug
screens: [attendance, assessment-rewards]
be_modules: [attendance, observation]
rules: []
status: fixed
date: 2026-11-02
keywords: [ch_037, duplicate key, weeklyTickets, schoolYear, demo]
similar_to: [BUG-261102-review-regressions]
---
# Duplicate demo child and missing reward ticket counts

## Symptom
Fresh seed produced 414 rows but 413 unique child IDs. Reward detail reported zero weekly tickets with one source ticket. Duplicate attendance rows shared draft state because both used ch_037.

## Root cause
School seed appended an explicit clinical sample ch_037 after generating the same ID. Reward count required ticket.schoolYear even though makeTicket stores classId and period dates only.

## Fix
Fresh seed substitutes the explicit clinical sample for the generated child at that ID. Existing demo data keeps the first row (matching old find-by-id behavior), archives duplicate rows in demoIdentityConflicts and removes their duplicate active-list entries. No localStorage reset or unrelated data removal. Migration is idempotent.

Ticket count matches class and configured school-year period boundaries, including legacy tickets without schoolYear. No API schema changes.

## Attempts and regression
Before fix: three new FE tests failed in .git/pre-pr-red.log. After fix: nine focused regression tests passed in .git/pre-pr-green.log. Test coverage includes fresh seed uniqueness, conflict archival, preservation of unrelated values, repeated migration, weekly/monthly tickets, wrong class and previous-year exclusion. Full verification and browser results tracked in docs/quality/2026-11-02-pre-pr-flow-review.md.
