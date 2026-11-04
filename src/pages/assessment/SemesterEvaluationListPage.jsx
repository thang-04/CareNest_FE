import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EvaluationListView } from '@/components/assessment/EvaluationListView';
import { EVAL_KIND } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** Đánh giá học kỳ (OBS-06): bản nháp tạo khi học kỳ kết thúc, theo ngày học kỳ của năm học ở Cấu hình thời gian. */
export default function SemesterEvaluationListPage() {
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.semester)} />
      <h1 className="page__title">Đánh giá học kỳ</h1>
      <EvaluationListView kind={EVAL_KIND.SEMESTER} />
    </div>
  );
}
