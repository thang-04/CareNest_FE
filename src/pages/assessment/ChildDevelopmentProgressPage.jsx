import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { DevelopmentProfileView } from '@/components/assessment/DevelopmentProfileView';
import { PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** #54 Child Development Progress (UC 4.1) – Principal (school) and Vice Principal (campus), published records only. */
export default function ChildDevelopmentProgressPage() {
  const { childId } = useParams();
  const navigate = useNavigate();
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.children, 'Tiến độ phát triển')} />
      <h1 className="page__title">Tiến độ phát triển của trẻ</h1>
      <DevelopmentProfileView
        childId={childId}
        mode="progress"
        evaluationLink={(e) => (e.periodType === PERIOD_TYPE.YEAR ? `/assessment/year-end/${e.id}` : `/assessment/periodic/${e.id}`)}
      />
      <div className="page-actions">
        <button className="btn" onClick={() => navigate('/assessment/children')}>
          <ArrowLeft size={16} /> Về danh sách trẻ
        </button>
      </div>
    </div>
  );
}
