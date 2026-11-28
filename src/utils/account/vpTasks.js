import { OVERRIDE_EFFECT, PERMISSION_TASKS } from '@/models/account/permissionConstants';
import { VP_OTHER_AREA, VP_PLACE, VP_TASK_AREAS, VP_TASK_PRESETS, VP_VIEW_CODE } from '@/models/account/vpTaskAreas';
import { isEduWorkflowCode } from '@/utils/account/eduRoleMatrix';

export const VP_AREA_STATE = { VIEW_ONLY: 'VIEW_ONLY', PARTIAL: 'PARTIAL', ALL: 'ALL' };

/** Giá trị một ô của bảng giao việc: chỉ xem, hoặc được sửa ở nơi nào. */
export const VP_CELL = { VIEW: 'VIEW', CAMPUS: VP_PLACE.CAMPUS, SCHOOL: VP_PLACE.SCHOOL };

/*
 * Nơi giao tại một điểm trường cụ thể khác điểm trường phụ trách (AUTH-20, chốt 21/11/2026): giá trị `C:<id>`.
 * VP_PLACE.CAMPUS vẫn nghĩa cũ: điểm trường PHT đang phân công.
 */
const PINNED_PREFIX = 'C:';
export const vpPinnedPlace = (campusId) => `${PINNED_PREFIX}${campusId}`;
export const vpPinnedCampusId = (place) =>
  typeof place === 'string' && place.startsWith(PINNED_PREFIX) ? place.slice(PINNED_PREFIX.length) : null;

/** campusNameOf(id): tên điểm trường giao cụ thể; thiếu thì ghi chung để không hiện id. */
export const vpPlaceText = (place, campusName, campusNameOf) => {
  if (place === VP_PLACE.SCHOOL) return 'Cả trường';
  const pinned = vpPinnedCampusId(place);
  return pinned ? campusNameOf?.(pinned) || 'Điểm trường khác' : campusName;
};

/** Nhãn điểm trường cho ô chọn: trùng tên thì kèm mã để phân biệt. */
export const vpCampusLabels = (campuses = []) => {
  const nameOf = (campus) => campus.shortName || campus.name;
  const count = new Map();
  campuses.forEach((campus) => count.set(nameOf(campus), (count.get(nameOf(campus)) || 0) + 1));
  return new Map(
    campuses.map((campus) => [
      String(campus.id),
      count.get(nameOf(campus)) > 1 && campus.code ? `${nameOf(campus)} (${campus.code})` : nameOf(campus),
    ]),
  );
};

/** Đổi `key` khi dữ liệu đã lưu đổi, để bỏ bản nháp cũ của người đó. */
export const vpItemsKey = (items = []) =>
  items.map((item) => `${item.code}:${item.on ? 1 : 0}:${item.scope || ''}:${item.campusId ?? ''}`).join('|');

const isSchoolWide = (item) => item.effect === OVERRIDE_EFFECT.GRANT && item.scope === VP_PLACE.SCHOOL;

/**
 * Bản nháp giao việc của một người: { [mã]: { on, scope, campusId } }. Ô ma trận bật được hiểu là điểm trường phụ trách;
 * campusId chỉ có khi HT giao việc tại một điểm trường cụ thể.
 */
export const vpDraftOf = (items = []) =>
  Object.fromEntries(
    items.map((item) => [
      item.code,
      {
        on: !!item.on,
        scope: isSchoolWide(item) ? VP_PLACE.SCHOOL : VP_PLACE.CAMPUS,
        campusId: !isSchoolWide(item) && item.campusId != null ? String(item.campusId) : null,
      },
    ]),
  );

const placeOf = (task, item, draft) => {
  if (!item.campusScoped) return task.place;
  const wanted = draft[item.code];
  if (wanted?.campusId) return vpPinnedPlace(wanted.campusId);
  return wanted?.scope || task.place;
};

/** Mảng chỉ gồm việc người này được cấu hình; mã chưa xếp mảng vào "Việc khác"; quyền xem không phải việc để giao. */
export const vpAreasView = (items = [], draft = vpDraftOf(items)) => {
  const byCode = new Map(items.map((item) => [item.code, item]));
  const known = new Set(VP_TASK_AREAS.flatMap((area) => area.tasks.map((task) => task.code)));
  const other = items
    .filter((item) => !known.has(item.code) && item.code !== VP_VIEW_CODE && !isEduWorkflowCode(item.code))
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
      return { key: area.key, label: area.label, note: area.note, checkGaps: !!area.checkGaps, tasks, onCount, state };
    })
    .filter((area) => area.tasks.length > 0);
};

/** Quyền xem hồ sơ trẻ đang bị tắt thì không được ghi "xem cả trường" cho người này. */
export const vpViewOff = (items = [], draft = vpDraftOf(items)) =>
  items.some((item) => item.code === VP_VIEW_CODE) && !draft[VP_VIEW_CODE]?.on;

export const setVpTask = (draft, code, on) => ({ ...draft, [code]: { ...draft[code], on } });

export const setVpTaskScope = (draft, code, scope) => ({ ...draft, [code]: { ...draft[code], scope, campusId: null } });

export const setVpArea = (draft, area, on) => area.tasks.reduce((next, task) => setVpTask(next, task.code, on), draft);

export const vpCellValue = (task) => (task.on ? task.place : VP_CELL.VIEW);

