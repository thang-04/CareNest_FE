/*
 * Fictional menu-planning data (foods, dishes, meal prices, sample / alternative / weekly menus).
 * Nutrition values are rounded reference figures per 100 g (or 100 ml) for the demo only.
 * Collections: foods, dishes, mealPrices, menus, allergyMenus, weeklyMenus, menuAiDrafts –
 * the menu-planning repository seeds them lazily (db.x ||= clone(seed.x)).
 */

const at = (date, time = '08:00') => `${date}T${time}:00.000Z`;
const VP = 'u_lan';

const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/* ---------- foods ---------- */
// [id, name, group, unit, purchaseUnit, purchaseUnitSize, unitPrice, kcal, protein, lipid, glucid, allergens]
const FOOD_ROWS = [
  ['f01', 'Gạo tẻ', 'GRAIN', 'g', 'kg', 1000, 18000, 344, 7.9, 1.0, 76.2, []],
  ['f02', 'Gạo nếp', 'GRAIN', 'g', 'kg', 1000, 26000, 346, 8.6, 1.5, 74.9, []],
  ['f03', 'Bún tươi', 'GRAIN', 'g', 'kg', 1000, 15000, 110, 1.7, 0, 25.7, []],
  ['f04', 'Miến dong', 'GRAIN', 'g', 'kg', 1000, 60000, 332, 0.6, 0.1, 82.2, []],
  ['f05', 'Thịt lợn nạc', 'MEAT', 'g', 'kg', 1000, 140000, 139, 19.0, 7.0, 0, []],
  ['f06', 'Thịt bò', 'MEAT', 'g', 'kg', 1000, 260000, 118, 21.0, 3.8, 0, []],
  ['f07', 'Thịt gà ta', 'MEAT', 'g', 'kg', 1000, 110000, 199, 20.3, 13.1, 0, []],
  ['f08', 'Cá basa phi lê', 'SEAFOOD', 'g', 'kg', 1000, 85000, 120, 17.0, 5.6, 0, ['Cá']],
  ['f09', 'Tôm đồng', 'SEAFOOD', 'g', 'kg', 1000, 220000, 90, 18.4, 1.8, 0, ['Tôm']],
  ['f10', 'Cua đồng', 'SEAFOOD', 'g', 'kg', 1000, 120000, 87, 12.3, 3.3, 2.0, ['Cua']],
  ['f11', 'Trứng gà', 'EGG_DAIRY', 'g', 'quả', 50, 3500, 166, 14.8, 11.6, 0.5, ['Trứng']],
  ['f12', 'Sữa tươi tiệt trùng', 'EGG_DAIRY', 'ml', 'hộp 180 ml', 180, 8000, 74, 3.9, 4.4, 4.8, ['Sữa bò']],
  ['f13', 'Sữa chua', 'EGG_DAIRY', 'g', 'hộp 100 g', 100, 7000, 61, 3.3, 3.7, 3.6, ['Sữa bò']],
  ['f14', 'Đậu phụ', 'LEGUME', 'g', 'bìa 200 g', 200, 6000, 95, 10.9, 5.4, 0.7, ['Đậu nành']],
  ['f15', 'Đậu xanh', 'LEGUME', 'g', 'kg', 1000, 45000, 328, 23.4, 2.4, 53.1, []],
  ['f16', 'Lạc nhân (đậu phộng)', 'LEGUME', 'g', 'kg', 1000, 70000, 573, 27.5, 44.5, 15.5, ['Đậu phộng']],
  ['f17', 'Bí đỏ', 'VEGETABLE', 'g', 'kg', 1000, 15000, 27, 0.3, 0.5, 5.6, []],
  ['f18', 'Rau cải xanh', 'VEGETABLE', 'g', 'kg', 1000, 20000, 15, 1.7, 0, 1.9, []],
  ['f19', 'Rau muống', 'VEGETABLE', 'g', 'kg', 1000, 18000, 23, 3.2, 0, 2.5, []],
  ['f20', 'Cà rốt', 'VEGETABLE', 'g', 'kg', 1000, 20000, 38, 1.5, 0, 8.0, []],
  ['f21', 'Su su', 'VEGETABLE', 'g', 'kg', 1000, 15000, 18, 0.8, 0, 3.7, []],
  ['f22', 'Cà chua', 'VEGETABLE', 'g', 'kg', 1000, 25000, 20, 0.6, 0, 4.2, []],
  ['f23', 'Bắp cải', 'VEGETABLE', 'g', 'kg', 1000, 16000, 29, 1.8, 0.1, 5.3, []],
  ['f24', 'Chuối tiêu', 'FRUIT', 'g', 'kg', 1000, 20000, 97, 1.5, 0.2, 22.2, []],
  ['f25', 'Dưa hấu', 'FRUIT', 'g', 'kg', 1000, 15000, 16, 1.2, 0.2, 2.3, []],
  ['f26', 'Dầu ăn', 'FAT_SUGAR', 'ml', 'lít', 1000, 45000, 897, 0, 99.7, 0, []],
  ['f27', 'Đường kính', 'FAT_SUGAR', 'g', 'kg', 1000, 24000, 397, 0, 0, 99.3, []],
  ['f28', 'Nấm hương khô', 'OTHER', 'g', 'kg', 1000, 350000, null, null, null, null, []],
];

