import test from 'node:test';
import assert from 'node:assert/strict';

const { createAssessmentBeApi } = await import('@/services/assessment/api/assessmentApi');
const { ROLES } = await import('@/models/User');

const fakeClient = () => {
  const calls = [];
  return {
    calls,
    get: async (url) => {
      calls.push(url);
      if (url === '/assessment/children') return [{ id: 1, classId: 4, campusId: 2 }];
      if (url === '/campuses') return [{ id: 2, name: 'Điểm chính' }];
      return [];
    },
  };
};

test('GV mở Hồ sơ phát triển: không gọi danh mục điểm trường (tránh 403)', async () => {
  const client = fakeClient();
  const rows = await createAssessmentBeApi(client).getDevelopmentChildren({}, { id: 9, role: ROLES.TEACHER });
  assert.equal(client.calls.includes('/campuses'), false);
  assert.equal(rows[0].campusName, '');
});

test('HT/PHT mở Tiến độ phát triển: vẫn ghép tên điểm trường', async () => {
  const client = fakeClient();
  await createAssessmentBeApi(client).getDevelopmentChildren({}, { id: 1, role: ROLES.PRINCIPAL });
  assert.equal(client.calls.includes('/campuses'), true);
});
