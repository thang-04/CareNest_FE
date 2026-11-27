import { useId, useRef, useState } from 'react';
import { Button, ConfirmationModal, SelectField, TextField } from '@/components';
import { FileInput } from '@/components/form/FileInput';
import { Upload } from '@/components/ui/icons';
import { AnnouncementAlert } from './announcementUi';
import AnnouncementPreview from './AnnouncementPreview';
import { RichTextEditor } from './RichTextEditor';
import { textToHtml } from '@/utils/announcement/richText.mjs';
import { formatCount } from '@/utils/announcement/templateText.mjs';
import { readTemplateFile, TemplateFileError, TEMPLATE_FILE_ACCEPT } from '@/utils/announcement/readTemplateFile.mjs';

export const TEMPLATE_LIMITS = { name: 100, title: 150, body: 4000 };

/**
 * Form mẫu thông báo trong modal: trái là các ô nhập, phải là xem trước (dưới 768px xem trước nằm dưới form).
 * `viceRole`: Phó hiệu trưởng phải chọn điểm trường; Hiệu trưởng được để trống (toàn trường).
 */
export default function AnnouncementTemplateForm({ id, form, onChange, onSubmit, disabled, campuses, viceRole, error, bodyError }) {
  const fileId = useId();
  const latest = useRef(form);
  latest.current = form;
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(null);
  const set = (key) => (event) => onChange({ ...form, [key]: event.target.value });
  const apply = (result) => {
    setPending(null);
    setFileError('');
    setNotice(`Đã nhập nội dung từ “${result.name}”.`);
    onChange({ ...latest.current, body: result.text, bodyHtml: result.html || textToHtml(result.text) });
  };
  // Tệp lỗi không đổi ô nội dung; nội dung đang có thì hỏi trước khi thay.
  const importFile = async (file) => {
    if (!file || disabled || reading) return;
    setFileError('');
    setNotice('');
    setPending(null);
    setReading(true);
    try {
      const result = await readTemplateFile(file, { maxLength: TEMPLATE_LIMITS.body });
      if (latest.current.body.trim()) setPending(result);
      else apply(result);
    } catch (e) {
      setFileError(e instanceof TemplateFileError ? e.message : 'Không đọc được tệp. Hãy thử lại.');
    } finally {
      setReading(false);
    }
  };
  return (
    <form id={id} className="announcement-form" onSubmit={onSubmit}>
      <AnnouncementAlert>{error}</AnnouncementAlert>
      <div className="announcement-template-layout">
        <div className="announcement-form">
          <div className="announcement-fields">
            <TextField
              disabled={disabled}
              label="Tên mẫu"
              required
              maxLength={TEMPLATE_LIMITS.name}
              value={form.name}
              onChange={set('name')}
            />
            <SelectField
              disabled={disabled}
              label="Phạm vi mẫu"
              required={viceRole}
              value={form.campusId ?? ''}
              onChange={(event) => onChange({ ...form, campusId: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">{viceRole ? 'Chọn điểm trường' : 'Toàn trường'}</option>
              {campuses.map((site) => (
                <option value={site.id} key={site.id}>
                  {site.name}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField
            disabled={disabled}
            label="Tiêu đề thông báo"
            required
            maxLength={TEMPLATE_LIMITS.title}
            value={form.title}
            onChange={set('title')}
            hint={formatCount(form.title, TEMPLATE_LIMITS.title)}
          />
          {!form.readOnly && (
            <div className="announcement-file-import">
              <span className="field__label">File upload</span>
              <div className="announcement-file-import__controls">
                <Button
                  size="sm"
                  icon={Upload}
                  loading={reading}
                  disabled={disabled}
                  aria-describedby={`${fileId}-hint`}
                  onClick={() => document.getElementById(fileId)?.click()}
                >
                  Nhập từ tệp
                </Button>
                <span id={`${fileId}-hint`} className="muted text-sm">
                  .txt hoặc .docx · tối đa {TEMPLATE_LIMITS.body.toLocaleString('vi-VN')} ký tự
                </span>
              </div>
              <FileInput
                id={fileId}
                className="sr-only"
                aria-label="Chọn tệp .txt hoặc .docx để nhập nội dung"
                accept={TEMPLATE_FILE_ACCEPT}
                disabled={disabled || reading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  importFile(file);
                }}
              />
            </div>
          )}
          {fileError && <AnnouncementAlert>{fileError}</AnnouncementAlert>}
          {notice && (
            <p className="muted text-sm" role="status">
              {notice}
            </p>
          )}
          <RichTextEditor
            disabled={disabled}
            label="Nội dung"
            required
            maxLength={TEMPLATE_LIMITS.body}
            value={form.bodyHtml}
            onChange={(html, text) => onChange({ ...latest.current, body: text, bodyHtml: html })}
            error={bodyError}
          />
        </div>
        <AnnouncementPreview title={form.title} body={form.body} bodyHtml={form.bodyHtml} />
      </div>
      <ConfirmationModal
        open={!!pending}
        title="Thay nội dung hiện có?"
        message={`Nội dung đang soạn sẽ được thay bằng nội dung từ tệp “${pending?.name || ''}”. Không thể hoàn tác.`}
        confirmLabel="Thay thế"
        onConfirm={() => apply(pending)}
        onClose={() => setPending(null)}
      />
    </form>
  );
}
