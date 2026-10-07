import { useRef, useState } from 'react';
import { UploadCloud, X, FileText, FileArchive, FileImage, FileSpreadsheet, File } from 'lucide-react';
import { formatFileSize } from '@/utils/format';
import { compressImage, isImageFile } from '@/utils/file';
import { uid } from '@/utils/id';
import { useToast } from '@/contexts/ToastContext';

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.rar';

const iconFor = (file) => {
  if (/pdf/.test(file.type) || /\.pdf$/i.test(file.name)) return [FileText, 'var(--file-pdf)'];
  if (/zip|rar/.test(file.type) || /\.(zip|rar)$/i.test(file.name)) return [FileArchive, 'var(--file-archive)'];
  if (/image/.test(file.type)) return [FileImage, 'var(--file-image)'];
  if (/sheet|excel/.test(file.type) || /\.xlsx?$/i.test(file.name)) return [FileSpreadsheet, 'var(--file-sheet)'];
  return [File, 'var(--file-other)'];
};

/**
 * Attachment list with drag & drop. Only metadata is kept for large files;
 * images are downscaled so the demo fits in localStorage.
 * The real API will upload to storage and return a URL instead.
 */
export function FileUploader({ files, onChange, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();

  const addFiles = async (list) => {
    const next = [...files];
    for (const file of Array.from(list)) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} vượt quá 10MB`);
        continue;
      }
      let dataUrl = null;
      if (isImageFile(file)) {
        try {
          dataUrl = await compressImage(file, { maxWidth: 1000, maxHeight: 1000 });
        } catch {
          /* keep metadata only */
        }
      }
      next.push({ id: uid('att'), name: file.name, size: file.size, type: file.type, dataUrl });
    }
    onChange(next);
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      {!disabled && (
        <div
          className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <UploadCloud size={30} className="text-primary" />
          <div>
            Kéo thả file hoặc <span className="text-primary">chọn file</span>
          </div>
          <div className="muted text-sm">(PDF, Word, Excel, ảnh - tối đa 10MB)</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}
      {files.map((f) => {
        const [Icon, color] = iconFor(f);
        return (
          <div key={f.id} className="file-row">
            <Icon size={26} color={color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {f.dataUrl ? (
                <a href={f.dataUrl} download={f.name} className="file-row__name">
                  {f.name}
                </a>
              ) : (
                <div className="file-row__name">{f.name}</div>
              )}
              <div className="muted text-sm">{formatFileSize(f.size)}</div>
            </div>
            {!disabled && (
              <button className="icon-btn" onClick={() => onChange(files.filter((x) => x.id !== f.id))} aria-label={`Xóa ${f.name}`}>
                <X size={18} />
              </button>
            )}
          </div>
        );
      })}
      {disabled && files.length === 0 && <div className="muted">Không có tài liệu đính kèm</div>}
    </div>
  );
}
