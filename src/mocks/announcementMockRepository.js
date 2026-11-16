import { readDb, writeDb } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { AGE_GROUPS } from '@/models/School';

// Dữ liệu mẫu chỉ tồn tại trong phiên, không thay thế lỗi của backend.
let nextId = 1;
const messages = [];
let templates = [];
let schedules = [];
const filesById = new Map();
const demoRules = [
  {
    type: 'SCHOOL_ANNOUNCEMENT',
    ruleCode: 'PAR-05',
    label: 'Thông báo nhà trường',
    mandatory: true,
    editable: false,
    enabled: true,
    titleTemplate: '',
    bodyTemplate: '',
    variables: [],
    customized: false,
  },
  ...[
    ['CHILD_PICKED_UP', 'PCK-04', 'Trẻ đã được đón', true, ['tenTre', 'gio', 'ngay', 'nguoiDon']],
    ['DAILY_HEALTH_NOTED', 'HLT-14', 'Sức khỏe trong ngày', true, ['tenTre', 'ngay']],
    ['MEAL_COUNT_RECONFIRM', 'NUT-03', 'Sổ báo ăn cần xác nhận lại', true, ['ngay']],
    ['MENU_PUBLISHED', 'NUT-08', 'Công bố thực đơn tuần', false, ['tuan']],
    ['HEALTH_RESULT_PUBLISHED', 'PAR-03', 'Công bố kết quả sức khỏe', false, ['tenTre']],
    ['CHILD_EVALUATION_CONFIRMED', 'PAR-03', 'Công bố đánh giá trẻ', false, ['tenTre']],
    ['THEME_EVALUATION_CONFIRMED', 'PAR-03', 'Công bố đánh giá chủ đề', false, ['tenTre', 'lop']],
    ['LEAVE_REQUEST_CREATED', 'ATT-05', 'Đơn nghỉ của phụ huynh', false, ['tenTre', 'tuNgay', 'denNgay']],
  ].map(([type, ruleCode, label, mandatory, variables]) => ({
    type,
    ruleCode,
    label,
    mandatory,
    editable: true,
    enabled: true,
    titleTemplate: label,
    bodyTemplate: label,
    variables,
    customized: false,
  })),
];
const copy = (value) => structuredClone(value);
const missing = () => {
  throw Object.assign(new Error('Không tìm thấy dữ liệu'), { status: 404 });
};
const find = (items, id) => items.find((item) => String(item.id) === String(id)) || missing();
const remove = (items, id) => items.filter((item) => String(item.id) !== String(id));
const addFiles = (files) =>
  (files || []).map((file) => {
    const id = nextId++;
    filesById.set(id, file);
    return { id, fileName: file.name, contentType: file.type, sizeBytes: file.size };
  });
