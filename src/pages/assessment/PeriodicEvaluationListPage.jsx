import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EvaluationListView } from '@/components/assessment/EvaluationListView';
import { EVAL_KIND } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** #55 Periodic Evaluation List – weekly and monthly evaluations by class and period. */
export default function PeriodicEvaluationListPage() {
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.periodic)} />
      <h1 className="page__title">Đánh giá tuần / tháng</h1>
      <EvaluationListView kind={EVAL_KIND.PERIODIC} />
    </div>
  );
}
