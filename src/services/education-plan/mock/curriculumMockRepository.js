import { AGE_GROUPS as SCHOOL_AGE_GROUPS } from '@/models/School';
import { AGE_GROUPS as CONFIGURED_AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { delay } from '@/mocks/mockDatabase';
import { CURRICULUM_SEED as seed } from '@/mocks/curriculumSeed';
import { eduError } from './eduMockErrors';

/*
 * BE giả của danh mục Chương trình GDMN (BE:EDU-28): cùng dữ liệu V31 (sinh từ VBHN 01/VBHN-BGDĐT), chỉ đọc.
 * Nhóm tuổi theo mã UI ("ag-3"); id mục tiêu theo thứ tự seed.
 */
const curriculumAge = (code) => {
  const group = (CONFIGURED_AGE_GROUPS.length ? CONFIGURED_AGE_GROUPS : SCHOOL_AGE_GROUPS).find((entry) => entry.id === code);
  if (!group) throw eduError('REQUIRED_FIELD_MISSING', 'nhóm tuổi');
  return SCHOOL_AGE_GROUPS.find((entry) => entry.ageFromMonths === group.ageFromMonths && entry.ageToMonths === group.ageToMonths)?.id;
};

// EDU-61: danh tính chỉ thuộc nguồn mock, ổn định qua reload và không đổi mã mục tiêu seed.
const withParents = (row) => {
  const domain = [row.ageGroup, row.sourceId, row.domainName];
  const sub = [...domain, row.subDomain || null];
  return {
    ...row,
    domainId: `mock-domain:${JSON.stringify(domain)}`,
    subDomainId: row.subDomain ? `mock-sub:${JSON.stringify(sub)}` : null,
    ...(row.goalText != null ? { expectedResultId: `mock-result:${JSON.stringify([...sub, row.groupNo, row.groupText])}` } : {}),
  };
};

export const curriculumMockRepository = {
  async getCurriculumSources() {
    await delay();
    return seed.sources.map((s) => ({ ...s }));
  },
  async getCurriculumGoals(ageGroupCode) {
    await delay();
    const code = curriculumAge(ageGroupCode);
    return seed.goals.filter((g) => g.ageGroup === code).map((g) => ({ ...withParents(g), contents: [...g.contents] }));
  },
  async getCurriculumContents(ageGroupCode) {
    await delay();
    const code = curriculumAge(ageGroupCode);
    return seed.contents.filter((c) => c.ageGroup === code).map(withParents);
  },
};
