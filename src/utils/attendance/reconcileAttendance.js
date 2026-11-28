// Bữa của lớp = bữa cấu hình cho nhóm tuổi (BE / mock luôn trả); sheet mới thiếu thì giữ của sheet trước, không tự đặt bữa.
export const mealSessionsOf = (sheet, previous) => sheet?.mealSessions || previous?.mealSessions || [];

const entryOf = ({ child, record }, sessions) => ({
  childId: child.id,
  status: record?.status || '',
  meals: Object.fromEntries(sessions.map((session) => [session, !!record?.meals?.[session]])),
});

// Sheet mới là nguồn trạng thái đơn nghỉ; chỉ giữ nháp của các trẻ không bị đơn nghỉ thay đổi.
export function reconcileAttendanceDraft(draft, previous, fresh, savedIds = []) {
  const oldRows = new Map((previous?.children || []).map((row) => [row.child.id, row]));
  const sessions = mealSessionsOf(fresh, previous);
  const saved = new Set(savedIds);
  return Object.fromEntries(
    (fresh?.children || []).map((row) => {
      const id = row.child.id;
      const old = oldRows.get(id);
      const edited =
        draft[id]?.status &&
        (draft[id].status !== (old?.record?.status || '') ||
          !!draft[id].presentPart ||
          sessions.some((session) => !!draft[id].meals?.[session] !== !!old?.record?.meals?.[session]));
      // Ngày mở lại (26/11/2026): nháp chọn buổi (presentPart) của trẻ có đơn nghỉ vẫn giữ khi đơn không đổi
      const sameLeave = (row.leaveRequest?.id || null) === (old?.leaveRequest?.id || null);
      const leaveFree = !row.leaveRequest && !old?.leaveRequest;
      const keep = edited && !saved.has(id) && (leaveFree || (!!draft[id].presentPart && sameLeave));
      return [id, keep ? draft[id] : entryOf(row, sessions)];
    }),
  );
}

export function leaveStateChanged(previous, fresh) {
  const oldRows = new Map((previous?.children || []).map((row) => [row.child.id, row]));
  return (fresh?.children || []).some((row) => {
    const old = oldRows.get(row.child.id);
    return !!old && (old.leaveRequest?.id || null) !== (row.leaveRequest?.id || null);
  });
}

// Không cho phản hồi nền cũ ghi đè dữ liệu của lần lưu/tiếp nhận mới hơn.
export function createAttendanceRefresh({ read, busy, apply }) {
  let active = true;
  let version = 0;
  let sequence = 0;
  return {
    invalidate() {
      version++;
    },
    dispose() {
      active = false;
      version++;
    },
    async refresh({ force = false, savedIds = [] } = {}) {
      if (!active || (!force && busy())) return null;
      const started = version;
      const request = ++sequence;
      const fresh = await read();
      if (!active || started !== version || request !== sequence || (!force && busy())) return null;
      apply(fresh, savedIds);
      return fresh;
    },
  };
}
