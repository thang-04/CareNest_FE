import { Button, EmptyState } from '@/components';
import { FileInput } from '@/components/form/FileInput';
import { useEffect, useId, useRef, useState } from 'react';
import { Download, FileText, Upload, Trash2, RotateCcw } from '@/components/ui/icons';
import { formatFileSize } from '@/utils/format';
import { announcements } from '@/services/announcement/announcementService';
import { validateAnnouncementFiles } from './prepareSubmission.mjs';

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
  const [downloading, setDownloading] = useState(null);
  const urls = useRef(new Set());
  const count = keepIds.length + files.length;
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
        <>
          <div className="announcement-upload-heading">
            <span className="chip chip--gray" role="status" aria-live="polite">
              {count}/5 tệp đã chọn
            </span>
            <Button
              variant="outline-primary"
              size="sm"
              icon={Upload}
              disabled={count >= 5}
              onClick={() => document.getElementById(id)?.click()}
              aria-describedby={`${id}-hint`}
            >
              Thêm tệp
            </Button>
            <FileInput
              id={id}
              className="sr-only"
              tabIndex={-1}
              aria-label="Chọn tệp đính kèm"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              disabled={count >= 5}
              aria-describedby={`${id}-hint`}
              onChange={(e) => {
                const added = [...(e.target.files || [])];
                e.target.value = '';
                if (added.length) changeFiles([...files, ...added]);
              }}
            />
          </div>
          <p id={`${id}-hint`} className="announcement-upload-hint muted text-sm">
            JPG, PNG hoặc PDF · tối đa 10 MB/tệp. Tệp được tải lên khi bạn xác nhận gửi/lưu.
          </p>
          {count === 0 && existing.length === 0 && (
            <div className="announcement-upload-empty">
              <EmptyState title="Chưa có tệp đính kèm" description="Bấm Thêm tệp để chọn ảnh hoặc tài liệu từ máy." />
            </div>
          )}
        </>
      )}
      {readOnly && existing.length === 0 && <p className="muted text-sm">Không có tệp đính kèm.</p>}
      <ul className="announcement-file-list" aria-label="Danh sách tệp đính kèm">
        {existing.map((file) => (
          <li className={`announcement-file${!readOnly && !keepIds.includes(file.id) ? ' announcement-file--removed' : ''}`} key={file.id}>
            <FileText size={18} aria-hidden="true" />
            <span className="announcement-file__name">
              {file.fileName}
              <span className="muted text-sm">{file.sizeBytes != null ? ` · ${formatFileSize(file.sizeBytes)}` : ''}</span>
              {!readOnly && !keepIds.includes(file.id) && <span className="muted text-sm"> · Sẽ bỏ khi lưu</span>}
            </span>
            <Button
              variant="outline-primary"
              icon={Download}
              size="sm"
              disabled={downloading !== null}
              loading={downloading === file.id}
              onClick={() => download(file)}
              aria-label={`Tải ${file.fileName}`}
            >
              Tải tệp
            </Button>
            {!readOnly && (
              <Button
                size="sm"
                icon={keepIds.includes(file.id) ? Trash2 : RotateCcw}
                variant={keepIds.includes(file.id) ? 'outline-danger' : 'outline-primary'}
                aria-label={`${keepIds.includes(file.id) ? 'Bỏ' : 'Giữ lại'} tệp ${file.fileName}`}
                onClick={() =>
                  changeFiles(files, keepIds.includes(file.id) ? keepIds.filter((key) => key !== file.id) : [...keepIds, file.id])
                }
              >
                {keepIds.includes(file.id) ? 'Bỏ' : 'Giữ lại'}
              </Button>
            )}
          </li>
        ))}
        {!readOnly &&
          files.map((file, index) => (
            <li className="announcement-file" key={`${file.name}-${index}`}>
              <FileText size={18} aria-hidden="true" />
              <span className="announcement-file__name">
                {file.name}
                <span className="muted text-sm"> · {formatFileSize(file.size)} · Chờ tải lên</span>
              </span>
              <Button
                size="sm"
                icon={Trash2}
                variant="outline-danger"
                aria-label={`Bỏ tệp ${file.name}`}
                onClick={() => changeFiles(files.filter((_, i) => i !== index))}
              >
                Bỏ
              </Button>
            </li>
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
