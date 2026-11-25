/**
 * Lần gửi duyệt gần nhất trong lịch sử do BE trả (kế hoạch năm/tổ: `code` = "SUBMIT"; hồ sơ lớp: `action` = "submit").
 * Dùng để hiện ghi chú người gửi cho người duyệt (BE spec 002 FR-005).
 */
export const submitEntryOf = (doc) => [...(doc?.history || [])].reverse().find((h) => h.code === 'SUBMIT' || h.action === 'submit') || null;

const HISTORY_ACTIONS = {
  SUBMIT: 'Gửi duyệt',
  APPROVE: 'Duyệt',
  ISSUE: 'Ban hành',
  RETURN: 'Trả lại để sửa',
  REJECT: 'Trả lại để sửa',
  UNLOCK: 'Mở hạn',
  EXTEND: 'Mở hạn',
  REOPEN_REVIEW_DEADLINE: 'Mở hạn',
  CREATE_VERSION: 'Tạo phiên bản điều chỉnh',
  REVISE: 'Tạo phiên bản điều chỉnh',
  REVISE_FUTURE: 'Điều chỉnh phần chưa dạy',
  WEEK_CHANGED: 'Cập nhật kế hoạch tuần',
  VP_EDIT: 'Phó hiệu trưởng cập nhật kế hoạch',
  POLICY_RECONCILED: 'Cập nhật quy trình duyệt',
  COMPLETED_BY_POLICY: 'Ban hành theo quy trình mới',
};

const SYSTEM_ACTIONS = new Set(['POLICY_RECONCILED', 'COMPLETED_BY_POLICY']);
const TECHNICAL_CODE = /^[A-Za-z][A-Za-z0-9_]*$/;

export function reviewHistoryItem(event) {
  const action = String(event.action || event.label || '').trim();
  const code = String(event.code || action).toUpperCase();
  const system = SYSTEM_ACTIONS.has(code);
  const technical = !action || TECHNICAL_CODE.test(action);
  const by = [event.by?.trim(), event.role?.trim()].filter(Boolean).join(' · ');
  const rejected = code === 'RETURN' || code === 'REJECT' || event.tone === 'err';
  const positive = event.tone === 'ok' || code === 'ISSUE' || code === 'COMPLETED_BY_POLICY';
  return {
    title: system || technical ? HISTORY_ACTIONS[code] || 'Cập nhật hồ sơ' : action,
    actor: by || (system ? 'Hệ thống' : null),
    note: system || (technical && !HISTORY_ACTIONS[code] && /^\s*[{[]/.test(event.note || '')) ? null : event.note,
    deadline: event.deadline,
    rejected,
    tone: rejected ? 'danger' : positive ? 'success' : 'neutral',
    at: event.at,
  };
}