const buildFoods = () =>
  FOOD_ROWS.map(([id, name, group, unit, purchaseUnit, purchaseUnitSize, unitPrice, kcal, protein, lipid, glucid, allergens], i) => ({
    id,
    code: `TP${String(i + 1).padStart(3, '0')}`,
    name,
    group,
    unit,
    purchaseUnit,
    purchaseUnitSize,
    unitPrice,
    nutrition: { kcal, protein, lipid, glucid },
    allergens,
    note: id === 'f28' ? 'Chưa có số liệu dinh dưỡng – cần bổ sung.' : '',
    status: 'ACTIVE',
    createdBy: VP,
    createdAt: at('2026-08-25'),
    updatedAt: at('2026-08-25'),
    history: [{ id: `h_${id}`, action: 'CREATED', userId: VP, at: at('2026-08-25'), note: '' }],
  }));

/* ---------- dishes ---------- */
// [id, name, type, description, [[foodId, quantity], ...]]  quantity per standard portion (factor 1)
const DISH_ROWS = [
  ['d01', 'Cơm trắng', 'CARB', 'Cơm gạo tẻ nấu mềm.', [['f01', 70]]],
  [
    'd02',
    'Cháo thịt bằm cà rốt',
    'CARB',
    'Cháo nhừ cho trẻ nhà trẻ.',
    [
      ['f01', 30],
      ['f05', 20],
      ['f20', 10],
      ['f26', 3],
    ],
  ],
  [
    'd03',
    'Thịt lợn rim cà chua',
    'MAIN',
    'Thịt nạc thái nhỏ rim với cà chua.',
    [
      ['f05', 40],
      ['f22', 15],
      ['f26', 5],
    ],
  ],
  [
    'd04',
    'Gà kho gừng',
    'MAIN',
    'Thịt gà rút xương kho nhạt.',
    [
      ['f07', 40],
      ['f26', 3],
    ],
  ],
  [
    'd05',
    'Cá basa sốt cà chua',
    'MAIN',
    'Cá phi lê bỏ xương, sốt cà chua.',
    [
      ['f08', 45],
      ['f22', 15],
      ['f26', 5],
    ],
  ],
  [
    'd06',
    'Tôm rim thịt',
    'MAIN',
    'Tôm bóc vỏ rim cùng thịt nạc.',
    [
      ['f09', 25],
      ['f05', 20],
      ['f26', 4],
    ],
  ],
  [
    'd07',
    'Trứng đúc thịt',
    'MAIN',
    'Trứng gà đánh tan với thịt băm, chiên vàng.',
    [
      ['f11', 30],
      ['f05', 15],
      ['f26', 5],
    ],
  ],
  [
    'd08',
    'Bò sốt cà chua',
    'MAIN',
    'Thịt bò thái mỏng sốt cà chua.',
    [
      ['f06', 35],
      ['f22', 15],
      ['f26', 5],
    ],
  ],
  [
    'd09',
    'Đậu phụ sốt thịt',
    'MAIN',
    'Đậu phụ rán sốt thịt băm.',
    [
      ['f14', 40],
      ['f05', 20],
      ['f26', 5],
    ],
  ],
  [
    'd10',
    'Gà rang nấm hương',
    'MAIN',
    'Thịt gà rang với nấm hương.',
    [
      ['f07', 40],
      ['f28', 3],
      ['f26', 3],
    ],
  ],
  [
    'd11',
    'Canh bí đỏ nấu thịt',
    'SOUP',
    '',
    [
      ['f17', 40],
      ['f05', 10],
      ['f26', 2],
    ],
  ],
  [
    'd12',
    'Canh rau cải nấu tôm',
    'SOUP',
    '',
    [
      ['f18', 40],
      ['f09', 10],
    ],
  ],
  [
    'd13',
    'Canh cua rau muống',
    'SOUP',
    'Cua đồng giã lọc nấu rau muống.',
    [
      ['f19', 40],
      ['f10', 15],
    ],
  ],
  [
    'd14',
    'Canh su su cà rốt nấu thịt',
    'SOUP',
    '',
    [
      ['f21', 30],
      ['f20', 10],
      ['f05', 10],
      ['f26', 2],
    ],
  ],
  [
    'd15',
    'Canh bắp cải thịt bằm',
    'SOUP',
    '',
    [
      ['f23', 40],
      ['f05', 10],
      ['f26', 2],
    ],
  ],
  [
    'd16',
    'Su su xào cà rốt',
    'VEGETABLE',
    '',
    [
      ['f21', 40],
      ['f20', 15],
      ['f26', 3],
    ],
  ],
  ['d17', 'Sữa tươi', 'DESSERT', 'Sữa tươi tiệt trùng không đường.', [['f12', 150]]],
  ['d18', 'Sữa chua', 'DESSERT', '', [['f13', 100]]],
  [
    'd19',
    'Bún nấu thịt',
    'SNACK',
    'Bún nấu thịt băm, cà chua.',
    [
      ['f03', 80],
      ['f05', 20],
      ['f22', 10],
      ['f26', 3],
    ],
  ],
  [
    'd20',
    'Chè đậu xanh',
    'SNACK',
    '',
    [
      ['f15', 20],
      ['f27', 10],
    ],
  ],
  ['d21', 'Chuối tiêu', 'DESSERT', '', [['f24', 80]]],
  ['d22', 'Dưa hấu', 'DESSERT', '', [['f25', 100]]],
  [
    'd23',
    'Cháo gà bí đỏ',
    'SNACK',
    'Cháo nhừ gà xé, bí đỏ.',
    [
      ['f01', 25],
      ['f07', 20],
      ['f17', 15],
      ['f26', 3],
    ],
  ],
  [
    'd24',
    'Miến gà',
    'SNACK',
    '',
    [
      ['f04', 25],
      ['f07', 20],
      ['f26', 2],
    ],
  ],
  [
    'd25',
    'Xôi lạc',
    'SNACK',
    'Xôi nếp với lạc rang giã nhỏ.',
    [
      ['f02', 40],
      ['f16', 10],
    ],
  ],
];

