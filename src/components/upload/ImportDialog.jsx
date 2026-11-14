import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, UploadCloud, Upload } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/States';
import { LottiePlayer } from '@/components/ui/LottiePlayer';
import { useToast } from '@/contexts/ToastContext';

const MAX_SIZE = 10 * 1024 * 1024;
const loadDocumentScan = () => import('@/assets/lottie/document-scan.json');

/**
 * Hộp nhập từ tệp dùng chung (DESIGN §6.3): hướng dẫn + tải tệp mẫu → tùy chọn (`options`) → kéo thả / chọn tệp → xem trước
 * (children) → Hủy / Xác nhận. Đọc và đối chiếu tệp do màn gọi (`onFile(file)`); hộp chỉ lo bố cục và chọn tệp.
 * `maxSize={null}`: màn gọi tự kiểm dung lượng và báo lỗi trong hộp (kèm `hint` nói rõ giới hạn).
 */
export function ImportDialog({
  open,
  title,
  guide,
  templateHref,
  onTemplate,
  templateLabel = 'Tải xuống tệp mẫu',
  options,
  accept = '.xlsx',
  hint,
  maxSize = MAX_SIZE,
  uploadLabel = 'Tải lên tệp Excel',
  fileName,
  reading,
  onFile,
  confirmLabel = 'Xác nhận',
  idleLabel = 'Xác nhận',
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
    if (maxSize && file.size > maxSize) {
      toast.error(`${file.name} vượt quá ${Math.round(maxSize / 1024 / 1024)}MB`, 'Không đọc được tệp');
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
            {busy ? <Spinner small /> : <Upload size={16} />} {hasFile ? confirmLabel : idleLabel}
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
            <Download size={16} /> {templateLabel}
          </a>
        )}
        {!templateHref && onTemplate && (
          <Button variant="outline-primary" icon={Download} onClick={onTemplate}>
            {templateLabel}
          </Button>
        )}
      </div>
      {options && <div className="import-options">{options}</div>}

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
              <span className="text-xs muted">{hint || `Tệp ${accept} có dung lượng tối đa 10MB.`}</span>
              <span className="btn btn--primary import-drop__btn">
                <Upload size={16} /> {uploadLabel}
              </span>
            </>
          )}
        </div>
      )}

      {hasFile && children}
    </Modal>
  );
}
