import { Sparkles } from '@/components/ui/icons';

/** Nhãn trên mọi nội dung AI soạn (GBR-AI: chưa chính thức tới khi giáo viên duyệt). Dùng chung cho đánh giá, giáo án. */
export function AiDraftTag({ label = 'Bản nháp AI – cần giáo viên duyệt' }) {
  return (
    <span className="chip chip--purple">
      <Sparkles size={14} /> {label}
    </span>
  );
}
