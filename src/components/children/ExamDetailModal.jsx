import { Link } from 'react-router-dom';
import { FileText } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useHealthExam } from '@/hooks/children/useHealthChecks';
import { formatDate } from '@/utils/format';
import { ConclusionCategoryBadge, FollowUpLevelBadge, PublishStatusBadge } from './ChildBadges';
import { ExamSummary } from './exam/ExamSummary';

/**
 * Xem đầy đủ phiếu khám Phụ lục II của một lần khám ở Sổ sức khỏe, chỉ đọc; dữ liệu lấy từ API phiếu khám (có cơ sở khám, người đi
 * cùng). Sửa, in phiếu ở trang phiếu khám.
 */
export function ExamDetailModal({ measurement, childId, onClose }) {
  const { examView: view, loading, error, reload } = useHealthExam(measurement?.campaignId, measurement ? childId : null);
  const m = view?.measurement;
  const examLink = measurement ? `/children/health-checks/${measurement.campaignId}/exam/${childId}` : '';
  return (
    <Modal
      open={!!measurement}
      size="xl"
      title={measurement ? `${measurement.campaignName || 'Phiếu khám'} · ${formatDate(measurement.date)}` : ''}
      onClose={onClose}
      footer={
        measurement && (
          <Link className="btn" to={examLink}>
            <FileText size={16} /> Mở trang phiếu khám
          </Link>
        )
      }
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : m ? (
        <>
          <div className="row row--wrap gap-2 mb-16">
            <ConclusionCategoryBadge status={m.conclusionCategory} size="lg" />
            <FollowUpLevelBadge status={m.followUpLevel} />
            <PublishStatusBadge status={m.published ? 'PUBLISHED' : 'UNPUBLISHED'} />
          </div>
          <ExamSummary measurement={m} child={view.child} campaign={view.campaign} />
        </>
      ) : null}
    </Modal>
  );
}
