import { Link } from 'react-router-dom';
import { ArrowSquareOut } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { SidePanel } from '@/components/ui/SidePanel';
import { useMasterData } from '@/hooks/useMasterData';
import { ROLE_LABELS } from '@/models/User';

/**
 * Xem nhanh thông tin một nhân sự (chỉ đọc) khi bấm tên trong bảng, không rời trang.
 * classes: các lớp đang hiển thị trên trang, để liệt kê lớp người này chủ nhiệm.
 */
export function StaffQuickPanel({ userId, classes = [], onClose }) {
  const md = useMasterData();
  const staff = userId ? md.userById(userId) : null;
  const homerooms = classes.filter((c) => c.homeroomTeacherId === userId);
  const campus = staff?.campusId ? md.campusById(staff.campusId) : null;

  return (
    <SidePanel
      open={!!staff}
      title="Thông tin nhân sự"
      onClose={onClose}
      footer={
        <Link className="btn" to="/school/teachers">
          <ArrowSquareOut size={16} /> Xem phân công giáo viên
        </Link>
      }
    >
      {staff && (
        <div className="stack gap-5">
          <div className="row gap-3-5">
            <Avatar user={staff} size="xl" />
            <div className="stack gap-1">
              <b className="text-lg">{staff.fullName}</b>
              <span className="muted text-sm">{ROLE_LABELS[staff.role] || staff.role}</span>
            </div>
          </div>
          <dl className="info-list">
            <dt>Điểm trường</dt>
            <dd>{campus?.name || '—'}</dd>
            <dt>Lớp chủ nhiệm</dt>
            <dd>{homerooms.length ? homerooms.map((c) => c.name).join(', ') : '—'}</dd>
            <dt>Số điện thoại</dt>
            <dd>{staff.phone ? <a href={`tel:${staff.phone.replace(/\s/g, '')}`}>{staff.phone}</a> : '—'}</dd>
            <dt>Email</dt>
            <dd>{staff.email ? <a href={`mailto:${staff.email}`}>{staff.email}</a> : '—'}</dd>
          </dl>
        </div>
      )}
    </SidePanel>
  );
}