const catalog = () => {
  const db = readDb();
  const campuses = db.campuses.map((item, index) => ({ id: index + 1, name: item.shortName || item.name, key: item.id }));
  const ageGroups = AGE_GROUPS.map((item, index) => ({ id: index + 1, name: item.name || item.label, key: item.id }));
  const classes = db.classes.map((item, index) => ({
    id: index + 1,
    name: item.name,
    key: item.id,
    campus: item.campusId,
    age: item.ageGroupId,
    teacherIds: item.teacherIds || [],
  }));
  return { db, campuses, ageGroups, classes };
};
const recipients = (target, actor) => {
  const { db, campuses, ageGroups, classes } = catalog();
  const campus = campuses.find((item) => item.id === target.campusId)?.key;
  const age = ageGroups.find((item) => item.id === target.ageGroupId)?.key;
  const classroom = classes.find((item) => item.id === target.classroomId);
  const targetCampus = target.scopeType === 'CLASSROOM' ? classroom?.campus : campus;
  if (actor?.role === 'VICE_PRINCIPAL' && (!targetCampus || targetCampus !== actor.campusId)) {
    throw Object.assign(new Error('Bạn không có quyền gửi ngoài điểm trường được phân công.'), { status: 403 });
  }
  const selected = classes.filter(
    (item) =>
      item &&
      (target.scopeType === 'SCHOOL' ||
        (target.scopeType === 'CAMPUS' && campus && item.campus === campus) ||
        (target.scopeType === 'AGE_GROUP' && age && item.age === age && (!campus || item.campus === campus)) ||
        (target.scopeType === 'CLASSROOM' && item.id === classroom?.id)),
  );
  const classIds = new Set(selected.map((item) => item.key));
  const campusIds = new Set(selected.map((item) => item.campus));
  if (target.scopeType === 'CAMPUS' && campus) campusIds.add(campus);
  const byRole = {};
  const all = new Set();
  for (const role of target.roles || []) {
    let ids = [];
    if (role === 'TEACHER') ids = selected.flatMap((item) => item.teacherIds);
    if (role === 'KITCHEN')
      ids = db.users.filter((item) => item.role === 'KITCHEN_STAFF' && campusIds.has(item.campusId)).map((item) => item.id);
    if (role === 'BGH')
      ids = db.users
        .filter((item) => item.role === 'PRINCIPAL' || (item.role === 'VICE_PRINCIPAL' && campusIds.has(item.campusId)))
        .map((item) => item.id);
    if (role === 'PARENT')
      ids = db.children
        .filter((child) => child.status === 'ACTIVE' && classIds.has(child.classId))
        .flatMap((child) =>
          (child.guardians || [])
            .filter((guardian) => guardian.accountStatus === 'ACTIVE' && guardian.phone)
            .map((guardian) => `parent:${guardian.phone.replace(/\D/g, '')}`),
        );
    const unique = new Set(ids.filter((id) => id && id !== actor?.id));
    byRole[role] = unique.size;
    unique.forEach((id) => all.add(id));
  }
  return { total: all.size, byRole, ids: [...all] };
};
const actorCampus = (actor) => catalog().campuses.find((campus) => campus.key === actor?.campusId)?.id ?? null;
const canManageMessage = (item, actor) =>
  !actor ||
  actor.role === 'PRINCIPAL' ||
  item.senderId === actor.id ||
  (item.target.campusId != null && item.target.campusId === actorCampus(actor));
const templateEditable = (item, actor) =>
  !actor || actor.role === 'PRINCIPAL' || (item.campusId != null && item.campusId === actorCampus(actor));
