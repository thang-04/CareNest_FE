import { PROFILE_CHANGE_STATUS } from '@/models/children/childrenConstants';
import { formatDateTime } from '@/utils/format';

/**
 * BE:CHD-11 — trạng thái yêu cầu sửa hồ sơ/khai báo mới nhất cùng loại: đang chờ duyệt, hoặc bị từ chối kèm lý do.
 * Đã duyệt/đã thay thì không hiện (hồ sơ đang hiển thị đã là dữ liệu mới).
 */
export function ProfileChangeNotice({ changes, kind }) {
  const latest = (changes || []).find((c) => c.kind === kind);
  if (!latest) return null;
  if (latest.status === PROFILE_CHANGE_STATUS.PENDING)
    return (
      <div className="alert alert--info" role="status">
        Yêu cầu gửi lúc {formatDateTime(latest.requestedAt)} đang chờ Hiệu trưởng hoặc Phó hiệu trưởng duyệt. Hồ sơ chưa thay đổi; gửi lại
        sẽ thay yêu cầu đang chờ.
      </div>
    );
  if (latest.status === PROFILE_CHANGE_STATUS.REJECTED)
    return (
      <div className="alert alert--danger" role="status">
        Yêu cầu gửi lúc {formatDateTime(latest.requestedAt)} bị {latest.decidedByName || 'người duyệt'} từ chối: {latest.decisionNote}
      </div>
    );
  return null;
}
