import { Lock } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/utils/format';
import { PublishStatusBadge } from './ChildBadges';
import { MeasurementSummary } from './MeasurementSummary';

/**
 * Xem một lần đo (cân đo ngoài đợt, mẫu cũ) ở Sổ sức khỏe, chỉ đọc: lần đo của đợt đã đóng vẫn xem được (user yêu cầu 2026-10-23),
 * không có nút sửa. Phiếu khám Phụ lục II xem ở trang phiếu khám.
 */
export function MeasurementDetailModal({ measurement: m, ageText, onClose }) {
  return (
    <Modal open={!!m} size="lg" title={m ? `Lần đo ngày ${formatDate(m.date)}` : ''} onClose={onClose}>
      {m && (
        <>
          {m.locked && (
            <div className="alert alert--info mb-16">
              <Lock size={18} />
              <div>Đợt khám đã đóng, kết quả bị khóa. Hiệu trưởng mở lại đợt nếu cần sửa.</div>
            </div>
          )}
          <dl className="info-list mb-16">
            <dt>Đợt</dt>
            <dd>{m.campaignName || 'Ngoài đợt khám'}</dd>
            <dt>Tuổi lúc đo</dt>
            <dd>{ageText(m.ageMonths)}</dd>
            <dt>Người nhập</dt>
            <dd>{m.measuredByName || '—'}</dd>
            <dt>Phụ huynh</dt>
            <dd>
              <PublishStatusBadge status={m.published ? 'PUBLISHED' : 'UNPUBLISHED'} />
            </dd>
            {m.note && (
              <>
                <dt>Ghi chú</dt>
                <dd>{m.note}</dd>
              </>
            )}
          </dl>
          <MeasurementSummary measurement={m} />
        </>
      )}
    </Modal>
  );
}
