import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Info, Send } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { requestRoomClearance } from '@/services/masterDataService';
import { canCreateTransfer } from '@/utils/facility-transfer/transferPermissions';
import { canManageRooms } from '@/utils/school-config/schoolConfigPermissions';

/**
 * Shown when a room cannot be deactivated / deleted yet: lists the reasons and the assets still inside.
 * Transfers belong to the campus Vice Principal (GBR-FAC-06): the VP opens the pre-filled transfer,
 * the Principal sends the VP a request (notification with the same link).
 */
export function RoomBlockedModal({ room, actionLabel, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  if (!room) return null;
  const assets = room.assets || [];
  const vpOfCampus = canCreateTransfer(user) && user.campusId === room.campusId;
  // Kho không là một đầu của phiếu luân chuyển: tài sản trong kho đi theo luồng cấp phát (BF-08)
  const storeroom = room.type === 'STORAGE';
  const canMove = assets.length > 0 && !storeroom;

  const send = async () => {
    setSending(true);
    try {
      const { notified } = await requestRoomClearance(room.id, user);
      toast.success(`Đã gửi yêu cầu chuyển tài sản cho ${notified.join(', ')}.`, 'Đã gửi yêu cầu');
      onClose();
    } catch (err) {
      toast.error(err.message, 'Không gửi được yêu cầu');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`Chưa ${actionLabel.toLowerCase()} được phòng ${room.room}`}
      onClose={sending ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={sending}>
            Đóng
          </button>
          {assets.length > 0 && (
            <Link className="btn" to={`/facility/assets?location=${room.id}`}>
              Xem tài sản của phòng
            </Link>
          )}
          {canMove && vpOfCampus && (
            <Link className="btn btn--primary" to={`/facility/transfers/new?from=${room.id}`}>
              <ArrowLeftRight size={16} /> Chuyển tài sản ra
            </Link>
          )}
          {canMove && !vpOfCampus && canManageRooms(user) && (
            <button className="btn btn--primary" onClick={send} disabled={sending}>
              {sending ? <Spinner small /> : <Send size={16} />} Gửi yêu cầu chuyển tài sản cho Phó HT
            </button>
          )}
        </>
      }
    >
      <p className="text-2">
        Phòng <b>{room.name}</b>:
      </p>
      <ul className="sc-reasons">
        {room.blockers.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {assets.length > 0 && (
        <>
          <div className="table-wrap sc-table-flat mt-12">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tài sản</th>
                  <th className="center">Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{a.code}</td>
                    <td>{a.name}</td>
                    <td className="center">
                      {a.quantity} {a.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alert alert--info mt-12">
            <Info size={18} />
            <div>
              {storeroom ? (
                'Kho không dùng phiếu luân chuyển: tài sản trong kho được xuất theo luồng cấp phát tài sản. Khi kho hết tài sản, bạn ngừng sử dụng hoặc xóa được kho.'
              ) : (
                <>
                  Tài sản được chuyển ra bằng <b>phiếu luân chuyển</b> do Phó hiệu trưởng điểm trường lập (chọn phòng nhận, bàn giao, nhận).
                  Khi phiếu hoàn thành và phòng hết tài sản, bạn ngừng sử dụng hoặc xóa được phòng.
                </>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
