---
title: Remove facility features from CareNest Web
status: approved
owner: DinhCan
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [facility, facility-transfer, inventory-inspection]
rules: []
risk: high
created: 2026-11-02
updated: 2026-11-02
---
# Remove facility features from CareNest Web

## Context

User requested removing every facility-management feature on 02/11/2026. This is source removal, not only FACILITY_ENABLED=false. BE PROJECT_CONTEXT.md excludes asset lifecycle, inspection, transfer and incident reporting. BE has no corresponding facility/inspection/asset source controllers in the current checkout.

## Decisions already authorized

- Remove facility incidents, supply requests, procurement/repair proposals, assets, transfers and inventory inspections from Web.
- Keep school configuration rooms, campus assignment and room capacity; these are school structure, not asset management.
- Preserve the pending attendance/leave and child-assessment repair task; this removal does not replace it.
- Do not reset databases, erase browser storage, rewrite old migrations, or modify APP.
- Do not commit or push in this task without a separate current instruction.

## Proposed implementation

| Option | Effect |
| --- | --- |
| Remove owned source and every live integration (recommended) | No feature can reappear through a flag; remove dependencies after checking shared callers |
| Keep source and only hide screens | Current behavior; does not satisfy user request |

### Phase 1 — user-facing entry points and integrations

Remove facility lazy imports/routes from src/routes/AppRoutes.jsx; remove menu groups and quick actions. Remove dashboard widgets, approval rows/counters, descriptions, notification links, role/permission demo entries and search entries tied to facility. Legacy /facility URLs use the existing not-found behavior. Do not redirect asset links into school rooms.

### Phase 2 — owned implementation and dependencies

Remove exclusively owned pages/components/hooks/models/services/utils/styles under facility, facility-transfer and inventory-inspection. Remove FacilityTasksWidget and exclusively owned asset visuals/models after checking imports. Remove module registry entries only after removing their API facades. Remove facility mock seeds and initialization from the mock database without deleting other demo data. Do not treat src/assets (brand, illustrations, Lottie) as an asset-management directory. Remove retired-source assertions from tests; add coverage that menu, routes, approvals and notifications expose no facility links. Preserve tests for shared behavior.

### Phase 3 — current documentation and validation

Update active architecture/route maps and feature registry to reflect removal. Preserve historical incident/release/decision documents as history, not active features. Verify every deleted path is within the FE checkout. Check unresolved imports, unsupported facility links and shared school-room behavior. Run node scripts/check-ai-layer.mjs and node scripts/verify.mjs; report real results.

## Acceptance criteria

- AC1: all roles have no facility menu, quick action, dashboard tile or approval task.
- AC2: direct facility URLs no longer render retired screens.
- AC3: room/campus configuration and teacher assignment still work.
- AC4: no remaining source import calls a deleted facility module.
- AC5: unrelated illustrations, kitchen food inventory, nutrition and school rooms remain intact.
- AC6: FE verification and AI-layer validation pass; no existing user data is deleted.

## Risks and rollback

Shared master-data and demo notification helpers currently import asset/facility source. Inventory callers before deleting; remove only facility branches. Kitchen food stock is not facility inventory. Keep historical documents with their original context. Changes remain reviewable in git diff; never use reset --hard or blanket restore.

## Review gate

User approved removal and regression verification in the latest request on 02/11/2026.

## Progress log

- 02/11/2026: inventoried menu, routes, dashboards, approval descriptions, module registry and demo permission entries. Initial inventory recorded before implementation. BE inventory found no facility controller to remove.

- 02/11/2026: removed retired routes, menu, dashboard, owned source and demo seeds; kept school rooms, healthcare place-of-exam fields and kitchen food stock. Restored formatting-only and unrelated healthcare edits detected during diff review. Full verification in progress.
