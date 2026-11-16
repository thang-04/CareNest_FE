import { Button, SelectField, TextAreaField, TextField } from '@/components';
import { useEffect, useRef, useState } from 'react';
import RecipientTargetForm, { emptyTarget } from './RecipientTargetForm';
import AnnouncementAttachments from './AnnouncementAttachments';
import { announcements } from '@/services/announcement/announcementService';
import { createPreviewCoordinator } from './previewCoordinator.mjs';
import { useAuth } from '@/contexts/AuthContext';

const vietnamInput = (instant) => (instant ? new Date(new Date(instant).getTime() + 7 * 3600000).toISOString().slice(0, 16) : '');
export default function AnnouncementForm({ initial, onSave, busy, serverErrors = {} }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [target, setTarget] = useState(
    initial?.target || { ...emptyTarget, scopeType: user?.role === 'VICE_PRINCIPAL' ? 'CAMPUS' : 'SCHOOL' },
  );
  const [sendAt, setSendAt] = useState(vietnamInput(initial?.sendAt));
  const [keepIds, setKeepIds] = useState((initial?.attachments || []).map((x) => x.id));
  const [files, setFiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const coordinator = useRef(createPreviewCoordinator((selection, options) => announcements.preview(selection, options, user)));
  useEffect(() => {
    let active = true;
    const request = coordinator.current;
    announcements
      .templates(user)
      .then((x) => {
        if (active) setTemplates(x);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      request.invalidate();
    };
  }, [user]);
  const updateTarget = (next) => {
    coordinator.current.invalidate();
    setPreview(null);
    setTarget(next);
  };
  const loadPreview = async () => {
    setPreview(null);
    setError('');
    try {
      const result = await coordinator.current.run(target);
      if (result) setPreview(result);
    } catch (e) {
      setError(e.message);
    }
  };
  const submit = (e) => {
    e.preventDefault();
    if (!preview?.total) {
      setError('Hãy xem trước và chọn ít nhất một người nhận.');
      return;
    }
    if (files.length + keepIds.length > 5) {
      setError('Tối đa 5 tệp đính kèm.');
      return;
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024 || !/\.(jpe?g|png|pdf)$/i.test(file.name))) {
      setError('Tệp phải là JPG, PNG hoặc PDF và không quá 10 MB.');
      return;
    }
    const instant = sendAt ? new Date(`${sendAt}:00+07:00`) : null;
    if (instant && Number.isNaN(instant.getTime())) {
      setError('Giờ gửi không hợp lệ.');
      return;
    }
    onSave({ title, body, target, sendAt: instant?.toISOString() || null, keepAttachmentIds: keepIds }, files);
  };
  return (
    <form className="card card__body stack gap-4" onSubmit={submit}>
      <label className="field">
        Dùng mẫu{' '}
        <SelectField
          className="select"
          defaultValue=""
          onChange={(e) => {
            const item = templates.find((t) => String(t.id) === e.target.value);
            if (item) {
              setTitle(item.title);
              setBody(item.body);
            }
          }}
        >
          <option value="">Không chọn</option>
          {templates.map((t) => (
            <option value={t.id} key={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      </label>
      <label className="field">
        Tiêu đề{' '}
        <TextField
          className="input"
          required
          aria-invalid={!!serverErrors.title}
          maxLength={150}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {serverErrors.title && <span className="field__error">{serverErrors.title}</span>}
      </label>
      <label className="field">
        Nội dung{' '}
        <TextAreaField
          className="textarea"
          required
          aria-invalid={!!serverErrors.body}
          maxLength={4000}
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {serverErrors.body && <span className="field__error">{serverErrors.body}</span>}
      </label>
      <RecipientTargetForm value={target} onChange={updateTarget} />
      {serverErrors.target && <p className="field__error">{serverErrors.target}</p>}
      <Button type="button" className="btn" onClick={loadPreview}>
        Xem trước người nhận
      </Button>
      {preview && (
        <p>
          Tổng số người nhận: {preview.total}{' '}
          {Object.entries(preview.byRole || {})
            .map(([role, count]) => `${role}: ${count}`)
            .join(' · ')}
        </p>
      )}
      <label className="field">
        Hẹn gửi (giờ Việt Nam; để trống để gửi ngay){' '}
        <TextField className="input" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
        {serverErrors.sendAt && <span className="field__error">{serverErrors.sendAt}</span>}
      </label>
      <AnnouncementAttachments existing={initial?.attachments} keepIds={keepIds} onKeepChange={setKeepIds} onFilesChange={setFiles} />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy || !preview?.total}>
        {busy ? 'Đang lưu…' : 'Lưu thông báo'}
      </Button>
    </form>
  );
}
