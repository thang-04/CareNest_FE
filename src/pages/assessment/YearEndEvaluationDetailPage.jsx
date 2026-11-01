import { useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EvaluationReviewView } from '@/components/assessment/EvaluationReviewView';
import { EVAL_KIND } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** #59 Year-end Evaluation Detail (UC 4.6): teacher reviews, supplements and confirms the AI year-end draft. */
export default function YearEndEvaluationDetailPage() {
  const { id } = useParams();
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.yearEnd, 'Chi tiết đánh giá')} />
      <EvaluationReviewView kind={EVAL_KIND.YEAR_END} id={id} />
    </div>
  );
}
