/*
 * Thư viện món tham khảo – DỮ LIỆU MINH HỌA cho bản mock (chưa có nguồn số liệu chính thức).
 * BE sẽ cung cấp danh mục chung chỉ đọc (GET /menu/reference-dishes); nguồn số liệu thật do BE chốt.
 * Thực phẩm tham khảo khớp với danh mục của trường theo tên; thiếu thì được thêm khi chép món.
 */
import { AGE_GROUPS } from '@/models/School';
import { SEED_PORTION_FACTORS } from '@/mocks/menuPlanningSeed';

// [tên, nhóm, đơn vị, kcal, đạm, béo, bột (trên 100 g/ml), dị ứng]
const FOODS = [
  ['Gạo tẻ', 'GRAIN', 'g', 344, 7.9, 1.0, 76.2, []],
  ['Thịt lợn nạc', 'MEAT', 'g', 139, 19.0, 7.0, 0, []],
  ['Thịt gà ta', 'MEAT', 'g', 199, 20.3, 13.1, 0, []],
  ['Trứng gà', 'EGG_DAIRY', 'g', 166, 14.8, 11.6, 0.5, ['Trứng']],
  ['Đậu phụ', 'LEGUME', 'g', 95, 10.9, 5.4, 0.7, ['Đậu nành']],
  ['Bí đỏ', 'VEGETABLE', 'g', 27, 0.3, 0.1, 5.6, []],
  ['Cà rốt', 'VEGETABLE', 'g', 39, 1.5, 0.2, 7.8, []],
  ['Cà chua', 'VEGETABLE', 'g', 20, 0.6, 0.2, 4.0, []],
  ['Rau cải xanh', 'VEGETABLE', 'g', 16, 1.7, 0.2, 1.9, []],
  ['Dầu ăn', 'FAT_SUGAR', 'ml', 897, 0, 99.7, 0, []],
  ['Thịt vịt', 'MEAT', 'g', 267, 17.8, 21.8, 0, []],
  ['Nấm rơm', 'VEGETABLE', 'g', 31, 3.6, 0.3, 3.2, []],
  ['Khoai tây', 'VEGETABLE', 'g', 92, 2.0, 0.1, 21.0, []],
  ['Bí xanh', 'VEGETABLE', 'g', 14, 0.6, 0.1, 2.4, []],
  ['Mực ống', 'SEAFOOD', 'g', 73, 16.3, 0.9, 0, []],
  ['Đậu Hà Lan', 'LEGUME', 'g', 84, 6.0, 0.4, 14.5, []],
];

// [mã, tên, loại món, mô tả, [[tên thực phẩm, định lượng chuẩn (hệ số 1)]]]
const DISHES = [
  [
    'rd01',
    'Thịt gà hầm nấm rơm',
    'MAIN',
    'Gà hầm mềm với nấm rơm.',
    [
      ['Thịt gà ta', 30],
      ['Nấm rơm', 15],
      ['Dầu ăn', 2],
    ],
  ],
  [
    'rd02',
    'Vịt om khoai tây',
    'MAIN',
    'Thịt vịt om khoai tây, hành.',
    [
      ['Thịt vịt', 28],
      ['Khoai tây', 25],
      ['Dầu ăn', 2],
    ],
  ],
  [
    'rd03',
    'Trứng đúc đậu Hà Lan',
    'MAIN',
    'Trứng gà đánh tan với đậu Hà Lan, rán chín.',
    [
      ['Trứng gà', 35],
      ['Đậu Hà Lan', 10],
      ['Dầu ăn', 3],
    ],
  ],
  [
    'rd04',
    'Đậu phụ sốt cà chua',
    'MAIN',
    'Đậu phụ rán sốt cà chua.',
    [
      ['Đậu phụ', 50],
      ['Cà chua', 20],
      ['Dầu ăn', 2],
    ],
  ],
  [
    'rd05',
    'Mực xào cà rốt',
    'MAIN',
    'Mực ống thái nhỏ xào cà rốt.',
    [
      ['Mực ống', 30],
      ['Cà rốt', 15],
      ['Dầu ăn', 2],
    ],
  ],
  [
    'rd06',
    'Canh bí xanh nấu thịt',
    'SOUP',
    'Bí xanh nấu thịt lợn băm.',
    [
      ['Bí xanh', 40],
      ['Thịt lợn nạc', 8],
    ],
  ],
  [
    'rd07',
    'Canh bí đỏ nấu thịt',
    'SOUP',
    'Bí đỏ nấu thịt lợn băm.',
    [
      ['Bí đỏ', 40],
      ['Thịt lợn nạc', 8],
    ],
  ],
  [
    'rd08',
    'Cải xanh xào tỏi',
    'VEGETABLE',
    'Rau cải xanh xào chín tới.',
    [
      ['Rau cải xanh', 45],
      ['Dầu ăn', 2],
    ],
  ],
  [
    'rd09',
    'Cháo gà nấm',
    'CARB',
    'Cháo gạo tẻ nấu gà và nấm rơm.',
    [
      ['Gạo tẻ', 25],
      ['Thịt gà ta', 15],
      ['Nấm rơm', 8],
    ],
  ],
  [
    'rd10',
    'Khoai tây nghiền',
    'SNACK',
    'Khoai tây hấp nghiền mịn.',
    [
      ['Khoai tây', 60],
      ['Dầu ăn', 1],
    ],
  ],
];

const round1 = (n) => Math.round(n * 10) / 10;

export const buildReferenceLibrary = () => ({
  foods: FOODS.map(([name, group, unit, kcal, protein, lipid, glucid, allergens]) => ({
    name,
    group,
    unit,
    nutrition: { kcal, protein, lipid, glucid },
    allergens,
  })),
  dishes: DISHES.map(([id, name, type, description, rows]) => ({
    id,
    name,
    type,
    description,
    ingredients: rows.map(([foodName, quantity]) => ({
      foodName,
      portions: Object.fromEntries(AGE_GROUPS.map(({ id: ag }) => [ag, round1(quantity * SEED_PORTION_FACTORS[ag])])),
    })),
  })),
});
