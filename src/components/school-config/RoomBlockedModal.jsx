import { Link } from 'react-router-dom';
import { Info } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';

/**
 * Shown when a room cannot be deactivated / deleted yet: lists the classes (of an open year) the room is assigned to.
 */
export function RoomBlockedModal({ room, actionLabel, onClose }) {
  if (!room) return null;
  return (
    <Modal
      open
      size="md"
      title={`Không thể ${actionLabel.toLowerCase()} phòng ${room.room} vì đang được sử dụng`}
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
      {/* blockers = tên các lớp đang dùng phòng; tên phòng thường đã có chữ "Phòng" (vd. "Phòng học A1") nên không ghép thêm */}
      <p className="text-2">
        <b>{room.name}</b> đang được phân công cho: {room.blockers.join(', ')}.
      </p>
      <div className="alert alert--info mt-12">
        <Info size={18} />
        <div>Chuyển lớp sang phòng khác ở màn Nhóm tuổi &amp; lớp, rồi quay lại {actionLabel.toLowerCase()} phòng.</div>
      </div>
    </Modal>
  );
}
