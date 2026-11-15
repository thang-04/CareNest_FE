import { Link } from 'react-router-dom';
import { Card, Notice } from '@/components/education-plan/eduUi';
import { planRoute } from '@/models/education-plan/planLevel.mjs';

export default function YearPlanSourceCard({ plan, source, children }) {
  const sourceId = plan.curriculumSourcePlanId;
  return (
    <Card title="Nguồn kế hoạch năm học" className="ga-plan-section--source">
      {children}
      {sourceId ? (
        <dl className="info-list ga-source-plan-info">
          <dt>Kế hoạch nguồn</dt>
          <dd>
            <Link to={`${planRoute({ planLevel: 'SCHOOL_YEAR' })}/${encodeURIComponent(String(sourceId))}`}>
              {source?.title || 'Xem kế hoạch năm học nguồn'}
            </Link>
          </dd>
          {source?.versionNo != null && (
            <>
              <dt>Phiên bản nguồn</dt>
              <dd className="ga-info-emphasis">{source.versionNo}</dd>
            </>
          )}
        </dl>
      ) : !children ? (
        <Notice>Kế hoạch giáo dục tổ cũ chưa liên kết với kế hoạch năm học.</Notice>
      ) : null}
    </Card>
  );
}
