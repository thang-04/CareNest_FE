import { OVERRIDE_EFFECT, PERMISSION_TASKS } from '@/models/account/permissionConstants';
import { VP_OTHER_AREA, VP_PLACE, VP_TASK_AREAS, VP_TASK_PRESETS, VP_VIEW_CODE } from '@/models/account/vpTaskAreas';

export const VP_AREA_STATE = { VIEW_ONLY: 'VIEW_ONLY', PARTIAL: 'PARTIAL', ALL: 'ALL' };

/** Giá trị một ô của bảng giao việc: chỉ xem, hoặc được sửa ở nơi nào. */
export const VP_CELL = { VIEW: 'VIEW', CAMPUS: VP_PLACE.CAMPUS, SCHOOL: VP_PLACE.SCHOOL };

export const vpPlaceText = (place, campusName) => (place === VP_PLACE.SCHOOL ? 'Cả trường' : campusName);

/** Đổi `key` khi dữ liệu đã lưu đổi, để bỏ bản nháp cũ của người đó. */
export const vpItemsKey = (items = []) => items.map((item) => `${item.code}:${item.on ? 1 : 0}:${item.scope || ''}`).join('|');

const isSchoolWide = (item) => item.effect === OVERRIDE_EFFECT.GRANT && item.scope === VP_PLACE.SCHOOL;

/** Bản nháp giao việc của một người: { [mã]: { on, scope } }. Ô ma trận bật được hiểu là điểm trường phụ trách. */
export const vpDraftOf = (items = []) =>
  Object.fromEntries(items.map((item) => [item.code, { on: !!item.on, scope: isSchoolWide(item) ? VP_PLACE.SCHOOL : VP_PLACE.CAMPUS }]));

const placeOf = (task, item, draft) => (item.campusScoped ? draft[item.code]?.scope || task.place : task.place);

/** Mảng chỉ gồm việc người này được cấu hình; mã chưa xếp mảng vào "Việc khác"; quyền xem không phải việc để giao. */
export const vpAreasView = (items = [], draft = vpDraftOf(items)) => {
  const byCode = new Map(items.map((item) => [item.code, item]));
  const known = new Set(VP_TASK_AREAS.flatMap((area) => area.tasks.map((task) => task.code)));
  const other = items
    .filter((item) => !known.has(item.code) && item.code !== VP_VIEW_CODE)
    .map((item) => ({ code: item.code, place: VP_PLACE.CAMPUS }));
  const areas = other.length ? [...VP_TASK_AREAS, { ...VP_OTHER_AREA, tasks: other }] : VP_TASK_AREAS;
  return areas
    .map((area) => {
      const tasks = area.tasks
        .filter((task) => byCode.has(task.code))
        .map((task) => {
          const item = byCode.get(task.code);
          return {
            ...item,
            // Nhãn lời thường của FE; mô tả enum BE còn chữ "campus" nên chỉ dùng khi mã chưa có nhãn
            label: PERMISSION_TASKS[item.code]?.label || item.label,
            on: !!draft[item.code]?.on,
            place: placeOf(task, item, draft),
            choosable: !!item.campusScoped,
          };
        });
      const onCount = tasks.filter((task) => task.on).length;
      const state = onCount === 0 ? VP_AREA_STATE.VIEW_ONLY : onCount === tasks.length ? VP_AREA_STATE.ALL : VP_AREA_STATE.PARTIAL;
      return { key: area.key, label: area.label, checkGaps: !!area.checkGaps, tasks, onCount, state };
    })
    .filter((area) => area.tasks.length > 0);
};

/** Quyền xem hồ sơ trẻ đang bị tắt thì không được ghi "xem cả trường" cho người này. */
export const vpViewOff = (items = [], draft = vpDraftOf(items)) =>
  items.some((item) => item.code === VP_VIEW_CODE) && !draft[VP_VIEW_CODE]?.on;

export const setVpTask = (draft, code, on) => ({ ...draft, [code]: { ...draft[code], on } });

export const setVpTaskScope = (draft, code, scope) => ({ ...draft, [code]: { ...draft[code], scope } });

