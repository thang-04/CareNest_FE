import { useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EvaluationReviewView } from '@/components/assessment/EvaluationReviewView';
import { EVAL_KIND } from '@/models/assessment/assessmentConstants';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** Chi tiết đánh giá học kỳ: GV xem, sửa bản nháp rồi xác nhận (giống đánh giá tháng). */
export default function SemesterEvaluationDetailPage() {
  const { id } = useParams();
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.semester, 'Chi tiết đánh giá')} />
      <EvaluationReviewView kind={EVAL_KIND.SEMESTER} id={id} />
    </div>
  );
}