const buildDishes = () =>
  DISH_ROWS.map(([id, name, type, description, rows], i) => ({
    id,
    code: `MA${String(i + 1).padStart(3, '0')}`,
    name,
    type,
    description,
    ingredients: rows.map(([foodId, quantity]) => ({ foodId, quantity })),
    status: 'ACTIVE',
    createdBy: VP,
    createdAt: at('2026-08-26'),
    updatedAt: at('2026-08-26'),
    history: [{ id: `h_${id}`, action: 'CREATED', userId: VP, at: at('2026-08-26'), note: '' }],
  }));

/* ---------- meal prices ---------- */
const buildMealPrices = () => {
  const rows = [
    ['ag-2', 28000, '2025-09-05', '2026-09-04'],
    ['ag-3', 26000, '2025-09-05', '2026-09-04'],
    ['ag-4', 26000, '2025-09-05', '2026-09-04'],
    ['ag-5', 26000, '2025-09-05', '2026-09-04'],
    ['ag-2', 32000, '2026-09-05', null],
    ['ag-3', 30000, '2026-09-05', null],
    ['ag-4', 30000, '2026-09-05', null],
    ['ag-5', 30000, '2026-09-05', null],
  ];
  return rows.map(([ageGroupId, price, effectiveFrom, effectiveTo], i) => ({
    id: `mp_${i + 1}`,
    ageGroupId,
    price,
    effectiveFrom,
    effectiveTo,
    note: effectiveTo ? 'Năm học 2025-2026' : 'Năm học 2026-2027',
    createdBy: VP,
    createdAt: at(effectiveTo ? '2025-08-20' : '2026-08-20'),
    updatedAt: at(effectiveTo ? '2025-08-20' : '2026-08-20'),
    history: [{ id: `h_mp_${i + 1}`, action: 'CREATED', userId: VP, at: at(effectiveTo ? '2025-08-20' : '2026-08-20'), note: '' }],
  }));
};

