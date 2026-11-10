import { Link } from 'react-router-dom';
import { Info } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';

/**
 * Shown when a room cannot be deactivated / deleted yet: lists the reasons (the room is used by a class of an open year).
 */
export function RoomBlockedModal({ room, actionLabel, onClose }) {
  if (!room) return null;
  return (
    <Modal
      open
      size="md"
      title={`Không thể ${actionLabel.toLowerCase()} phòng đang được sử dụng`}
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
      {/* Tên phòng thường đã có chữ "Phòng" (vd. "Phòng học A1") nên không ghép thêm */}
      <p className="text-2">
        <b>{room.name}</b>
        {room.room ? ` (${room.room})` : ''} đang được lớp sử dụng nên chưa {actionLabel.toLowerCase()} được:
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
