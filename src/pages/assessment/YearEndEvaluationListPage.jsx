import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EvaluationListView } from '@/components/assessment/EvaluationListView';
import { EVAL_KIND } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** #58 Year-end Evaluation List – year-end evaluations of the class (school year from the header). */
export default function YearEndEvaluationListPage() {
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.yearEnd)} />
      <h1 className="page__title">Đánh giá cuối năm</h1>
      <EvaluationListView kind={EVAL_KIND.YEAR_END} />
    </div>
  );
}
