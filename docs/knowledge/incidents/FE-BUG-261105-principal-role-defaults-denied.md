---
id: FE-BUG-261105-principal-role-defaults-denied
type: bug
screens: [school-roles]
be_modules: [identity-access]
rules: []
status: open
date: 2026-11-05
keywords: [principal, permission, access denied, gateway]
similar_to: [FE-BUG-261102-real-ui-permission-scope]
---

# Principal cannot load role defaults in local gateway

## Symptom
Local principal demo opens `/school/roles` from the available menu. The page shell loads but displays `Bạn không có quyền xem dữ liệu này` and `Bạn không có quyền thực hiện thao tác này`. Staff accounts and principal school-year actions load in the same session.

## Điều kiện tái hiện
Real BE on localhost:8080, FE localhost:5173 with gateway auth. Sign in as the supplied principal demo account, open role defaults. No real personal data or credentials are needed in the incident.

## Attempts
| # | Cách thử | Kết quả |
| --- | --- | --- |
| 1 | Open role defaults after principal login | Page shows both access-denied messages |
| 2 | Open staff accounts, then revisit role defaults | Staff loads; role defaults still denied |

## Root cause
Chưa rõ. Need inspect actual endpoint authorization and running BE version versus the checked-out source. No HTTP status inferred solely from UI text.

## Fix
Not applied. Propose a cross-module investigation of gateway effective permissions and the role-defaults endpoint.

## Regression test
Pending: principal can read role defaults according to the approved authorization contract; non-authorized actors remain denied.

## Ảnh hưởng
Principal cannot inspect or configure role defaults through the current local runtime. No permissions were changed during the test.
