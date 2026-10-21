import { StatusBadge } from '@/components/ui/StatusBadge';
import { PERMISSION_STATE_LABELS } from '@/models/account/permissionConstants';

/* Tones follow DESIGN.md §3.2: bật/cấp thêm = green, tắt/thu hồi = red, theo vai trò = gray. */
const STATE_TONE = { ON: 'green', GRANT: 'green', OFF: 'red', REVOKE: 'red', INHERIT: 'gray' };
const STATE_SIGN = { GRANT: '+ ', REVOKE: '− ' };

/**
 * Trạng thái một quyền. `label` thay nhãn mặc định (vd. tên quyền), `signed` thêm dấu +/− cho ngoại lệ,
 * `muted` tô xám cho trạng thái cũ (cột "trước" trong lịch sử).
 */
export function PermissionStateBadge({ state, label, signed = false, muted = false }) {
  const text = label ?? PERMISSION_STATE_LABELS[state] ?? state;
  return <StatusBadge tone={muted ? 'gray' : STATE_TONE[state] || 'gray'} label={signed ? `${STATE_SIGN[state] || ''}${text}` : text} />;
}
