import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';

globalThis.window = new EventTarget();

const { axiosClient } = await import('@/services/http/axiosClient');
const { educationPlanApi } = await import('@/services/education-plan/api/educationPlanApi');
const { buildRefs } = await import('@/services/education-plan/api/yearPlanMapper');
const { applyEduConfig, withDefaults } = await import('@/models/education-plan/eduConfig');
const { AGE_GROUPS } = await import('@/models/education-plan/educationPlanConstants');

test('real catalog starts empty instead of exposing demo groups', () => {
  assert.deepEqual(AGE_GROUPS, []);
});

test('BE catalog supplies renamed and additional groups, refresh replaces removed groups, empty stays empty', async () => {
  const sharedReference = AGE_GROUPS;
  let groups = [
    { id: 19, code: 'nursery-new', name: 'Nhà trẻ theo danh mục trường', shortName: 'NT mới', sortOrder: 1 },
    { id: 42, code: 'custom-age', name: 'Nhóm tuổi bổ sung từ DB', shortName: 'Bổ sung', sortOrder: 2 },
  ];
  const originalAdapter = axiosClient.defaults.adapter;
  axiosClient.defaults.adapter = async (request) => {
    const data =
      request.url === '/education-plans/config'
        ? { ageGroups: groups, domains: [], schoolYears: [] }
        : request.url === '/education-plans/workflow-policy'
          ? { revision: 1, policies: {} }
          : { theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } };
    return { status: 200, statusText: 'OK', headers: {}, config: request, data: { code: 200, desc: 'ok', data } };
  };
  try {
    const config = await educationPlanApi.getEduConfig();
    applyEduConfig(withDefaults(config));
    assert.equal(AGE_GROUPS, sharedReference);
    assert.deepEqual(
      AGE_GROUPS.map(({ id, name }) => ({ id, name })),
      groups.map(({ code, name }) => ({ id: code, name })),
    );
    assert.equal(AGE_GROUPS[1].databaseId, 42);
    assert.equal(AGE_GROUPS[1].shortName, 'Bổ sung');
    const refs = buildRefs({ ageGroups: groups });
    assert.equal(refs.ageGroupId(AGE_GROUPS[1].id), 42);
    assert.equal(refs.ageGroupCode(19), AGE_GROUPS[0].id);

    groups = [{ ...groups[1], name: 'Tên mới sau khi đổi trong DB' }];
    applyEduConfig(await educationPlanApi.getEduConfig());
    assert.equal(AGE_GROUPS.length, 1);
    assert.equal(sharedReference[0].name, 'Tên mới sau khi đổi trong DB');
    assert.equal(
      AGE_GROUPS.some(({ id }) => id === 'nursery-new'),
      false,
    );

    groups = [];
    applyEduConfig(await educationPlanApi.getEduConfig());
    assert.deepEqual(sharedReference, []);
  } finally {
    axiosClient.defaults.adapter = originalAdapter;
    applyEduConfig(null);
  }
});

test('config failure propagates to the provider instead of returning a demo catalog', async () => {
  const originalAdapter = axiosClient.defaults.adapter;
  axiosClient.defaults.adapter = async (request) => {
    throw new AxiosError('Unavailable', AxiosError.ERR_BAD_RESPONSE, request, null, {
      status: 503,
      statusText: 'Unavailable',
      headers: {},
      config: request,
      data: { code: 503, desc: 'Danh mục tạm thời không khả dụng', data: null },
    });
  };
  try {
    await assert.rejects(educationPlanApi.getEduConfig(), { status: 503 });
    assert.deepEqual(AGE_GROUPS, []);
  } finally {
    axiosClient.defaults.adapter = originalAdapter;
  }
});

test('filters group equal month bounds and exclude overlapping ranges', async () => {
  const { ageRangeOptions, sameAgeRange } = await import('@/models/education-plan/educationPlanConstants');
  applyEduConfig({
    ageGroups: [
      { id: 'original', databaseId: 20, name: 'Nhóm trẻ 24/36', shortName: 'Nhà trẻ', ageFromMonths: 24, ageToMonths: 36 },
      { id: 'replacement', ageFromMonths: 24, ageToMonths: 36 },
      { id: 'overlap', name: 'Nhóm khác', shortName: 'Khác', ageFromMonths: 30, ageToMonths: 42 },
      { id: 'same-start', name: 'Trùng đầu', ageFromMonths: 24, ageToMonths: 42 },
      { id: 'legacy', name: 'Nhóm cũ', ageFromMonths: 24 },
    ],
  });
  try {
    assert.deepEqual(
      ageRangeOptions().map((group) => group.name),
      ['Nhà trẻ', 'Khác', 'Trùng đầu'],
    );
    assert.equal(sameAgeRange('original', 'replacement'), true);
    assert.equal(sameAgeRange('original', 'overlap'), false);
    assert.equal(sameAgeRange(20, 'replacement'), true);
    assert.equal(sameAgeRange('original', 'same-start'), false);
    assert.equal(sameAgeRange('legacy', 'legacy'), false);
    assert.equal(ageRangeOptions(undefined, { includeIncomplete: true }).at(-1).missingRange, true);
  } finally {
    applyEduConfig(null);
  }
});

test('annual list queries the selected year and resolves the representative group by exact bounds', async () => {
  const originalAdapter = axiosClient.defaults.adapter;
  const groups = [
    { id: 10, code: 'overlap', ageFromMonths: 30, ageToMonths: 42 },
    { id: 20, code: 'original', ageFromMonths: 24, ageToMonths: 36 },
    { id: 30, code: 'other', ageFromMonths: 24, ageToMonths: 36 },
  ];
  let params;
  axiosClient.defaults.adapter = async (request) => {
    let data;
    if (request.url === '/education-plans/config') {
      data = { ageGroups: groups, schoolYears: [{ id: 5, name: '2026-2027' }] };
    } else if (request.url === '/education-plans/goals') {
      params = request.params;
      data = {
        items: [20].map((id) => ({ id, ageGroupId: id, schoolYearId: 5, schoolYearName: '2026-2027', planType: 'SCHOOL_YEAR' })),
        totalPages: 1,
      };
    } else {
      data = request.url.endsWith('workflow-policy') ? { policies: {} } : {};
    }
    return { status: 200, statusText: 'OK', headers: {}, config: request, data: { code: 200, desc: 'ok', data } };
  };
  try {
    const config = await educationPlanApi.getEduConfig(5);
    assert.equal(config.ageGroups.length, 3);
    const { goals } = await educationPlanApi.getAll(null, { planLevel: 'SCHOOL_YEAR', schoolYearId: 5, ageRange: '24:36' });
    assert.equal(params.ageGroupId, 20);
    assert.equal(params.schoolYearId, 5);
    assert.equal(params.planLevel, 'SCHOOL_YEAR');
    assert.deepEqual(
      goals.map((goal) => goal.ageGroupId),
      ['original'],
    );
  } finally {
    axiosClient.defaults.adapter = originalAdapter;
  }
});
