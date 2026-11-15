import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LABELS } from '@/components/ui/labels';
import { LINK_ERROR, normalizeLink } from '@/models/education-plan/learningResources.mjs';
import { TextField } from '@/components';

/**
 * Dán link YouTube / Google Drive (BE:EDU-83). Kiểm dạng link khi rời ô để báo lỗi ngay cạnh ô; BE vẫn kiểm lại.
 * Dùng ở mục hoạt động của giáo án ngày và trang Kho học liệu.
 */
export function ResourceLinkForm({ onSubmit, onCancel, busy = false, submitLabel = 'Thêm link' }) {
  const id = useId();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const check = () => {
    const ok = normalizeLink(url);
    setError(url.trim() && !ok ? LINK_ERROR : '');
    return ok;
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!check()) {
      setError(LINK_ERROR);
      return;
    }
    const done = await onSubmit({ url: url.trim(), title: title.trim() || null });
    if (done !== false) {
      setUrl('');
      setTitle('');
    }
  };
  return (
    <form className="ga-resource-link" onSubmit={submit} noValidate>
      <div className="row gap-2 row--wrap">
        <div className="field">
          <label className="field__label" htmlFor={`${id}-url`}>
            Link YouTube hoặc Google Drive
          </label>
          <TextField
            id={`${id}-url`}
            type="url"
            inputMode="url"
            placeholder="https://youtu.be/…"
            value={url}
            maxLength={2000}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError('');
            }}
            onBlur={check}
            autoFocus
          />
          {error && (
            <p id={`${id}-err`} className="field__error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-title`}>
            Tên hiển thị (không bắt buộc)
          </label>
          <TextField id={`${id}-title`} value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      <div className="row gap-2 mt-8">
        <Button type="submit" size="sm" variant="primary" loading={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            {LABELS.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
