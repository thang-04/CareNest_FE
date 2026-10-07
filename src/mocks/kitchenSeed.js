/*
 * Fictional data of the kitchen module (no real data).
 * Foods, dishes and published menus are a stand-in for the menu-planning module and are used only while
 * db.foods / db.dishes are missing; meal counts are a stand-in for the attendance module (db.mealCounts).
 * Stored collections seeded lazily by the kitchen repository: db.foodStock, db.stockReceipts, db.stockTransactions,
 * db.stockIssues, db.ingredientReceipts, db.missingFoodReports, db.mealPreparations.
 */

export const seedFoods = [
  { id: 'kf_rice', name: 'Gạo tẻ', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_pork', name: 'Thịt lợn nạc', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_beef', name: 'Thịt bò', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_chicken', name: 'Thịt gà', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_fish', name: 'Cá basa phi lê', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_shrimp', name: 'Tôm tươi', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_tofu', name: 'Đậu phụ', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_egg', name: 'Trứng gà', unit: 'quả', roundStep: 1 },
  { id: 'kf_pumpkin', name: 'Bí đỏ', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_greens', name: 'Rau cải xanh', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_carrot', name: 'Cà rốt', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_potato', name: 'Khoai tây', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_noodle', name: 'Bún tươi', unit: 'kg', roundStep: 0.1 },
  { id: 'kf_milk', name: 'Sữa tươi (hộp 180 ml)', unit: 'hộp', roundStep: 1 },
  { id: 'kf_soymilk', name: 'Sữa đậu nành (hộp 180 ml)', unit: 'hộp', roundStep: 1 },
  { id: 'kf_banana', name: 'Chuối tiêu', unit: 'quả', roundStep: 1 },
  { id: 'kf_oil', name: 'Dầu ăn', unit: 'lít', roundStep: 0.1 },
];

/* Quantity per portion is in the food unit, for the 4–5 year group (see PORTION_FACTOR_BY_AGE_GROUP). */
const dish = (id, name, ingredients, allergens = []) => ({
  id,
  name,
  allergens,
  ingredients: ingredients.map(([foodId, qtyPerPortion]) => ({ foodId, qtyPerPortion })),
});

export const seedDishes = [
  dish('kd_rice', 'Cơm trắng', [['kf_rice', 0.06]]),
  dish('kd_pork', 'Thịt lợn rim', [
    ['kf_pork', 0.04],
    ['kf_oil', 0.003],
  ]),
  dish('kd_beef', 'Bò xào cà rốt', [
    ['kf_beef', 0.035],
    ['kf_carrot', 0.02],
    ['kf_oil', 0.003],
  ]),
  dish('kd_chicken', 'Gà kho gừng', [
    ['kf_chicken', 0.045],
    ['kf_oil', 0.003],
  ]),
  dish('kd_fish', 'Cá sốt cà chua', [
    ['kf_fish', 0.045],
    ['kf_oil', 0.003],
  ]),
  dish(
    'kd_egg_tofu',
    'Trứng đúc đậu phụ',
    [
      ['kf_egg', 0.5],
      ['kf_tofu', 0.02],
    ],
    ['Trứng'],
  ),
  dish('kd_tofu', 'Đậu phụ sốt cà chua', [
    ['kf_tofu', 0.05],
    ['kf_oil', 0.003],
  ]),
  dish(
    'kd_shrimp_soup',
    'Canh bí đỏ nấu tôm',
    [
      ['kf_pumpkin', 0.04],
      ['kf_shrimp', 0.015],
    ],
    ['Tôm'],
  ),
  dish('kd_pork_soup', 'Canh bí đỏ nấu thịt', [
    ['kf_pumpkin', 0.04],
    ['kf_pork', 0.015],
  ]),
  dish('kd_greens_soup', 'Canh rau cải nấu thịt', [
    ['kf_greens', 0.04],
    ['kf_pork', 0.01],
  ]),
  dish('kd_potato_soup', 'Canh khoai tây cà rốt', [
    ['kf_potato', 0.03],
    ['kf_carrot', 0.015],
  ]),
  dish('kd_noodle', 'Bún thịt gà', [
    ['kf_noodle', 0.07],
    ['kf_chicken', 0.03],
  ]),
  dish('kd_milk', 'Sữa tươi', [['kf_milk', 1]], ['Sữa bò']),
  dish('kd_soymilk', 'Sữa đậu nành', [['kf_soymilk', 1]]),
  dish('kd_banana', 'Chuối tiêu', [['kf_banana', 1]]),
];

/* Allergy menu = normal menu with every dish that has an allergen replaced (GBR-MENU-03). */
const SUBSTITUTES = { kd_shrimp_soup: 'kd_pork_soup', kd_milk: 'kd_soymilk', kd_egg_tofu: 'kd_tofu' };

const WEEK_PLAN = [
  { LUNCH: ['kd_rice', 'kd_pork', 'kd_shrimp_soup'], AFTERNOON: ['kd_milk', 'kd_banana'] },
  { LUNCH: ['kd_rice', 'kd_chicken', 'kd_greens_soup'], AFTERNOON: ['kd_noodle'] },
  { LUNCH: ['kd_rice', 'kd_fish', 'kd_potato_soup'], AFTERNOON: ['kd_milk', 'kd_banana'] },
  { LUNCH: ['kd_rice', 'kd_beef', 'kd_greens_soup'], AFTERNOON: ['kd_noodle'] },
  { LUNCH: ['kd_rice', 'kd_egg_tofu', 'kd_shrimp_soup'], AFTERNOON: ['kd_milk', 'kd_banana'] },
];

const AGE_GROUP_IDS = ['ag-2', 'ag-3', 'ag-4', 'ag-5'];

const weekday = (date) => new Date(`${date}T00:00:00`).getDay();
export const isSchoolDay = (date) => ![0, 6].includes(weekday(date));

/**
 * Published menus of one day: one normal and one allergy menu per age group and session.
 * Shape: { id, date, session, ageGroupId, type, status, dishIds, note }.
 */
export const seedMenusForDate = (date) => {
  if (!isSchoolDay(date)) return [];
  const plan = WEEK_PLAN[weekday(date) - 1];
  return Object.entries(plan).flatMap(([session, dishIds]) =>
    AGE_GROUP_IDS.flatMap((ageGroupId) => {
      const allergyIds = dishIds.map((id) => SUBSTITUTES[id] || id);
      const changed = allergyIds.some((id, i) => id !== dishIds[i]);
      const base = { date, session, ageGroupId, status: 'PUBLISHED' };
      return [
        { ...base, id: `km_${date}_${session}_${ageGroupId}_N`, type: 'NORMAL', dishIds, note: '' },
        {
          ...base,
          id: `km_${date}_${session}_${ageGroupId}_A`,
          type: 'ALLERGY',
          dishIds: allergyIds,
          note: changed ? 'Nấu và chia riêng, dùng dụng cụ riêng cho suất thay thế.' : 'Không có món cần thay thế.',
        },
      ];
    }),
  );
};

/* Stand-in meal counts: active children of each class, a few absent, children with allergies get a substitute serving. */
export const seedMealCount = ({ campusId, date, session, classes, children }) => {
  if (!isSchoolDay(date)) return null;
  const day = Number(date.slice(-2));
  const rows = classes
    .filter((c) => c.campusId === campusId)
    .map((c, ci) => {
      const kids = children.filter((ch) => ch.classId === c.id && ch.status === 'ACTIVE');
      const absent = (day + ci) % 3 === 0 ? 1 : 0;
      const afternoonSkip = session === 'AFTERNOON' && kids.length > 2 ? 1 : 0;
      const substitute = kids.filter((ch) => (ch.allergies || []).length > 0).length;
      const normal = Math.max(0, kids.length - substitute - absent - afternoonSkip);
      return { classId: c.id, className: c.name, normal, substitute };
    });
  return {
    id: `kmc_${campusId}_${date}_${session}`,
    campusId,
    date,
    session,
    status: 'CONFIRMED',
    confirmedAt: new Date(`${date}T08:50:00+07:00`).toISOString(),
    classes: rows,
    adjustments: [],
  };
};

/* Opening stock per food (Campus 2 is short of beef and fish so the shortage flow can be tried). */
const OPENING_STOCK = {
  kf_rice: 40,
  kf_pork: 12,
  kf_beef: 8,
  kf_chicken: 10,
  kf_fish: 8,
  kf_shrimp: 4,
  kf_tofu: 6,
  kf_egg: 150,
  kf_pumpkin: 10,
  kf_greens: 10,
  kf_carrot: 8,
  kf_potato: 8,
  kf_noodle: 12,
  kf_milk: 200,
  kf_soymilk: 40,
  kf_banana: 150,
  kf_oil: 6,
};
const CAMPUS_FACTOR = { c1: 1, c2: 0.5 };
const SHORT_AT = { c2: ['kf_beef', 'kf_fish'] };

export const buildOpeningStock = (campusIds, foods) =>
  campusIds.flatMap((campusId) =>
    foods.map((f, i) => {
      const base = OPENING_STOCK[f.id] ?? 5 + (i % 5) * 2;
      const short = (SHORT_AT[campusId] || []).includes(f.id);
      return { campusId, foodId: f.id, quantity: short ? 0.2 : Math.round(base * (CAMPUS_FACTOR[campusId] ?? 1) * 10) / 10 };
    }),
  );

/** Two past deliveries per campus so the receipt list is not empty. */
export const buildSeedReceipts = ({ campusIds, vpByCampus, dates }) =>
  campusIds.flatMap((campusId, ci) =>
    dates.map((date, di) => ({
      id: `ksr_${campusId}_${di}`,
      code: `PN-${date.replace(/-/g, '')}-${ci + 1}`,
      campusId,
      date,
      note: di === 0 ? 'Giao hàng định kỳ đầu tuần.' : '',
      items: [
        { foodId: 'kf_rice', receivedQty: 20, rejectedQty: 0, acceptedQty: 20, expiryDate: '', note: '' },
        {
          foodId: 'kf_pork',
          receivedQty: 6,
          rejectedQty: di === 1 ? 0.5 : 0,
          acceptedQty: di === 1 ? 5.5 : 6,
          expiryDate: '',
          note: di === 1 ? 'Một túi thịt không đảm bảo nhiệt độ bảo quản.' : '',
        },
        { foodId: 'kf_greens', receivedQty: 5, rejectedQty: 0, acceptedQty: 5, expiryDate: '', note: '' },
      ],
      createdBy: vpByCampus[campusId] || null,
      createdAt: new Date(`${date}T07:30:00+07:00`).toISOString(),
    })),
  );
