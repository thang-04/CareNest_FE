import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { cancelScheduledLeave } from '@/services/children/childrenService';

/**
 * Hủy lịch nghỉ học của trẻ (BE DELETE /children/{id}/scheduled-leave, G94-180/CHD-03). Trẻ học tiếp như chưa hẹn;
 * BE cũng bỏ quyết định Nghỉ học trên bảng xếp lớp năm mới. Mount có điều kiện, key theo trẻ.
 */
export function CancelScheduledLeaveModal({ child, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();

  const confirm = async () => {
    try {
      await cancelScheduledLeave(child.id, user);
      toast.success(`${child.fullName} tiếp tục học như chưa cho nghỉ.`, 'Đã hủy lịch nghỉ học');
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(err, 'Không hủy được lịch nghỉ');
    }
  };

  return (
    <ConfirmationModal
      open
      danger
      title={`Hủy lịch nghỉ học của ${child.fullName}?`}
      message="Trẻ tiếp tục học như chưa cho nghỉ. Quyết định Nghỉ học trên bảng xếp lớp năm mới cũng bị bỏ."
      confirmLabel="Hủy lịch nghỉ"
      cancelLabel="Giữ lịch nghỉ"
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
