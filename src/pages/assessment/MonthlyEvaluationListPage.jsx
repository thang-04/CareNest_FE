import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EvaluationListView } from '@/components/assessment/EvaluationListView';
import { EVAL_KIND } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

export default function MonthlyEvaluationListPage() {
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.monthly)} />
      <h1 className="page__title">Nhận xét tháng</h1>
      <EvaluationListView kind={EVAL_KIND.MONTHLY} />
    </div>
  );
}
