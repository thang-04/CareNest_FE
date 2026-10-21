/*
 * Lớp demo bổ sung năm 2026-2027: mỗi điểm trường 3 lớp / nhóm tuổi (12 lớp), mỗi lớp có phòng riêng,
 * 2 giáo viên của điểm trường (1 chủ nhiệm) và 18–22 trẻ hư cấu. Lớp, trẻ đang có giữ nguyên.
 */
const YEAR = '2026-2027';
const MAX_SIZE = { 'ag-2': 25, 'ag-3': 25, 'ag-4': 30, 'ag-5': 35 };
const BIRTH_YEAR = { 'ag-2': 2024, 'ag-3': 2023, 'ag-4': 2022, 'ag-5': 2021 };
const FAMILY = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Vũ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Ngô',
  'Dương',
  'Phan',
  'Đinh',
  'Lý',
  'Mai',
  'Trịnh',
  'Lương',
  'Cao',
];
const BOYS = [
  'Minh Quân',
  'Gia Huy',
  'Bảo An',
  'Đức Minh',
  'Nhật Nam',
  'Khôi Nguyên',
  'Anh Khoa',
  'Hải Đăng',
  'Quang Vinh',
  'Thành Trung',
  'Phúc Lâm',
  'Trí Dũng',
];
const GIRLS = [
  'An Nhiên',
  'Bảo Châu',
  'Khánh Linh',
  'Diệu Anh',
  'Hà My',
  'Minh Châu',
  'Ngọc Diệp',
  'Thu Trang',
  'Mai Chi',
  'Gia Linh',
  'Tú Anh',
  'Thanh Trúc',
];
const ALLERGIES = [[], [], [], ['Tôm'], [], ['Sữa bò'], [], ['Đậu phộng']];

// Lớp thêm cho đủ 3 lớp / nhóm tuổi / điểm trường (tên theo kiểu đang dùng)
const PLAN = {
  c1: [
    ['ag-2', 'Lớp Nhà trẻ 1'],
    ['ag-2', 'Lớp Nhà trẻ 2'],
    ['ag-2', 'Lớp Nhà trẻ 3'],
    ['ag-3', 'Lớp Mầm 2'],
    ['ag-3', 'Lớp Mầm 3'],
    ['ag-4', 'Lớp Chồi 3'],
    ['ag-5', 'Lớp Lá 2'],
    ['ag-5', 'Lớp Lá 3'],
  ],
  c2: [
    ['ag-2', 'Lớp Nhà trẻ 1'],
    ['ag-2', 'Lớp Nhà trẻ 2'],
    ['ag-2', 'Lớp Nhà trẻ 3'],
    ['ag-3', 'Lớp Mầm 2'],
    ['ag-3', 'Lớp Mầm 3'],
    ['ag-4', 'Lớp Chồi 1'],
    ['ag-4', 'Lớp Chồi 2'],
    ['ag-4', 'Lớp Chồi 3'],
    ['ag-5', 'Lớp Lá B'],
    ['ag-5', 'Lớp Lá C'],
  ],
};
// Mã trẻ nối tiếp HS26001–HS26055 đang có
const FIRST_CHILD = 56;

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** teachers: giáo viên bổ sung (teacherSeed), lấy lần lượt 2 người cùng điểm trường cho mỗi lớp. */
export const buildExtraClassData = (teachers) => {
  const classes = [];
  const rooms = [];
  const children = [];
  let n = FIRST_CHILD;
  Object.entries(PLAN).forEach(([campusId, list]) => {
    const pool = teachers.filter((t) => t.campusId === campusId);
    list.forEach(([ageGroupId, name], i) => {
      const slug = `${campusId}_x${pad(i + 1)}`;
      const room = {
        id: `loc_${slug}`,
        campusId,
        name: `Phòng học ${campusId === 'c1' ? 4 : 3}${pad(i + 1)}`,
        room: `P.${campusId === 'c1' ? 4 : 3}${pad(i + 1)}`,
        type: 'CLASS',
        capacity: 35,
      };
      const [t1, t2] = [pool[i * 2], pool[i * 2 + 1]];
      const teacherIds = [t1, t2].filter(Boolean).map((t) => t.id);
      const cls = {
        id: `cls_${slug}`,
        name,
        campusId,
        ageGroupId,
        locationId: room.id,
        homeroomTeacherId: teacherIds[0] || null,
        teacherIds,
        schoolYear: YEAR,
        capacity: Math.min(room.capacity, MAX_SIZE[ageGroupId]),
        status: 'ACTIVE',
      };
      rooms.push({ ...room, managerUserId: teacherIds[0] || null });
      classes.push(cls);
      const size = 18 + ((i + (campusId === 'c2' ? 2 : 0)) % 5);
      for (let k = 0; k < size; k += 1) {
        const boy = n % 2 === 0;
        // Ghép họ x tên lần lượt theo giới: tên không trùng trong toàn bộ trẻ bổ sung
        const g = Math.floor((n - FIRST_CHILD) / 2);
        const family = FAMILY[g % FAMILY.length];
        const given = (boy ? BOYS : GIRLS)[Math.floor(g / FAMILY.length) % 12];
        const month = ((n * 5) % 12) + 1;
        const day = ((n * 7) % 27) + 1;
        children.push({
          id: `ch_${pad(n, 3)}`,
          code: `HS26${pad(n, 3)}`,
          fullName: `${family} ${given}`,
          gender: boy ? 'MALE' : 'FEMALE',
          dateOfBirth: `${BIRTH_YEAR[ageGroupId]}-${pad(month)}-${pad(day)}`,
          classId: cls.id,
          campusId,
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
        });
        n += 1;
      }
    });
  });
  return { classes, rooms, children };
};
