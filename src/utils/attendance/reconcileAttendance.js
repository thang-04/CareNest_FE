const entryOf = ({ child, record }) => ({ childId: child.id, status: record?.status || '' });

// Sheet mới là nguồn trạng thái đơn nghỉ; chỉ giữ nháp của các trẻ không bị đơn nghỉ thay đổi.
export function reconcileAttendanceDraft(draft, previous, fresh, savedIds = []) {
  const oldRows = new Map((previous?.children || []).map((row) => [row.child.id, row]));
  const saved = new Set(savedIds);
  return Object.fromEntries(
    (fresh?.children || []).map((row) => {
      const id = row.child.id;
      const old = oldRows.get(id);
      const edited = draft[id]?.status && draft[id].status !== (old?.record?.status || '');
      const keep = edited && !saved.has(id) && !row.leaveRequest && !old?.leaveRequest;
      return [id, keep ? draft[id] : entryOf(row)];
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