/**
 * Chỉ mã campusScoped mới chọn được nơi: điểm trường phụ trách, từng điểm trường khác (theo `campuses` đang hoạt động),
 * cả trường; mã khác sửa ở nơi cố định của việc. Nơi đang giao mà không còn trong danh sách vẫn giữ để hiển thị đúng.
 */
export const vpCellOptions = (task, campuses = [], ownCampusId = null) => {
  if (!task.choosable) return [VP_CELL.VIEW, task.place];
  const others = campuses.filter((campus) => String(campus.id) !== String(ownCampusId)).map((campus) => vpPinnedPlace(campus.id));
  const current = vpPinnedCampusId(task.place) && !others.includes(task.place) ? [task.place] : [];
  return [VP_CELL.VIEW, VP_CELL.CAMPUS, ...others, ...current, VP_CELL.SCHOOL];
};

export const vpCellText = (value, campusName, campusNameOf) =>
  value === VP_CELL.VIEW ? 'Chỉ xem' : `Được sửa · ${vpPlaceText(value, campusName, campusNameOf)}`;

export const setVpCell = (draft, code, value) => {
  if (value === VP_CELL.VIEW) return setVpTask(draft, code, false);
  const pinned = vpPinnedCampusId(value);
  return { ...draft, [code]: { ...draft[code], on: true, scope: pinned ? VP_PLACE.CAMPUS : value, campusId: pinned } };
};

const setVpPreset = (draft, presetKey, items, on) => {
  const preset = VP_TASK_PRESETS.find((p) => p.key === presetKey);
  if (!preset) return draft;
  const areas = vpAreasView(items, draft);
  const next = areas.filter((area) => preset.areas.includes(area.key)).reduce((d, area) => setVpArea(d, area, on), draft);
  // Giao nhãn có offAreas (PHT dinh dưỡng) ⇒ các mảng đó về chỉ xem; bỏ nhãn không tự bật lại
  if (!on) return next;
  return areas.filter((area) => (preset.offAreas || []).includes(area.key)).reduce((d, area) => setVpArea(d, area, false), next);
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
    const off = areas.filter((area) => (preset.offAreas || []).includes(area.key));
    const applied = own.every((area) => area.state === VP_AREA_STATE.ALL) && off.every((area) => area.onCount === 0);
    return own.length ? [{ ...preset, applied }] : [];
  });
};

/**
 * Dựng danh sách ngoại lệ gửi PUT (thay toàn bộ nên phải đủ mọi mã). Trùng mặc định thì không lưu, trừ khi chọn cả trường:
 * ô ma trận chỉ có nghĩa điểm trường, muốn cả trường phải có GRANT phạm vi SCHOOL (ADR-0023).
 */
export const vpOverridesFromDraft = (items = [], draft = {}) =>
  items.flatMap((item) => {
    // BE EDU-110 (7): 8 mã soạn/duyệt không có ngoại lệ theo người (1120)
    if (isEduWorkflowCode(item.code)) return [];
    const wanted = draft[item.code] || { on: !!item.on };
    if (!wanted.on) return item.roleOn ? [{ permission: item.code, effect: OVERRIDE_EFFECT.REVOKE }] : [];
    if (item.campusScoped && wanted.scope === VP_PLACE.SCHOOL) {
      return [{ permission: item.code, effect: OVERRIDE_EFFECT.GRANT, scope: VP_PLACE.SCHOOL }];
    }
    // Giao tại điểm trường cụ thể phải có GRANT kèm điểm trường, kể cả khi vai trò mặc định đã bật (ô ma trận = cơ sở mình)
    if (item.campusScoped && wanted.campusId) {
      return [{ permission: item.code, effect: OVERRIDE_EFFECT.GRANT, scope: VP_PLACE.CAMPUS, campusId: wanted.campusId }];
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
    const movedCampus = (before.campusId || null) !== (after.campusId || null);
    return before.on !== after.on || (after.on && item.campusScoped && (before.scope !== after.scope || movedCampus));
  });
};

const tasksByCode = (items, draft) => new Map(vpAreasView(items, draft).flatMap((area) => area.tasks.map((task) => [task.code, task])));

/**
 * Bản xem trước khi lưu của một người: từng việc trước → sau, và nhãn giao nhanh được thêm/bỏ.
 * Quyền xem hồ sơ trẻ không nằm trong mảng nên ghi riêng.
 */
export const vpChangePreview = (items = [], draft = {}, campusName, campusNameOf) => {
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
      before: vpCellText(vpCellValue(before.get(item.code)), campusName, campusNameOf),
      after: vpCellText(vpCellValue(after.get(item.code)), campusName, campusNameOf),
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
      // Người giữ việc ở một điểm trường: nơi giao cụ thể nếu có, không thì điểm trường phụ trách
      const covers = (view, campus) => {
        const place = view.tasks.get(task.code).place;
        if (place === VP_PLACE.SCHOOL) return true;
        return String(vpPinnedCampusId(place) ?? view.campusId) === String(campus.id);
      };
      const missing = campuses.filter((campus) => !holders.some((view) => covers(view, campus)));
      if (missing.length) gaps[task.code] = { campuses: missing.map((campus) => campus.shortName || campus.name) };
    }),
  );
  return gaps;
};

export const vpGapText = (gap) => (gap.all ? 'Chưa ai được sửa' : `Chưa ai được sửa ở ${gap.campuses.join(', ')}`);
