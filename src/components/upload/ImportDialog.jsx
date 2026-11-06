import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, UploadCloud, Upload } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { LottiePlayer } from '@/components/ui/LottiePlayer';
import { useToast } from '@/contexts/ToastContext';

const MAX_SIZE = 10 * 1024 * 1024;
const loadDocumentScan = () => import('@/assets/lottie/document-scan.json');

/**
 * Hộp nhập từ Excel dùng chung (DESIGN §6.3): hướng dẫn + tải tệp mẫu → kéo thả / chọn tệp (≤10MB) → xem trước (children)
 * → Hủy / Xác nhận. Đọc và đối chiếu tệp do màn gọi (`onFile(file)`); hộp chỉ lo bố cục và chọn tệp.
 */
export function ImportDialog({
  open,
  title,
  guide,
  templateHref,
  accept = '.xlsx',
  fileName,
  reading,
  onFile,
  confirmLabel = 'Xác nhận',
  confirmDisabled,
  busy,
  onConfirm,
  onClose,
  children,
}) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const take = (file) => {
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error(`${file.name} vượt quá 10MB`, 'Không đọc được tệp');
      return;
    }
    onFile(file);
  };
  const choose = () => inputRef.current?.click();
  const hasFile = !!fileName && !reading;

  return (
    <Modal
      open={open}
      size="xl"
      title={title}
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={!busy}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={confirmDisabled || busy}>
            {/* Chưa chọn tệp thì không có số dòng để ghi: nút giữ nhãn chung */}
            {busy ? <Spinner small /> : <Upload size={16} />} {hasFile ? confirmLabel : 'Xác nhận'}
          </button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          take(file);
        }}
      />
      <div className="import-guide">
        <div className="import-guide__text">{guide}</div>
        {templateHref && (
          <a className="btn btn--outline-primary" href={templateHref} download>
            <Download size={16} /> Tải xuống tệp mẫu
          </a>
        )}
      </div>

      {hasFile ? (
        <div className="import-file">
          <FileSpreadsheet size={20} aria-hidden="true" />
          <span className="import-file__name">{fileName}</span>
          <button type="button" className="btn btn--sm" onClick={choose} disabled={busy}>
            Chọn tệp khác
          </button>
        </div>
      ) : (
        <div
          className={`dropzone import-drop ${dragging ? 'dropzone--active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={choose}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choose())}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files?.[0]);
          }}
        >
          {reading ? (
            <>
              <LottiePlayer load={loadDocumentScan} speed={0.6} className="import-reading" />
              <span>Đang đọc {fileName}…</span>
            </>
          ) : (
            <>
              <UploadCloud size={48} className="import-drop__icon" aria-hidden="true" />
              <span>
                Kéo thả tệp vào đây hoặc <b>tải lên tệp</b> để xem trước
              </span>
              <span className="text-xs muted">Tệp {accept} có dung lượng tối đa 10MB.</span>
              <span className="btn btn--primary import-drop__btn">
                <Upload size={16} /> Tải lên tệp Excel
              </span>
            </>
          )}
        </div>
      )}

      {hasFile && children}
    </Modal>
  );
}
