import { Link } from 'react-router-dom';
import { Info } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';

/**
 * Shown when a room cannot be deactivated / deleted yet: lists the reasons (the room is used by a class of an open year).
 * Phần tài sản / luân chuyển / kiểm kê của cơ sở vật chất tạm bỏ (người dùng 13/10/2026: làm sau).
 */
export function RoomBlockedModal({ room, actionLabel, onClose }) {
  if (!room) return null;
  return (
    <Modal
      open
      size="md"
      title={`Chưa ${actionLabel.toLowerCase()} được phòng ${room.room}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <Link className="btn btn--primary" to="/school/classes">
            Đổi phòng cho lớp
          </Link>
        </>
      }
    >
      <p className="text-2">
        Phòng <b>{room.name}</b> chưa {actionLabel.toLowerCase()} được vì:
      </p>
      <ul className="sc-ready__list">
        {room.blockers.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="alert alert--info mt-12">
        <Info size={18} />
        <div>Chuyển lớp sang phòng khác ở màn Nhóm tuổi &amp; lớp, rồi quay lại {actionLabel.toLowerCase()} phòng.</div>
      </div>
    </Modal>
  );
}
