import { useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EvaluationReviewView } from '@/components/assessment/EvaluationReviewView';
import { EVAL_KIND } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

export default function MonthlyEvaluationDetailPage() {
  const { id } = useParams();
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.monthly, 'Chi tiết nhận xét')} />
      <EvaluationReviewView kind={EVAL_KIND.MONTHLY} id={id} />
    </div>
  );
}
