import { normalizeText } from '@/utils/format';
import { LOCATION_TYPES } from '@/models/Location';
import { hasErrors, validateClass, validateClassTeachers, validateRoom } from '@/utils/school-config/schoolConfigValidation';

/** Thiết lập năm học › nhập Excel (Cần 30/10/2026). File mẫu ở public/templates, mỗi file 2 sheet theo thứ tự. */
export const ROOM_CLASS_TEMPLATE_URL = '/templates/phong-lop-mau.xlsx';
export const TEACHER_TEMPLATE_URL = '/templates/giao-vien-to-truong-mau.xlsx';
export const ROOM_COLUMNS = ['Điểm trường', 'Mã phòng', 'Tên phòng', 'Sức chứa'];
export const CLASS_COLUMNS = ['Điểm trường', 'Tên lớp', 'Nhóm tuổi', 'Mã phòng', 'Sĩ số tối đa'];
export const TEACHER_COLUMNS = ['Điểm trường', 'Tên lớp', 'Giáo viên 1', 'Giáo viên 2', 'Chủ nhiệm'];
export const LEADER_COLUMNS = ['Nhóm tuổi', 'Tổ trưởng'];
export const SHEETS = { rooms: 'Phòng', classes: 'Lớp', teachers: 'Giáo viên', leaders: 'Tổ trưởng' };

const text = (v) =>
  String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');
const key = (v) => normalizeText(text(v));
// Tên người giữ dấu (Nguyễn Thị Hà khác Nguyễn Thị Hạ), chỉ bỏ hoa/thường và khoảng trắng thừa
const personKey = (v) => text(v).toLowerCase();
const blankRow = (cells) => (cells || []).every((v) => text(v) === '');
const reasonOf = (errors) => [...new Set(Object.values(errors).filter(Boolean))].join('; ');

/** Đọc các sheet của file .xlsx theo tên sheet trong file mẫu (thư viện chỉ tải khi dùng). */
export async function readWorkbook(file, names) {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file);
  return Object.fromEntries(names.map((n) => [n, sheets.find((s) => key(s.sheet) === key(n))?.data || null]));
}

// Dòng tiêu đề phải đúng file mẫu; trả các dòng dữ liệu kèm số dòng Excel
const bodyOf = (rows, columns, sheet, errors) => {
  if (!rows) {
    errors.push({ sheet, row: '—', reason: `Thiếu sheet "${sheet}". Hãy tải file mẫu và điền lại.` });
    return [];
  }
  const [header, ...body] = rows;
  if (!header || columns.some((c, i) => key(header[i]) !== key(c))) {
    errors.push({ sheet, row: 1, reason: `Dòng tiêu đề sheet "${sheet}" không đúng file mẫu.` });
    return [];
  }
  return body.map((cells, i) => ({ row: i + 2, cells: cells || [] })).filter((r) => !blankRow(r.cells));
};

const findCampus = (campuses, value) => campuses.find((c) => [c.shortName, c.name, c.code].some((v) => v && key(v) === key(value))) || null;
const findAgeGroup = (ageGroups, value) => ageGroups.find((g) => [g.name, g.shortName].some((v) => v && key(v) === key(value))) || null;
const sameNumber = (a, b) => Number(a) === Number(b);

/**
 * Sheet Phòng + Lớp → { rooms, classes, errors }. Phòng/lớp đã có (cùng mã phòng / tên lớp trong điểm trường) thì cập nhật
 * các ô khác đi, giống hệt thì bỏ qua. Lớp được trỏ tới phòng mới ở cùng file. Kiểm tra như form; BE kiểm lại khi lưu.
 */
