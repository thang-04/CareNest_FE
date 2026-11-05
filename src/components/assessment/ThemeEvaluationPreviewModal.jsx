import { FileDown, Printer } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { downloadDoc, printDoc } from '@/utils/assessment/themeEvaluationDoc';

/** Xem trước bản in đánh giá cuối chủ đề rồi In / Lưu PDF hoặc Xuất Word; khung xem trước là đúng HTML sẽ in. */
export default function ThemeEvaluationPreviewModal({ file, onClose }) {
  const toast = useToast();
  return (
    <Modal
      open
      size="xl"
      title="Xem trước bản in"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              printDoc(file.html) ||
              toast.error('Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.', 'Chưa mở được trang in')
            }
          >
            <Printer size={16} aria-hidden /> In / Lưu PDF
          </button>
          <button type="button" className="btn btn--primary" onClick={() => downloadDoc(file.html, file.name)}>
            <FileDown size={16} aria-hidden /> Xuất Word
          </button>
        </>
      }
    >
      <div className="dg-doc-preview-scroll">
        <iframe className="dg-doc-preview" title={`Xem trước ${file.name}`} srcDoc={file.html} />
      </div>
    </Modal>
  );
}
