/*
 * Demo school structure: classes of both campuses and fictional children (no real child data).
 * Collections: db.classes, db.children. Modules read them through services/schoolService.js;
 * school-config writes classes, child-records writes children.
 */

const YEAR = '2026-2027';

export const seedClasses = [
  {
    id: 'cls_c1_m1',
    name: 'Lớp Mầm 1',
    campusId: 'c1',
    ageGroupId: 'ag-3',
    locationId: 'loc_c1_m1',
    homeroomTeacherId: 'u_an',
    teacherIds: ['u_an'],
  },
  {
    id: 'cls_c1_c1',
    name: 'Lớp Chồi 1',
    campusId: 'c1',
    ageGroupId: 'ag-4',
    locationId: null,
    homeroomTeacherId: 'u_minhanh',
    teacherIds: ['u_minhanh'],
  },
  {
    id: 'cls_c1_c2',
    name: 'Lớp Chồi 2',
    campusId: 'c1',
    ageGroupId: 'ag-4',
    locationId: 'loc_c1_c2',
    homeroomTeacherId: 'u_mai',
    teacherIds: ['u_mai', 'u_ha'],
  },
  {
    id: 'cls_c1_l1',
    name: 'Lớp Lá 1',
    campusId: 'c1',
    ageGroupId: 'ag-5',
    locationId: 'loc_c1_l1',
    homeroomTeacherId: 'u_hoa',
    teacherIds: ['u_hoa'],
  },
  {
    id: 'cls_c2_m1',
    name: 'Lớp Mầm 1',
    campusId: 'c2',
    ageGroupId: 'ag-3',
    locationId: 'loc_c2_m1',
    homeroomTeacherId: 'u_tuan',
    teacherIds: ['u_tuan'],
  },
  {
    id: 'cls_c2_la',
    name: 'Lớp Lá A',
    campusId: 'c2',
    ageGroupId: 'ag-5',
    locationId: 'loc_c2_a',
    homeroomTeacherId: 'u_ngoc',
    teacherIds: ['u_ngoc'],
  },
].map((c) => ({ ...c, schoolYear: YEAR, capacity: 25, status: 'ACTIVE' }));

const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
const BOYS = ['Minh Khang', 'Gia Bảo', 'Đức Anh', 'Hoàng Nam', 'Quốc Huy', 'Tuấn Kiệt', 'Bảo Long', 'Đăng Khoa'];
const GIRLS = ['Khánh An', 'Ngọc Hân', 'Bảo Ngọc', 'Minh Thư', 'Thảo Vy', 'Gia Hân', 'Phương Linh', 'Tuệ Nhi'];
const BIRTH_YEAR = { 'ag-2': 2024, 'ag-3': 2023, 'ag-4': 2022, 'ag-5': 2021 };
const ALLERGIES = [[], [], [], ['Tôm'], [], ['Sữa bò'], [], ['Đậu phộng']];

const pad = (n, w = 2) => String(n).padStart(w, '0');

const buildChildren = () => {
  let n = 0;
  return seedClasses.flatMap((cls, ci) =>
    Array.from({ length: 6 }, (_, k) => {
      n += 1;
      const boy = (k + ci) % 2 === 0;
      const family = FAMILY[(n * 3) % FAMILY.length];
      const given = (boy ? BOYS : GIRLS)[(n + ci) % 8];
      const month = ((n * 5) % 12) + 1;
      const day = ((n * 7) % 27) + 1;
      return {
        id: `ch_${pad(n, 3)}`,
        code: `HS${YEAR.slice(2, 4)}${pad(n, 3)}`,
        fullName: `${family} ${given}`,
        gender: boy ? 'MALE' : 'FEMALE',
        dateOfBirth: `${BIRTH_YEAR[cls.ageGroupId]}-${pad(month)}-${pad(day)}`,
        classId: cls.id,
        campusId: cls.campusId,
        status: 'ACTIVE',
        enrolledAt: '2026-08-15',
        allergies: ALLERGIES[n % ALLERGIES.length],
        guardians: [
          {
            fullName: `${family} Văn ${boy ? 'Hải' : 'Long'}`,
            relation: 'Bố',
            phone: `09${pad((n * 37) % 100)} ${pad((n * 53) % 1000, 3)} ${pad((n * 71) % 1000, 3)}`,
            email: `phuhuynh${pad(n, 3)}@example.com`,
            accountStatus: n % 4 === 0 ? 'NOT_ACTIVATED' : 'ACTIVE',
          },
        ],
      };
    }),
  );
};

export const buildSeedSchool = () => ({
  classes: seedClasses,
  children: [
    ...buildChildren(),
    {
      id: 'ch_new_1',
      code: 'HS26901',
      fullName: 'Lý Gia Phúc',
      gender: 'MALE',
      dateOfBirth: '2022-11-03',
      classId: null,
      campusId: 'c1',
      status: 'PENDING_PLACEMENT',
      enrolledAt: '2026-10-01',
      allergies: [],
      guardians: [
        {
          fullName: 'Lý Thị Hương',
          relation: 'Mẹ',
          phone: '0987 001 122',
          email: 'phuhuynh901@example.com',
          accountStatus: 'NOT_ACTIVATED',
        },
      ],
    },
  ],
});