export function matchRoomClassRows(sheets, { campuses, ageGroups, rooms: savedRooms, classes: savedClasses, schoolYear }) {
  const errors = [];
  const rooms = [];
  const classes = [];
  const allRooms = [...savedRooms];
  const roomInCampus = (campusId, code) => allRooms.find((r) => r.campusId === campusId && key(r.room) === key(code)) || null;

  bodyOf(sheets[SHEETS.rooms], ROOM_COLUMNS, SHEETS.rooms, errors).forEach(({ row, cells }) => {
    const [campusName, code, name, capacity] = cells;
    const label = text(code) || text(name);
    const campus = findCampus(campuses, campusName);
    if (!campus)
      return errors.push({
        sheet: SHEETS.rooms,
        row,
        name: label,
        reason: text(campusName) ? `Không có điểm trường "${text(campusName)}"` : 'Nhập điểm trường',
      });
    const existing = roomInCampus(campus.id, code);
    if (existing && rooms.some((r) => r.id === existing.id))
      return errors.push({ sheet: SHEETS.rooms, row, name: label, reason: 'Mã phòng bị lặp trong file' });
    const { id: _id, ...base } = existing || { managerUserId: '', note: '' };
    const form = { ...base, campusId: campus.id, type: LOCATION_TYPES.CLASS, room: text(code), name: text(name), capacity: capacity ?? '' };
    const others = allRooms.filter((r) => r !== existing);
    const used = savedClasses.filter((c) => existing && c.locationId === existing.id).map((c) => Number(c.capacity) || 0);
    const e = validateRoom(form, others, { minCapacity: used.length ? Math.max(...used) : 0 });
    if (hasErrors(e)) return errors.push({ sheet: SHEETS.rooms, row, name: label, reason: reasonOf(e) });
    if (existing && existing.name === form.name && sameNumber(existing.capacity, form.capacity) && existing.type === LOCATION_TYPES.CLASS)
      return;
    const item = {
      row,
      key: existing?.id || `new-room-${row}`,
      id: existing?.id || null,
      campusName: campus.shortName || campus.name,
      form: { ...form, capacity: Number(form.capacity) },
    };
    rooms.push(item);
    if (existing) Object.assign(allRooms[allRooms.indexOf(existing)], { ...form, capacity: Number(form.capacity) });
    else allRooms.push({ ...form, id: item.key, capacity: Number(form.capacity) });
  });

  const allClasses = savedClasses.map((c) => ({ ...c, schoolYear }));
  bodyOf(sheets[SHEETS.classes], CLASS_COLUMNS, SHEETS.classes, errors).forEach(({ row, cells }) => {
    const [campusName, name, groupName, code, capacity] = cells;
    const label = text(name);
    const campus = findCampus(campuses, campusName);
    if (!campus)
      return errors.push({
        sheet: SHEETS.classes,
        row,
        name: label,
        reason: text(campusName) ? `Không có điểm trường "${text(campusName)}"` : 'Nhập điểm trường',
      });
    const ageGroup = findAgeGroup(ageGroups, groupName);
    if (text(groupName) && !ageGroup)
      return errors.push({ sheet: SHEETS.classes, row, name: label, reason: `Không có nhóm tuổi "${text(groupName)}"` });
    const room = text(code) ? roomInCampus(campus.id, code) : null;
    if (text(code) && !room)
      return errors.push({ sheet: SHEETS.classes, row, name: label, reason: `Điểm trường chưa có phòng "${text(code)}"` });
    const existing = allClasses.find((c) => c.campusId === campus.id && key(c.name) === key(name)) || null;
    if (existing && classes.some((c) => c.id === existing.id))
      return errors.push({ sheet: SHEETS.classes, row, name: label, reason: 'Tên lớp bị lặp trong file' });
    const form = {
      campusId: campus.id,
      name: label,
      ageGroupId: ageGroup?.id || '',
      locationId: room?.id || '',
      capacity: capacity ?? '',
      schoolYear,
    };
    const e = validateClass(
      form,
      allClasses.filter((c) => c !== existing),
      { ageGroup, room, enrolled: existing?.childCount || 0 },
    );
    const other = room && allClasses.find((c) => c !== existing && c.locationId === room.id);
    if (!e.locationId && other) e.locationId = `Phòng ${room.room} đã có lớp ${other.name}`;
    if (hasErrors(e)) return errors.push({ sheet: SHEETS.classes, row, name: label, reason: reasonOf(e) });
    if (
      existing &&
      existing.ageGroupId === form.ageGroupId &&
      existing.locationId === form.locationId &&
      sameNumber(existing.capacity, form.capacity)
    )
      return;
    classes.push({
      row,
      key: existing?.id || `new-class-${row}`,
      id: existing?.id || null,
      campusName: campus.shortName || campus.name,
      groupName: ageGroup.shortName || ageGroup.name,
      roomCode: room.room,
      form: { ...form, capacity: Number(form.capacity) },
    });
    if (existing) Object.assign(existing, form);
    else allClasses.push({ ...form, id: `new-class-${row}` });
  });
  return { rooms, classes, errors };
}

/**
 * Sheet Giáo viên + Tổ trưởng → { classes, leaders, errors }. Giáo viên tìm theo họ tên trong danh sách giáo viên của
 * điểm trường (trùng tên thì báo lỗi); mỗi lớp tối đa 2 người, chủ nhiệm là một trong hai; mỗi người một lớp.
 */