const assertAllowed = (allowed) => {
  if (!allowed) throw Object.assign(new Error('Bạn không có quyền với dữ liệu này.'), { status: 403 });
};
export const announcementMockRepository = {
  list: async ({ page = 0, size = 20 } = {}, actor) => {
    const visible = messages.filter((item) => canManageMessage(item, actor));
    return { items: copy(visible.slice(page * size, (page + 1) * size)), page, size, totalElements: visible.length };
  },
  detail: async (id, actor) => {
    const item = find(messages, id);
    assertAllowed(canManageMessage(item, actor));
    return copy(item);
  },
  preview: async (target, _options, actor) => {
    const { total, byRole } = recipients(target, actor);
    return { total, byRole };
  },
  create: async (data, files, actor) => {
    const audience = recipients(data.target, actor);
    if (!audience.total) throw Object.assign(new Error('Không có người nhận phù hợp.'), { status: 400, errorCode: 1205 });
    const item = {
      ...copy(data),
      id: nextId++,
      senderId: actor?.id || null,
      senderName: actor?.fullName || 'Tài khoản mẫu',
      recipientCount: data.sendAt ? null : audience.total,
      attachments: addFiles(files),
      status: data.sendAt ? 'SCHEDULED' : 'SENT',
      canEdit: !!data.sendAt,
    };
    if (item.target.scopeType === 'CLASSROOM') {
      const { classes, campuses } = catalog();
      const selected = classes.find((entry) => entry.id === item.target.classroomId);
      item.target.campusId = campuses.find((entry) => entry.key === selected?.campus)?.id ?? null;
    }
    messages.unshift(item);
    if (!data.sendAt)
      writeDb((db) =>
        audience.ids.forEach((userId) =>
          pushNotification(db, {
            userId,
            type: 'SCHOOL_ANNOUNCEMENT',
            title: data.title,
            message: data.body.slice(0, 500),
            announcementId: item.id,
          }),
        ),
      );
    return copy(item);
  },
  update: async (id, data, files, actor) => {
    const item = find(messages, id);
    assertAllowed(canManageMessage(item, actor));
    recipients(data.target, actor);
    if (!item.canEdit) throw Object.assign(new Error('Thông báo không còn chỉnh sửa được'), { status: 409 });
    Object.assign(item, copy(data));
    item.attachments = [...item.attachments.filter((file) => (data.keepAttachmentIds || []).includes(file.id)), ...addFiles(files)];
    return copy(item);
  },
  cancel: async (id, actor) => {
    const item = find(messages, id);
    assertAllowed(canManageMessage(item, actor));
    if (!item.canEdit) throw Object.assign(new Error('Thông báo không còn hủy được.'), { status: 409 });
    item.status = 'CANCELLED';
    item.canEdit = false;
    return copy(item);
  },
  myAnnouncement: async (id) => copy(find(messages, id)),
  attachment: async (id) => filesById.get(Number(id)) || missing(),
  templates: async (actor) =>
    copy(
      templates
        .filter((item) => !actor || actor.role === 'PRINCIPAL' || item.campusId == null || item.campusId === actorCampus(actor))
        .map((item) => ({ ...item, canEdit: templateEditable(item, actor) })),
    ),
  createTemplate: async (data, actor) => {
    assertAllowed(templateEditable(data, actor));
    const item = { ...copy(data), id: nextId++, canEdit: true };
    templates.push(item);
    return copy(item);
  },
  updateTemplate: async (id, data, actor) => {
    const item = find(templates, id);
    assertAllowed(templateEditable(item, actor) && templateEditable(data, actor));
    Object.assign(item, copy(data));
    return copy(item);
  },
  deleteTemplate: async (id, actor) => {
    assertAllowed(templateEditable(find(templates, id), actor));
    if (schedules.some((item) => item.templateId === Number(id)))
      throw Object.assign(new Error('Mẫu đang được lịch sử dụng'), { status: 409, errorCode: 1209 });
    templates = remove(templates, id);
  },
  rules: async () => copy(demoRules),
  updateRule: async (type, value) => {
    const item = demoRules.find((rule) => rule.type === type) || missing();
    if (!item.editable) throw Object.assign(new Error('Quy tắc chỉ xem'), { status: 400, errorCode: 1211 });
    if (item.mandatory && value.enabled === false)
      throw Object.assign(new Error('Quy tắc bắt buộc không thể tắt'), { status: 400, errorCode: 1210 });
    const variables = [
      ...String(value.titleTemplate || '').matchAll(/\{([A-Za-z]+)\}/g),
      ...String(value.bodyTemplate || '').matchAll(/\{([A-Za-z]+)\}/g),
    ].map((match) => match[1]);
    if (variables.some((variable) => !item.variables.includes(variable)))
      throw Object.assign(new Error('Biến không hợp lệ'), { status: 400, errorCode: 1212 });
    Object.assign(item, copy(value));
    return copy(item);
  },
  schedules: async () => copy(schedules),
  createSchedule: async (data) => {
    const item = { ...copy(data), id: nextId++, templateName: find(templates, data.templateId).name, nextRunAt: null };
    schedules.push(item);
    return copy(item);
  },
  updateSchedule: async (id, data) => {
    const item = find(schedules, id);
    Object.assign(item, copy(data));
    return copy(item);
  },
  deleteSchedule: async (id) => {
    find(schedules, id);
    schedules = remove(schedules, id);
  },
  campuses: async () => copy(catalog().campuses),
  ageGroups: async () => copy(catalog().ageGroups),
  schoolStructure: async () => ({ classes: copy(catalog().classes) }),
};