export const setVpArea = (draft, area, on) => area.tasks.reduce((next, task) => setVpTask(next, task.code, on), draft);

export const vpCellValue = (task) => (task.on ? task.place : VP_CELL.VIEW);

/** Chỉ mã campusScoped mới chọn được nơi; mã khác sửa ở nơi cố định của việc. */
export const vpCellOptions = (task) => [VP_CELL.VIEW, ...(task.choosable ? [VP_CELL.CAMPUS, VP_CELL.SCHOOL] : [task.place])];

export const vpCellText = (value, campusName) => (value === VP_CELL.VIEW ? 'Chỉ xem' : `Được sửa · ${vpPlaceText(value, campusName)}`);

export const setVpCell = (draft, code, value) =>
  value === VP_CELL.VIEW ? setVpTask(draft, code, false) : { ...draft, [code]: { ...draft[code], on: true, scope: value } };

const setVpPreset = (draft, presetKey, items, on) => {
  const preset = VP_TASK_PRESETS.find((p) => p.key === presetKey);
  if (!preset) return draft;
  return vpAreasView(items, draft)
    .filter((area) => preset.areas.includes(area.key))
    .reduce((next, area) => setVpArea(next, area, on), draft);
};

/** Giao nhanh chỉ bật thêm, không tắt việc đã giao ở mảng khác. */
export const applyVpPreset = (draft, presetKey, items = []) => setVpPreset(draft, presetKey, items, true);

/** Bỏ nhãn: các mảng của nhãn về chỉ xem. */
export const removeVpPreset = (draft, presetKey, items = []) => setVpPreset(draft, presetKey, items, false);

/**
 * Nhãn giao nhanh suy từ việc đang giao (không lưu riêng ở BE): người được sửa đủ mọi việc của các mảng trong nhãn thì
 * mang nhãn đó. Nhãn không có mảng nào để giao cho người này thì bỏ qua.
 */
export const vpPresetsOf = (items = [], draft = vpDraftOf(items)) => {
  const areas = vpAreasView(items, draft);
  return VP_TASK_PRESETS.flatMap((preset) => {
    const own = areas.filter((area) => preset.areas.includes(area.key));
    return own.length ? [{ ...preset, applied: own.every((area) => area.state === VP_AREA_STATE.ALL) }] : [];
  });
};

/**
 * Dựng danh sách ngoại lệ gửi PUT (thay toàn bộ nên phải đủ mọi mã). Trùng mặc định thì không lưu, trừ khi chọn cả trường:
 * ô ma trận chỉ có nghĩa điểm trường, muốn cả trường phải có GRANT phạm vi SCHOOL (ADR-0023).
 */
export const vpOverridesFromDraft = (items = [], draft = {}) =>
  items.flatMap((item) => {
    const wanted = draft[item.code] || { on: !!item.on };
    if (!wanted.on) return item.roleOn ? [{ permission: item.code, effect: OVERRIDE_EFFECT.REVOKE }] : [];
    if (item.campusScoped && wanted.scope === VP_PLACE.SCHOOL) {
      return [{ permission: item.code, effect: OVERRIDE_EFFECT.GRANT, scope: VP_PLACE.SCHOOL }];
    }
    if (item.roleOn) return [];
    const grant = { permission: item.code, effect: OVERRIDE_EFFECT.GRANT };
    return [item.campusScoped ? { ...grant, scope: VP_PLACE.CAMPUS } : grant];
  });

/** Việc đổi so với đã lưu. */
export const vpDraftChanges = (items = [], draft = {}) => {
  const saved = vpDraftOf(items);
  return items.filter((item) => {
    const before = saved[item.code];
    const after = draft[item.code] || before;
    return before.on !== after.on || (after.on && item.campusScoped && before.scope !== after.scope);
  });
};

const tasksByCode = (items, draft) => new Map(vpAreasView(items, draft).flatMap((area) => area.tasks.map((task) => [task.code, task])));

/**
 * Bản xem trước khi lưu của một người: từng việc trước → sau, và nhãn giao nhanh được thêm/bỏ.
 * Quyền xem hồ sơ trẻ không nằm trong mảng nên ghi riêng.
 */