export function matchTeacherRows(sheets, { campuses, ageGroups, classes: savedClasses, teachers, leaders: savedLeaders, schoolYear }) {
  const errors = [];
  const classes = [];
  const leaders = [];
  const byName = (name, campusId) => {
    const all = teachers.filter((t) => personKey(t.fullName) === personKey(name));
    const here = campusId ? all.filter((t) => t.campusId === campusId || (t.campusIds || []).includes(campusId)) : all;
    const list = here.length ? here : all;
    if (!list.length) return { error: `Không có giáo viên "${text(name)}"` };
    if (list.length > 1) return { error: `Có ${list.length} giáo viên tên "${text(name)}", sửa trực tiếp trên màn hình` };
    return { teacher: list[0] };
  };
  const usedBy = new Map(); // teacherId → tên lớp trong file

  bodyOf(sheets[SHEETS.teachers], TEACHER_COLUMNS, SHEETS.teachers, errors).forEach(({ row, cells }) => {
    const [campusName, className, t1, t2, homeroom] = cells;
    const label = text(className);
    const campus = findCampus(campuses, campusName);
    if (!campus)
      return errors.push({
        sheet: SHEETS.teachers,
        row,
        name: label,
        reason: text(campusName) ? `Không có điểm trường "${text(campusName)}"` : 'Nhập điểm trường',
      });
    const cls = savedClasses.find((c) => c.campusId === campus.id && key(c.name) === key(className));
    if (!cls)
      return errors.push({
        sheet: SHEETS.teachers,
        row,
        name: label,
        reason: label ? `Năm học chưa có lớp "${label}" ở ${campus.shortName || campus.name}` : 'Nhập tên lớp',
      });
    if (classes.some((c) => c.id === cls.id))
      return errors.push({ sheet: SHEETS.teachers, row, name: label, reason: 'Lớp bị lặp trong file' });
    const picked = [];
    const problems = [];
    [t1, t2]
      .filter((v) => text(v))
      .forEach((v) => {
        const { teacher, error } = byName(v, campus.id);
        if (error) problems.push(error);
        else if (picked.includes(teacher)) problems.push('Chọn 2 giáo viên khác nhau cho lớp');
        else if (usedBy.has(teacher.id)) problems.push(`${teacher.fullName} đã được xếp lớp ${usedBy.get(teacher.id)} trong file`);
        else picked.push(teacher);
      });
    if (!picked.length && !problems.length) problems.push('Nhập ít nhất một giáo viên');
    const head = text(homeroom)
      ? picked.find((t) => personKey(t.fullName) === personKey(homeroom))
      : picked.length === 1
        ? picked[0]
        : null;
    if (!problems.length && text(homeroom) && !head) problems.push('Chủ nhiệm phải là Giáo viên 1 hoặc Giáo viên 2');
    const form = { teacherIds: picked.map((t) => t.id), homeroomTeacherId: head?.id || '' };
    const e = problems.length ? {} : validateClassTeachers(form);
    if (problems.length || hasErrors(e))
      return errors.push({ sheet: SHEETS.teachers, row, name: label, reason: problems.join('; ') || reasonOf(e) });
    picked.forEach((t) => usedBy.set(t.id, cls.name));
    const same =
      form.teacherIds.length === cls.teacherIds.length &&
      form.teacherIds.every((id) => cls.teacherIds.includes(id)) &&
      form.homeroomTeacherId === (cls.homeroomTeacherId || '');
    if (same) return;
    classes.push({
      row,
      id: cls.id,
      name: cls.name,
      campusName: campus.shortName || campus.name,
      teacherNames: picked.map((t) => t.fullName),
      homeroomName: head.fullName,
      form,
    });
  });

  const leading = new Map(); // teacherId → nhóm tuổi trong file
  bodyOf(sheets[SHEETS.leaders], LEADER_COLUMNS, SHEETS.leaders, errors).forEach(({ row, cells }) => {
    const [groupName, leaderName] = cells;
    const label = text(groupName);
    const group = findAgeGroup(ageGroups, groupName);
    if (!group)
      return errors.push({ sheet: SHEETS.leaders, row, name: label, reason: label ? `Không có nhóm tuổi "${label}"` : 'Nhập nhóm tuổi' });
    if (leaders.some((l) => l.ageGroupId === group.id))
      return errors.push({ sheet: SHEETS.leaders, row, name: label, reason: 'Nhóm tuổi bị lặp trong file' });
    if (!text(leaderName)) return errors.push({ sheet: SHEETS.leaders, row, name: label, reason: 'Nhập tổ trưởng' });
    const { teacher, error } = byName(leaderName, null);
    if (error) return errors.push({ sheet: SHEETS.leaders, row, name: label, reason: error });
    if (leading.has(teacher.id))
      return errors.push({
        sheet: SHEETS.leaders,
        row,
        name: label,
        reason: `${teacher.fullName} đã làm tổ trưởng ${leading.get(teacher.id)} trong file`,
      });
    leading.set(teacher.id, group.shortName || group.name);
    if (savedLeaders[group.id] === teacher.id) return;
    leaders.push({
      row,
      ageGroupId: group.id,
      groupName: group.shortName || group.name,
      userId: teacher.id,
      leaderName: teacher.fullName,
      payload: { schoolYear, ageGroupId: group.id, userId: teacher.id },
    });
  });
  return { classes, leaders, errors };
}
