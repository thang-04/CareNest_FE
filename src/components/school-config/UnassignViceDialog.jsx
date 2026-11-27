import { useState } from 'react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useToast } from '@/contexts/ToastContext';
import { saveViceAssignment } from '@/services/school-config/schoolConfigService';

/**
 * Gỡ Phó hiệu trưởng khỏi điểm trường trong năm học đang xem (màn Điểm trường và Chi tiết điểm trường).
 * target: { campus, vp } hoặc null. BE: campusId = null ⇒ gỡ phân công PHT của năm học.
 */
export function UnassignViceDialog({ target, schoolYear, user, onClose, onDone }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const close = () => {
    setError('');
    onClose();
  };
  const confirm = async () => {
    try {
      await saveViceAssignment(schoolYear, target.vp.id, { campusId: null }, user);
      toast.success(`Đã gỡ ${target.vp.fullName} khỏi ${target.campus.shortName}`);
      setError('');
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <ConfirmationModal
      open={!!target}
      title="Gỡ Phó hiệu trưởng phụ trách"
      message={
        target && (
          <>
            Gỡ <b>{target.vp.fullName}</b> khỏi <b>{target.campus.shortName}</b> trong năm học đang xem? Người này không còn phụ trách điểm
            trường nào của năm học này cho tới khi được phân công lại.
          </>
        )
      }
      confirmLabel="Gỡ phân công"
      danger
      onConfirm={confirm}
      error={error}
      onClose={close}
    />
  );
}