export const vpChangePreview = (items = [], draft = {}, campusName) => {
  const saved = vpDraftOf(items);
  const before = tasksByCode(items, saved);
  const after = tasksByCode(items, draft);
  // Xếp theo thứ tự việc trên bảng (quyền xem lên đầu), không theo thứ tự BE trả
  const order = [VP_VIEW_CODE, ...after.keys()];
  const changed = [...vpDraftChanges(items, draft)].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
  const rows = changed.map((item) => {
    if (item.code === VP_VIEW_CODE) {
      const viewText = (on) => (on ? 'Xem được' : 'Tắt quyền xem');
      return { code: item.code, label: 'Xem hồ sơ trẻ', before: viewText(saved[item.code].on), after: viewText(draft[item.code].on) };
    }
    return {
      code: item.code,
      label: after.get(item.code).label,
      before: vpCellText(vpCellValue(before.get(item.code)), campusName),
      after: vpCellText(vpCellValue(after.get(item.code)), campusName),
    };
  });
  const labels = (d) =>
    new Set(
      vpPresetsOf(items, d)
        .filter((p) => p.applied)
        .map((p) => p.label),
    );
  const was = labels(saved);
  const now = labels(draft);
  return {
    rows,
    labelsAdded: [...now].filter((label) => !was.has(label)),
    labelsRemoved: [...was].filter((label) => !now.has(label)),
  };
};

/**
 * Dòng của bảng Việc × Người: mảng theo thứ tự cố định, mỗi mảng gồm mọi mã có ở ít nhất một người.
 * people: [{ items, draft }].
 */
export const vpMatrixAreas = (people = []) => {
  const order = [...VP_TASK_AREAS.map((area) => area.key), VP_OTHER_AREA.key];
  const rank = new Map(VP_TASK_AREAS.flatMap((area) => area.tasks.map((task, index) => [task.code, index])));
  const byKey = new Map();
  people.forEach((person) =>
    vpAreasView(person.items, person.draft).forEach((area) => {
      const row = byKey.get(area.key) || { key: area.key, label: area.label, checkGaps: area.checkGaps, tasks: [] };
      area.tasks.forEach((task) => {
        if (!row.tasks.some((t) => t.code === task.code)) row.tasks.push({ code: task.code, label: task.label });
      });
      byKey.set(area.key, row);
    }),
  );
  return order
    .filter((key) => byKey.has(key))
    .map((key) => {
      const row = byKey.get(key);
      return { ...row, tasks: [...row.tasks].sort((a, b) => (rank.get(a.code) ?? 99) - (rank.get(b.code) ?? 99)) };
    });
};

/**
 * Việc chưa PHT nào được sửa (theo bản nháp đang chỉnh). Việc dùng chung cả trường: `{ all: true }` khi không ai sửa;
 * việc theo điểm trường: `{ campuses: [tên] }` các điểm trường chưa ai sửa. people: [{ campusId, items, draft }].
 */
export const vpTaskGaps = (people = [], campuses = []) => {
  const views = people.map((person) => ({ campusId: person.campusId, tasks: tasksByCode(person.items, person.draft) }));
  const gaps = {};
  VP_TASK_AREAS.filter((area) => area.checkGaps).forEach((area) =>
    area.tasks.forEach((task) => {
      if (!views.some((view) => view.tasks.has(task.code))) return;
      const holders = views.filter((view) => view.tasks.get(task.code)?.on);
      if (task.place === VP_PLACE.SCHOOL) {
        if (!holders.length) gaps[task.code] = { all: true };
        return;
      }
      const missing = campuses.filter(
        (campus) =>
          !holders.some((view) => view.tasks.get(task.code).place === VP_PLACE.SCHOOL || String(view.campusId) === String(campus.id)),
      );
      if (missing.length) gaps[task.code] = { campuses: missing.map((campus) => campus.shortName || campus.name) };
    }),
  );
  return gaps;
};

export const vpGapText = (gap) => (gap.all ? 'Chưa ai được sửa' : `Chưa ai được sửa ở ${gap.campuses.join(', ')}`);
