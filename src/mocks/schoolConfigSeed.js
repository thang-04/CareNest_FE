import { AGE_GROUPS } from '@/models/School';
import { CONFIG_ROLES } from '@/models/school-config/schoolConfigConstants';
import { defaultGrants } from '@/models/school-config/permissionCatalog';

/*
 * Demo data of the school-config module (fictional). Collections:
 * schoolYears, ageGroups, cutoffSettings, vpAssignments, teamLeaderAssignments, rolePermissions.
 * The repository seeds them lazily (db.x ||= clone(seed.x)).
 */

const AGE_GROUP_EXTRA = {
  'ag-2': { ageRange: '24–36 tháng', mealsPerDay: 3, nutritionNote: 'Bữa chính, bữa phụ chiều và bữa phụ sáng; cháo/cơm nát.' },
  'ag-3': { ageRange: '3–4 tuổi', mealsPerDay: 2, nutritionNote: 'Bữa trưa và bữa phụ chiều.' },
  'ag-4': { ageRange: '4–5 tuổi', mealsPerDay: 2, nutritionNote: 'Bữa trưa và bữa phụ chiều.' },
  'ag-5': { ageRange: '5–6 tuổi', mealsPerDay: 2, nutritionNote: 'Bữa trưa và bữa phụ chiều.' },
};

const at = (date) => `${date}T08:00:00.000Z`;

export const buildSeedSchoolConfig = () => ({
  schoolYears: [
    {
      id: '2026-2027',
      name: '2026-2027',
      startDate: '2026-09-05',
      endDate: '2027-05-31',
      status: 'ACTIVE',
      history: [
        { action: 'CREATED', userId: 'u_hung', at: at('2026-07-15') },
        { action: 'ACTIVATED', userId: 'u_hung', at: at('2026-08-20') },
      ],
    },
    {
      id: '2025-2026',
      name: '2025-2026',
      startDate: '2025-09-05',
      endDate: '2026-05-31',
      status: 'CLOSED',
      history: [
        { action: 'CREATED', userId: 'u_hung', at: at('2025-07-10') },
        { action: 'ACTIVATED', userId: 'u_hung', at: at('2025-08-20') },
        { action: 'CLOSED', userId: 'u_hung', at: at('2026-06-01') },
      ],
    },
  ],
  ageGroups: AGE_GROUPS.map((g) => ({ ...g, ...AGE_GROUP_EXTRA[g.id] })),
  cutoffSettings: [
    {
      schoolYear: '2026-2027',
      time: '08:45',
      effectiveFrom: '2026-09-05',
      updatedBy: 'u_hung',
      updatedAt: at('2026-08-25'),
      history: [{ time: '08:45', effectiveFrom: '2026-09-05', previousTime: null, userId: 'u_hung', at: at('2026-08-25') }],
    },
  ],
  vpAssignments: [
    {
      id: 'vpa_1',
      schoolYear: '2026-2027',
      userId: 'u_lan',
      campusId: 'c1',
      sharedService: true,
      assignedBy: 'u_hung',
      assignedAt: at('2026-08-22'),
    },
    {
      id: 'vpa_2',
      schoolYear: '2026-2027',
      userId: 'u_duc',
      campusId: 'c2',
      sharedService: false,
      assignedBy: 'u_hung',
      assignedAt: at('2026-08-22'),
    },
  ],
  teamLeaderAssignments: [
    {
      id: 'tla_1',
      schoolYear: '2026-2027',
      campusId: 'c1',
      ageGroupId: 'ag-4',
      userId: 'u_ha',
      assignedBy: 'u_lan',
      assignedAt: at('2026-08-28'),
    },
  ],
  rolePermissions: CONFIG_ROLES.map((role) => ({ role, grants: defaultGrants(role), history: [] })),
});
