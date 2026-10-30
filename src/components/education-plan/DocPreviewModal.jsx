import { FileDown, Printer } from '@/components/ui/icons';
import { Modal } from '@/components/education-plan/eduUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { downloadDoc, printDoc } from '@/utils/education-plan/yearPlanDoc';

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';

/**
 * Xem trước tài liệu trước khi xuất Word / in PDF (Tiền 31/10). file = { html, name } từ yearPlanDoc / classPlanDoc:
 * khung xem trước hiển thị đúng HTML sẽ xuất nên bản xem trước trùng bản tải về.
 */
export default function DocPreviewModal({ file, onClose }) {
  const { toast } = useEducationPlan();
  return (
    <Modal
      title="Xem trước"
      width={1100}
      className="ga-doc-preview-modal"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="btn" onClick={() => printDoc(file.html) || toast(POPUP_BLOCKED, 'warn')}>
            <Printer size={16} aria-hidden /> In / Lưu PDF
          </button>
          <button type="button" className="btn btn--primary" onClick={() => downloadDoc(file.html, file.name)}>
            <FileDown size={16} aria-hidden /> Xuất Word
          </button>
        </>
      }
    >
      <iframe className="ga-doc-preview" title={`Xem trước ${file.name}`} srcDoc={file.html} />
    </Modal>
  );
}