/* ---------- sample daily menus ---------- */
const meal = (session, dishIds) => ({ session, items: dishIds.map((dishId) => ({ dishId, portion: 1 })) });
const TEMPLATES = [
  [meal('LUNCH', ['d01', 'd03', 'd11', 'd21']), meal('AFTERNOON', ['d19', 'd18'])],
  [meal('LUNCH', ['d01', 'd05', 'd15', 'd22']), meal('AFTERNOON', ['d20', 'd17'])],
  [meal('LUNCH', ['d01', 'd06', 'd14', 'd21']), meal('AFTERNOON', ['d24', 'd18'])],
  [meal('LUNCH', ['d01', 'd04', 'd12', 'd22']), meal('AFTERNOON', ['d25', 'd17'])],
  [meal('LUNCH', ['d01', 'd09', 'd13', 'd16']), meal('AFTERNOON', ['d19', 'd21'])],
  [meal('LUNCH', ['d01', 'd08', 'd11', 'd22']), meal('AFTERNOON', ['d20', 'd18'])],
];
const NURSERY_TEMPLATES = [
  [meal('MORNING', ['d17']), meal('LUNCH', ['d02', 'd21']), meal('AFTERNOON', ['d23', 'd18'])],
  [meal('MORNING', ['d18']), meal('LUNCH', ['d02', 'd22']), meal('AFTERNOON', ['d24', 'd17'])],
];
const GROUP_CODE = { 'ag-2': 'NT', 'ag-3': 'MGB', 'ag-4': 'MGN', 'ag-5': 'MGL' };
const GROUP_NAME = { 'ag-2': 'Nhà trẻ', 'ag-3': 'Mẫu giáo bé', 'ag-4': 'Mẫu giáo nhỡ', 'ag-5': 'Mẫu giáo lớn' };

const buildMenus = () => {
  const list = [];
  Object.keys(GROUP_CODE).forEach((ageGroupId) => {
    const templates = ageGroupId === 'ag-2' ? NURSERY_TEMPLATES : TEMPLATES;
    templates.forEach((meals, i) => {
      const id = `mn_${GROUP_CODE[ageGroupId].toLowerCase()}_${i + 1}`;
      list.push({
        id,
        code: `TD-${GROUP_CODE[ageGroupId]}-${String(i + 1).padStart(2, '0')}`,
        name: `Thực đơn mẫu ${i + 1} – ${GROUP_NAME[ageGroupId]}`,
        ageGroupId,
        meals: JSON.parse(JSON.stringify(meals)),
        note: '',
        status: 'ACTIVE',
        createdBy: VP,
        createdAt: at('2026-08-28'),
        updatedAt: at('2026-08-28'),
        history: [{ id: `h_${id}`, action: 'CREATED', userId: VP, at: at('2026-08-28'), note: '' }],
      });
    });
  });
  return list;
};

/* ---------- alternative menus (allergy / diet) ---------- */
const ALT_ROWS = [
  // [baseTemplateIndex, ageGroups, restrictions, replacements[[session, original, replacement]], name]
  [2, ['ag-3', 'ag-4', 'ag-5'], ['Tôm'], [['LUNCH', 'd06', 'd07']], 'Không tôm'],
  [
    3,
    ['ag-3', 'ag-4', 'ag-5'],
    ['Tôm', 'Đậu phộng'],
    [
      ['LUNCH', 'd12', 'd15'],
      ['AFTERNOON', 'd25', 'd24'],
    ],
    'Không tôm, không đậu phộng',
  ],
  [0, ['ag-4', 'ag-5'], ['Sữa bò'], [['AFTERNOON', 'd18', 'd22']], 'Không sữa bò'],
  [
    1,
    ['ag-4'],
    ['Sữa bò', 'Cá'],
    [
      ['LUNCH', 'd05', 'd04'],
      ['AFTERNOON', 'd17', 'd21'],
    ],
    'Không sữa bò, không cá',
  ],
];

const buildAllergyMenus = () => {
  const list = [];
  let n = 0;
  ALT_ROWS.forEach(([tpl, groups, restrictions, reps, label]) =>
    groups.forEach((ageGroupId) => {
      n += 1;
      const id = `am_${n}`;
      list.push({
        id,
        code: `TDT-${String(n).padStart(2, '0')}`,
        name: `${label} – Thực đơn mẫu ${tpl + 1} (${GROUP_NAME[ageGroupId]})`,
        baseMenuId: `mn_${GROUP_CODE[ageGroupId].toLowerCase()}_${tpl + 1}`,
        ageGroupId,
        groupType: 'ALLERGY',
        restrictions,
        replacements: reps.map(([session, originalDishId, replacementDishId]) => ({
          session,
          originalDishId,
          replacementDishId,
          portion: 1,
        })),
        note: 'Áp dụng cho trẻ có dị ứng đã được Hiệu trưởng xác nhận.',
        status: 'ACTIVE',
        createdBy: VP,
        createdAt: at('2026-08-29'),
        updatedAt: at('2026-08-29'),
        history: [{ id: `h_${id}`, action: 'CREATED', userId: VP, at: at('2026-08-29'), note: '' }],
      });
    }),
  );
  return list;
};

