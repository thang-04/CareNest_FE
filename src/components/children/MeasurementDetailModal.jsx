import { Lock } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/utils/format';
import { PublishStatusBadge } from './ChildBadges';
import { MeasurementSummary } from './MeasurementSummary';
import { ChildInfoTable } from './ChildInfoTable';

/**
 * Xem một lần đo (số đo của kỳ cân đo kèm mức BMI theo tuổi, cân đo cũ ngoài đợt, mẫu cũ) ở Sổ sức khỏe, chỉ đọc: lần đo của đợt
 * đã đóng vẫn xem được (user yêu cầu 2026-10-23), không có nút sửa. Phiếu khám Phụ lục II xem ở ExamDetailModal.
 */
export function MeasurementDetailModal({ measurement: m, ageText, onClose }) {
  return (
    <Modal open={!!m} size="lg" title={m ? `Lần đo ngày ${formatDate(m.date)}` : ''} onClose={onClose}>
      {m && (
        <>
          {m.locked && (
            <div className="alert alert--info mb-16">
              <Lock size={18} />
              <div>Đợt khám hoặc kỳ cân đo đã đóng, kết quả bị khóa. Hiệu trưởng hoặc Phó hiệu trưởng mở lại nếu cần sửa.</div>
            </div>
          )}
          <div className="stack gap-4">
            <ChildInfoTable
              label="Thông tin lần đo"
              rows={[
                { label: 'Đợt', value: m.campaignName || 'Ngoài đợt khám' },
                { label: 'Tuổi lúc đo', value: ageText(m.ageMonths) },
                { label: 'Người nhập', value: m.measuredByName || '—' },
                { label: 'Phụ huynh', value: <PublishStatusBadge status={m.published ? 'PUBLISHED' : 'UNPUBLISHED'} /> },
                m.note && { label: 'Ghi chú', value: m.note },
              ]}
            />
            <MeasurementSummary measurement={m} />
          </div>
        </>
      )}
    </Modal>
  );
}
