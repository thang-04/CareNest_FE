import { OVERRIDE_EFFECT, PERMISSION_TASKS } from '@/models/account/permissionConstants';
import { VP_COVERAGE_ROWS, VP_OTHER_AREA, VP_PLACE, VP_TASK_AREAS, VP_TASK_PRESETS, VP_VIEW_CODE } from '@/models/account/vpTaskAreas';

export const VP_AREA_STATE = { VIEW_ONLY: 'VIEW_ONLY', PARTIAL: 'PARTIAL', ALL: 'ALL' };

export const vpPlaceText = (place, campusName) => (place === VP_PLACE.SCHOOL ? 'Cả trường' : campusName);

export const vpAreaStatusText = (area) => {
  if (area.state === VP_AREA_STATE.VIEW_ONLY) return 'Chỉ xem, không sửa được';
  if (area.state === VP_AREA_STATE.ALL) return 'Làm được mọi việc của mảng';
  return `Làm được ${area.onCount}/${area.tasks.length} việc`;
};

/** Câu tóm tắt đầu thẻ, vd. "Bán trú (Cơ sở 1, Cả trường) · Nhân sự (Cơ sở 1)"; rỗng = chưa giao mảng nào. */
export const vpEditSummary = (areas = [], campusName) =>
  areas
    .filter((area) => area.onCount > 0)
    .map((area) => {
      const places = [...new Set(area.tasks.filter((task) => task.on).map((task) => vpPlaceText(task.place, campusName)))];
      return `${area.label} (${places.join(', ')})`;
    })
    .join(' · ');

/** Đổi `key` khi dữ liệu đã lưu đổi, để thẻ nạp lại bản nháp mà không cần effect. */
export const vpItemsKey = (items = []) => items.map((item) => `${item.code}:${item.on ? 1 : 0}:${item.scope || ''}`).join('|');

const isSchoolWide = (item) => item.effect === OVERRIDE_EFFECT.GRANT && item.scope === VP_PLACE.SCHOOL;

/** Bản nháp của thẻ giao việc: { [mã]: { on, scope } }. Ô ma trận bật được hiểu là điểm trường phụ trách. */
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
      return { key: area.key, label: area.label, tasks, onCount, state };
    })
    .filter((area) => area.tasks.length > 0);
};

/** Quyền xem hồ sơ trẻ đang bị tắt thì không được ghi "xem cả trường" cho người này. */
export const vpViewOff = (items = [], draft = vpDraftOf(items)) =>
  items.some((item) => item.code === VP_VIEW_CODE) && !draft[VP_VIEW_CODE]?.on;

export const setVpTask = (draft, code, on) => ({ ...draft, [code]: { ...draft[code], on } });

export const setVpTaskScope = (draft, code, scope) => ({ ...draft, [code]: { ...draft[code], scope } });

export const setVpArea = (draft, area, on) => area.tasks.reduce((next, task) => setVpTask(next, task.code, on), draft);

/** Giao nhanh chỉ bật thêm, không tắt việc đã giao ở mảng khác. */
export const applyVpPreset = (draft, presetKey, items = []) => {
  const preset = VP_TASK_PRESETS.find((p) => p.key === presetKey);
  if (!preset) return draft;
  return vpAreasView(items, draft)
    .filter((area) => preset.areas.includes(area.key))
    .reduce((next, area) => setVpArea(next, area, true), draft);
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

/** Việc đổi so với đã lưu, để hộp xác nhận liệt kê từng việc trước khi lưu. */
export const vpDraftChanges = (items = [], draft = {}) => {
  const saved = vpDraftOf(items);
  return items.filter((item) => {
    const before = saved[item.code];
    const after = draft[item.code] || before;
    return before.on !== after.on || (after.on && item.campusScoped && before.scope !== after.scope);
  });
};

/** Từng dòng cho hộp xác nhận, vd. "Nhập kho khô: Chỉ xem → Được sửa (Cơ sở 1)". */
export const vpChangeTexts = (items = [], draft = {}, campusName) => {
  const saved = vpDraftOf(items);
  const stateText = (item, value) => {
    if (!value.on) return 'Chỉ xem';
    const place = item.campusScoped ? value.scope : null;
    return place ? `Được sửa (${vpPlaceText(place, campusName)})` : 'Được sửa';
  };
  return vpDraftChanges(items, draft).map((item) => {
    const label = PERMISSION_TASKS[item.code]?.label || item.label;
    return `${label}: ${stateText(item, saved[item.code])} → ${stateText(item, draft[item.code])}`;
  });
};

const holdsAt = (holder, code, campusId) => {
  const item = holder.items.find((i) => i.code === code);
  if (!item?.on) return false;
  return isSchoolWide(item) || String(holder.campusId) === String(campusId);
};

/**
 * Bảng "Ai phụ trách gì". holders: [{ userId, fullName, campusId, items }]. Không tính Hiệu trưởng: HT luôn làm được,
 * bảng chỉ trả lời việc đã giao cho PHT nào; `names` rỗng = "Chưa giao".
 */
export const vpCoverage = (holders = [], campuses = []) =>
  VP_COVERAGE_ROWS.map((row) => {
    const namesOf = (test) => holders.filter((holder) => row.codes.some((code) => test(holder, code))).map((holder) => holder.fullName);
    if (row.shared) {
      return { ...row, cells: [{ key: 'all', names: namesOf((holder, code) => !!holder.items.find((i) => i.code === code)?.on) }] };
    }
    return {
      ...row,
      cells: campuses.map((campus) => ({
        key: String(campus.id),
        names: namesOf((holder, code) => holdsAt(holder, code, campus.id)),
      })),
    };
  });
