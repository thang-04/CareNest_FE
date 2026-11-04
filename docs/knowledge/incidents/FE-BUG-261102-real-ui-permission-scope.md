---
id: FE-BUG-261102-real-ui-permission-scope
type: bug
screens: [school-rooms, teacher-assignment, auth]
be_modules: [organization, identity]
rules: [AUTH-20]
status: partial
date: 2026-11-02
keywords: [Keycloak, bePermissions, withPermissions, roomCampusIds, campus, 403]
similar_to: []
---
# Real API sessions still use demo-derived UI permission scope

## Symptom and root cause
Keycloak dev path authService.js:32–55 reads accounts/me but uses withPermissions from mock data and does not retain bePermissions like the gateway path. Teacher-assignment UI then falls back to role defaults even after a BE permission is revoked. No demonstrated server authorization bypass: BE still rejects forbidden requests.

PHT room view also filters both-campus BE results through demo roomCampusIds/VIEW_RESTRICTED. Runtime probe for campus c1 with c1/c2 available returns only c1. RoomListPage.jsx:49/:171/:262; BE RoomServiceImpl allows all-campus reads per AUTH-20.

## Review and proposed fix
Confirmed by read-only school configuration reviewer and local helper probe. Use effective BE permissions/read scope for real sessions; retain demo grants only in demo mode, keeping mutation authorization on BE. No product edits or full verification in this review. Detailed comparison: docs/quality/2026-11-02-business-flow-comparison.md.

## Fix 2026-11-03 (uncommitted, branch feature/G94-179-FE-FEAT-42-school-config-api)
schoolConfigPermissions.areaAccess: for a BE session (user.bePermissions present) a Vice Principal gets VIEW on all campuses for rooms and year placement (writes stay Principal-only on BE), and the staff screen follows ACCOUNT_MANAGE / ACCOUNT_STATUS_MANAGE / STAFF_ASSIGNMENT_MANAGE / PERMISSION_MANAGE instead of mock areas. Demo login unchanged. Test: tests/menu/vp-be-areas.test.mjs (2 of 3 fail before, pass after).
Not done: the Keycloak dev path in authService.js still does not keep bePermissions (shared auth file, needs its owner), so this fix applies to gateway sessions only.

## Remaining assignment read gap, 03/11/2026
AUTH-20 permits an actively assigned PHT to read all-campus configuration. teacherAssignAccess at schoolConfigPermissions.js:149–169 instead requires STAFF_ASSIGNMENT_MANAGE for read and restricts PHT to own campus; AppRoutes.jsx uses canOpenTeacherAssignment as route guard. Node probe: bePermissions=[] cannot open; write permission still cannot view c2 from c1. Both return false, although TeacherAssignmentServiceImpl.getTeacherAssignments invokes checkCanViewSchool and supports all campuses. Separate reading from writing. No demonstrated server privilege bypass; gateway room/year-placement fixes remain intact.