/* ---------- weekly menus ---------- */
const buildWeek = (id, code, ageGroupId, weekStart, order, extra = {}) => {
  const menus = buildMenus().filter((m) => m.ageGroupId === ageGroupId);
  return {
    id,
    code,
    ageGroupId,
    weekStart,
    days: order.map((idx, i) => {
      const m = menus[idx % menus.length];
      return { date: addDays(weekStart, i), holiday: false, note: '', menuId: m.id, meals: JSON.parse(JSON.stringify(m.meals)) };
    }),
    note: '',
    status: 'PUBLISHED',
    version: 1,
    replacesId: null,
    aiDraftId: null,
    createdBy: VP,
    createdAt: at(addDays(weekStart, -6)),
    updatedAt: at(addDays(weekStart, -3)),
    publishedBy: VP,
    publishedAt: at(addDays(weekStart, -3), '10:00'),
    history: [
      { id: `h_${id}_1`, action: 'CREATED', userId: VP, at: at(addDays(weekStart, -6)), note: '' },
      { id: `h_${id}_2`, action: 'PUBLISHED', userId: VP, at: at(addDays(weekStart, -3), '10:00'), note: '' },
    ],
    ...extra,
  };
};

const buildWeeklyMenus = () => {
  const list = [
    buildWeek('wm_1', 'TT-2026-01', 'ag-4', '2026-09-28', [0, 1, 2, 3, 4]),
    buildWeek('wm_2', 'TT-2026-02', 'ag-5', '2026-09-28', [1, 2, 3, 4, 5]),
    buildWeek('wm_3', 'TT-2026-03', 'ag-3', '2026-09-28', [2, 3, 4, 5, 0]),
    buildWeek('wm_4', 'TT-2026-04', 'ag-4', '2026-10-05', [5, 0, 1, 2, 3]),
    buildWeek('wm_5', 'TT-2026-05', 'ag-3', '2026-10-05', [0, 1, 2, 3, 4]),
    buildWeek('wm_6', 'TT-2026-06', 'ag-5', '2026-10-05', [3, 4, 5, 0, 1], {
      status: 'REPLACED',
      history: [
        { id: 'h_wm_6_1', action: 'CREATED', userId: VP, at: at('2026-09-29'), note: '' },
        { id: 'h_wm_6_2', action: 'PUBLISHED', userId: VP, at: at('2026-10-02', '10:00'), note: '' },
        {
          id: 'h_wm_6_3',
          action: 'REPLACED',
          userId: VP,
          at: at('2026-10-05', '07:30'),
          note: 'Nhà cung cấp không giao được cá basa ngày Thứ Sáu.',
        },
      ],
    }),
    buildWeek('wm_7', 'TT-2026-06', 'ag-5', '2026-10-05', [3, 4, 5, 0, 2], {
      version: 2,
      replacesId: 'wm_6',
      createdAt: at('2026-10-05', '07:00'),
      updatedAt: at('2026-10-05', '07:30'),
      publishedAt: at('2026-10-05', '07:30'),
      history: [
        {
          id: 'h_wm_7_1',
          action: 'REPLACEMENT_CREATED',
          userId: VP,
          at: at('2026-10-05', '07:00'),
          note: 'Nhà cung cấp không giao được cá basa ngày Thứ Sáu.',
        },
        { id: 'h_wm_7_2', action: 'PUBLISHED', userId: VP, at: at('2026-10-05', '07:30'), note: '' },
      ],
    }),
    buildWeek('wm_8', 'TT-2026-07', 'ag-4', '2026-10-12', [2, 3, 4, 5, 1], {
      status: 'DRAFT',
      publishedBy: null,
      publishedAt: null,
      createdAt: at('2026-10-07'),
      updatedAt: at('2026-10-07'),
      history: [{ id: 'h_wm_8_1', action: 'CREATED', userId: VP, at: at('2026-10-07'), note: '' }],
    }),
  ];
  return list;
};

export const buildSeedMenuPlanning = () => ({
  foods: buildFoods(),
  dishes: buildDishes(),
  mealPrices: buildMealPrices(),
  menus: buildMenus(),
  allergyMenus: buildAllergyMenus(),
  weeklyMenus: buildWeeklyMenus(),
  menuAiDrafts: [],
});
