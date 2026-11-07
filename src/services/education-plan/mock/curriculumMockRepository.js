import { delay } from '@/mocks/mockDatabase';
import { CURRICULUM_SEED as seed } from '@/mocks/curriculumSeed';
import { eduError } from './eduMockErrors';

/*
 * BE giả của danh mục Chương trình GDMN (BE:EDU-28): cùng dữ liệu V31 (sinh từ VBHN 01/VBHN-BGDĐT), chỉ đọc.
 * Nhóm tuổi theo mã UI ("ag-3"); id mục tiêu theo thứ tự seed.
 */
const AGE_GROUPS = new Set(['ag-2', 'ag-3', 'ag-4', 'ag-5']);
const requireAge = (code) => {
  if (!AGE_GROUPS.has(code)) throw eduError('REQUIRED_FIELD_MISSING', 'nhóm tuổi');
};

export const curriculumMockRepository = {
  async getCurriculumSources() {
    await delay();
    return seed.sources.map((s) => ({ ...s }));
  },
  async getCurriculumGoals(ageGroupCode) {
    await delay();
    requireAge(ageGroupCode);
    return seed.goals.filter((g) => g.ageGroup === ageGroupCode).map((g) => ({ ...g, contents: [...g.contents] }));
  },
  async getCurriculumContents(ageGroupCode) {
    await delay();
    requireAge(ageGroupCode);
    return seed.contents.filter((c) => c.ageGroup === ageGroupCode).map((c) => ({ ...c }));
  },
};
