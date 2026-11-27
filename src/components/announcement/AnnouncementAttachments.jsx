import { Button } from '@/components';
import { FileInput } from '@/components/form/FileInput';
import { useEffect, useId, useRef, useState } from 'react';
import { Download, FileImage, FileText, RotateCcw, UploadCloud, X } from '@/components/ui/icons';
import { formatFileSize } from '@/utils/format';
import { announcements } from '@/services/announcement/announcementService';
import { validateAnnouncementFiles } from './prepareSubmission.mjs';

const MAX_FILES = 5;

// Cùng bảng icon theo loại tệp với FileUploader dùng chung.
const iconFor = (name) => (/\.pdf$/i.test(name) ? [FileText, 'var(--file-pdf)'] : [FileImage, 'var(--file-image)']);

function FileRow({ name, meta, tone, actions }) {
  const [Icon, color] = iconFor(name);
  return (
    <li className={`file-row${tone ? ` ${tone}` : ''}`}>
      <Icon size={26} color={color} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <span className="file-row__name">{name}</span>
        <span className="muted text-sm">{meta}</span>
      </div>
      {actions}
    </li>
  );
}

/**
 * Tệp đính kèm của thông báo và lịch gửi: vùng kéo thả `.dropzone` và hàng tệp `.file-row` như FileUploader dùng chung.
 * Tệp cũ (đã lưu) có thể tải về, bỏ hoặc giữ lại; tệp mới chỉ tải lên khi người dùng xác nhận gửi/lưu.
 */
export default function AnnouncementAttachments({
  existing = [],
  keepIds = [],
  files = [],
  onKeepChange,
  onFilesChange,
  readOnly = false,
}) {
  const id = useId();
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const urls = useRef(new Set());
  const count = keepIds.length + files.length;
  const full = count >= MAX_FILES;
  const changeFiles = (next, nextKeepIds = keepIds) => {
    try {
      validateAnnouncementFiles(next, nextKeepIds);
      setError('');
      onFilesChange(next);
      if (nextKeepIds !== keepIds) onKeepChange(nextKeepIds);
    } catch (e) {
      setError(e.message);
    }
  };
  const addFiles = (list) => {
    const added = [...(list || [])];
    if (added.length) changeFiles([...files, ...added]);
  };
  useEffect(() => {
    const active = urls.current;
    return () => {
      active.forEach(URL.revokeObjectURL);
      active.clear();
    };
  }, []);
  const download = async (file) => {
    setError('');
    setDownloading(file.id);
    try {
      const blob = await announcements.attachment(file.id);
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }, 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(null);
    }
  };
  return (
    <fieldset className="announcement-fieldset announcement-attachments">
      <legend className="sr-only">Tệp đính kèm</legend>
      {!readOnly && (
        <div className="stack gap-2-5">
          {full ? (
            <p className="muted text-sm" role="status" aria-live="polite">
              {count}/{MAX_FILES} tệp đã chọn. Bỏ bớt một tệp nếu muốn thêm tệp khác.
            </p>
          ) : (
            // Thẻ label bọc ô chọn tệp: bấm hoặc Enter/Space trên ô (đang focus) mở hộp chọn tệp, không cần onClick
            <label
              className={`dropzone${dragging ? ' dropzone--active' : ''}`}
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
            >
              <FileInput
                id={id}
                className="sr-only"
                aria-label="Chọn tệp đính kèm"
                aria-describedby={`${id}-hint`}
                multiple
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => {
                  const added = e.target.files;
                  addFiles(added);
                  e.target.value = '';
                }}
              />
              <UploadCloud size={30} className="text-primary" aria-hidden="true" />
              <div>
                Kéo thả tệp hoặc <span className="text-primary">chọn tệp</span>
              </div>
              <div id={`${id}-hint`} className="muted text-sm">
                (JPG, PNG hoặc PDF · tối đa 10 MB/tệp ·{' '}
                <span role="status" aria-live="polite">
                  {count}/{MAX_FILES} tệp đã chọn
                </span>
                )
              </div>
            </label>
          )}
          <p className="muted text-sm">Tệp được tải lên khi bạn xác nhận gửi/lưu.</p>
        </div>
      )}
      {readOnly && existing.length === 0 && <p className="muted text-sm">Không có tệp đính kèm.</p>}
      <ul className="announcement-file-list" aria-label="Danh sách tệp đính kèm">
        {existing.map((file) => {
          const kept = keepIds.includes(file.id);
          return (
            <FileRow
              key={file.id}
              name={file.fileName}
              tone={!readOnly && !kept ? 'announcement-file--removed' : ''}
              meta={`${file.sizeBytes != null ? formatFileSize(file.sizeBytes) : ''}${!readOnly && !kept ? ' · Sẽ bỏ khi lưu' : ''}`}
              actions={
                <>
                  <Button
                    variant="icon"
                    title="Tải tệp"
                    aria-label={`Tải tệp ${file.fileName}`}
                    loading={downloading === file.id}
                    disabled={downloading !== null}
                    onClick={() => download(file)}
                  >
                    <Download size={18} />
                  </Button>
                  {!readOnly && (
                    <Button
                      variant="icon"
                      title={kept ? 'Bỏ tệp' : 'Giữ lại tệp'}
                      aria-label={`${kept ? 'Bỏ' : 'Giữ lại'} tệp ${file.fileName}`}
                      onClick={() => changeFiles(files, kept ? keepIds.filter((key) => key !== file.id) : [...keepIds, file.id])}
                    >
                      {kept ? <X size={18} /> : <RotateCcw size={18} />}
                    </Button>
                  )}
                </>
              }
            />
          );
        })}
        {!readOnly &&
          files.map((file, index) => (
            <FileRow
              key={`${file.name}-${index}`}
              name={file.name}
              meta={`${formatFileSize(file.size)} · Chờ tải lên`}
              actions={
                <Button
                  variant="icon"
                  title="Bỏ tệp"
                  aria-label={`Bỏ tệp ${file.name}`}
                  onClick={() => changeFiles(files.filter((_, i) => i !== index))}
                >
                  <X size={18} />
                </Button>
              }
            />
          ))}
      </ul>
      {error && (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      )}
    </fieldset>
  );
}
