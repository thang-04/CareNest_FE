import { useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EvaluationReviewView } from '@/components/assessment/EvaluationReviewView';
import { EVAL_KIND } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** #56 Periodic Evaluation Detail (UC 4.5): teacher reviews, supplements and confirms the weekly / monthly AI draft. */
export default function PeriodicEvaluationDetailPage() {
  const { id } = useParams();
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.periodic, 'Chi tiết đánh giá')} />
      <EvaluationReviewView kind={EVAL_KIND.PERIODIC} id={id} />
    </div>
  );
}
