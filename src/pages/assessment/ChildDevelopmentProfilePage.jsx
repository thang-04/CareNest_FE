import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { DevelopmentProfileView } from '@/components/assessment/DevelopmentProfileView';
import { PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** #53 Child Development Profile (UC 4.8) – teacher / team leader of the child's class. */
export default function ChildDevelopmentProfilePage() {
  const { childId } = useParams();
  const navigate = useNavigate();
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.children, 'Hồ sơ phát triển')} />
      <div className="page__head">
        <h1 className="page__title">Hồ sơ phát triển của trẻ</h1>
        <button className="btn" onClick={() => navigate('/assessment/daily')} style={{ marginTop: 6 }}>
          <ClipboardCheck size={16} /> Đánh giá hằng ngày
        </button>
      </div>
      <DevelopmentProfileView
        childId={childId}
        mode="profile"
        evaluationLink={(e) => (e.periodType === PERIOD_TYPE.YEAR ? `/assessment/year-end/${e.id}` : `/assessment/periodic/${e.id}`)}
      />
      <div className="page-actions">
        <button className="btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Quay lại
        </button>
      </div>
    </div>
  );
}
