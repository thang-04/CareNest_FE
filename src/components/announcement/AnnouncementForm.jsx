import { Button, ConfirmationModal, PageToolbar, SelectField, TextField } from '@/components';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Save, Send, CalendarClock } from '@/components/ui/icons';
import { AnnouncementAlert, AnnouncementStep } from './announcementUi';
import AnnouncementSummary from './AnnouncementSummary';
import RecipientTargetForm, { emptyTarget } from './RecipientTargetForm';
import AnnouncementAttachments from './AnnouncementAttachments';
import AnnouncementScheduleFields from './AnnouncementScheduleFields';
import { RichTextEditor } from './RichTextEditor';
import { textToHtml } from '@/utils/announcement/richText.mjs';
import { announcements } from '@/services/announcement/announcementService';
import { createPreviewCoordinator } from './previewCoordinator.mjs';
import { prepareAnnouncementSubmission } from './prepareSubmission.mjs';
import { scheduleFieldErrors, scheduleFromInitial, schedulePayload } from '@/utils/announcement/scheduleRecurrence.mjs';
import { useAuth } from '@/contexts/AuthContext';

const vietnamInput = (instant) => (instant ? new Date(new Date(instant).getTime() + 7 * 3600000).toISOString().slice(0, 16) : '');
export default function AnnouncementForm({ initial, onSave, busy, serverErrors = {}, recurring = false, initialTemplateId = '' }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml || textToHtml(initial?.body));
  const [templateId, setTemplateId] = useState(initial?.templateId ?? '');
  const [schedule, setSchedule] = useState(() => scheduleFromInitial(initial));
  const [scheduleErrors, setScheduleErrors] = useState({});
  const [target, setTarget] = useState(
    initial?.target || { ...emptyTarget, scopeType: user?.role === 'VICE_PRINCIPAL' ? 'CAMPUS' : 'SCHOOL' },
  );
  const [sendAt, setSendAt] = useState(vietnamInput(initial?.sendAt));
  const [keepIds, setKeepIds] = useState((initial?.attachments || []).map((x) => x.id));
  const [files, setFiles] = useState([]);
  const [pending, setPending] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState('');
  const [bodyError, setBodyError] = useState('');
  const submitting = useRef(false);
  const coordinator = useRef(createPreviewCoordinator((selection, options) => announcements.preview(selection, options, user)));
  // Mở từ "Tạo lịch gửi từ mẫu này": chọn sẵn mẫu và điền tiêu đề, nội dung (chỉ khi tạo mới).
  const prefillTemplateId = initial ? '' : initialTemplateId;
  useEffect(() => {
    let active = true;
    const request = coordinator.current;
    announcements
      .templates(user)
      .then((x) => {
        if (!active) return;
        setTemplates(x);
        if (!prefillTemplateId) return;
        const chosen = x.find((template) => String(template.id) === String(prefillTemplateId));
        if (!chosen) {
          setError('Không tìm thấy mẫu đã chọn. Hãy chọn mẫu khác hoặc soạn nội dung mới.');
          return;
        }
        setTemplateId(String(chosen.id));
        setTitle(chosen.title);
        setBody(chosen.body);
        setBodyHtml(chosen.bodyHtml || textToHtml(chosen.body));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      request.invalidate();
    };
  }, [user, prefillTemplateId]);
  const updateTarget = (next) => {
    coordinator.current.invalidate();
    setPreview(null);
    setTarget(next);
  };
  const loadPreview = async () => {
    setPreviewBusy(true);
    setPreview(null);
    setError('');
    try {
      const result = await coordinator.current.run(target);
      if (result) setPreview(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setPreviewBusy(false);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy || previewBusy || pending || submitting.current) return;
    if (!body.trim()) {
      setBodyError('Nhập nội dung thông báo.');
      return;
    }
    setBodyError('');
    // Cài đặt lặp sai thì báo ngay dưới từng ô, không gọi xem trước người nhận
    const invalid = recurring ? scheduleFieldErrors(schedule) : {};
    setScheduleErrors(invalid);
    if (Object.keys(invalid).length) {
      setError('Kiểm tra lại cài đặt lặp bên dưới.');
      return;
    }
    submitting.current = true;
    setError('');
    setPreview(null);
    setPreviewBusy(true);
    try {
      const result = await prepareAnnouncementSubmission(
        { title, body, bodyHtml, target, sendAt: recurring ? '' : sendAt, keepIds, files },
        coordinator.current,
      );
      if (result) {
        setPreview(result.preview);
        if (recurring) {
          const value = {
            ...result.data,
            templateId: templateId ? Number(templateId) : null,
            ...schedulePayload(schedule),
          };
          delete value.sendAt;
          setPending(value);
        } else setPending(result.data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      submitting.current = false;
      setPreviewBusy(false);
    }
  };
  const saveLabel = recurring
    ? initial
      ? 'Lưu lịch gửi'
      : 'Tạo lịch gửi'
    : sendAt
      ? initial
        ? 'Lưu thay đổi'
        : 'Hẹn gửi thông báo'
      : 'Gửi thông báo';
  const saveAction = (
    <Button
      type="submit"
      form="announcement-compose"
      variant="primary"
      size="sm"
      icon={recurring ? CalendarClock : initial ? Save : sendAt ? CalendarClock : Send}
      loading={busy || previewBusy}
      disabled={!!pending}
    >
      {saveLabel}
    </Button>
  );
  return (
    <>
      <form id="announcement-compose" className="announcement-form announcement-compose" onSubmit={submit}>
        <PageToolbar
          className="announcement-compose-toolbar"
          aria-label="Thao tác thông báo"
          leading={
            <Link className="btn btn--sm" to={recurring ? '/notification-settings?tab=schedules' : '/announcements'}>
              <ArrowLeft size={15} aria-hidden="true" /> Quay lại
            </Link>
          }
        >
          {saveAction}
        </PageToolbar>
        <AnnouncementAlert>{error}</AnnouncementAlert>
        <div className="announcement-layout">
          <fieldset className="announcement-fieldset announcement-form" disabled={busy || previewBusy || !!pending}>
            <legend className="sr-only">Soạn thông báo</legend>
            <div className="card">
              <div className="card__body announcement-steps">
                <AnnouncementStep step={1} title="Nội dung thông báo" description="Soạn nội dung mới hoặc chọn một mẫu đã lưu.">
                  <div className="announcement-compose-editor">
                    <SelectField
                      fieldClassName="announcement-field--medium"
                      label="Dùng mẫu thông báo"
                      value={templateId}
                      onChange={(e) => {
                        setTemplateId(e.target.value);
                        const item = templates.find((template) => String(template.id) === e.target.value);
                        if (item) {
                          setTitle(item.title);
                          setBody(item.body);
                          setBodyHtml(item.bodyHtml || textToHtml(item.body));
                        }
                      }}
                    >
                      <option value="">Soạn nội dung mới</option>
                      {templates.map((template) => (
                        <option value={template.id} key={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </SelectField>
                    <TextField
                      fieldClassName="announcement-compose-editor__title"
                      label="Tiêu đề"
                      required
                      maxLength={150}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      error={serverErrors.title}
                      hint="Tối đa 150 ký tự."
                    />
                    <RichTextEditor
                      fieldClassName="announcement-compose-editor__body"
                      label="Nội dung"
                      required
                      maxLength={4000}
                      value={bodyHtml}
                      onChange={(html, text) => {
                        setBodyHtml(html);
                        setBody(text);
                        setBodyError('');
                      }}
                      disabled={busy || previewBusy || !!pending}
                      error={serverErrors.body || bodyError}
                    />
                  </div>
                </AnnouncementStep>
                <AnnouncementStep step={2} title="Người nhận" description="Chọn phạm vi và vai trò, sau đó xem trước số người nhận.">
                  <RecipientTargetForm hideLegend value={target} onChange={updateTarget} />
                  {serverErrors.target && (
                    <p className="field__error" role="alert">
                      {serverErrors.target}
                    </p>
                  )}
                  <div className="announcement-preview">
                    <Button icon={Eye} loading={previewBusy} onClick={loadPreview}>
                      Xem trước người nhận
                    </Button>
                    {!preview && (
                      <span className="muted text-sm">Khi bấm gửi, hệ thống sẽ kiểm tra người nhận trước khi bạn xác nhận.</span>
                    )}
                    {preview && (
                      <strong role="status" aria-live="polite">
                        {preview.total} người nhận
                      </strong>
                    )}
                  </div>
                </AnnouncementStep>
                {recurring ? (
                  <AnnouncementStep step={3} title="Lịch gửi">
                    <AnnouncementScheduleFields
                      value={schedule}
                      errors={{ ...scheduleErrors, ...serverErrors }}
                      onChange={(next) => {
                        setSchedule(next);
                        setScheduleErrors({});
                      }}
                    />
                  </AnnouncementStep>
                ) : (
                  <AnnouncementStep step={3} title="Thời gian gửi" description="Để trống thời gian để gửi ngay sau khi xác nhận thao tác.">
                    <TextField
                      fieldClassName="announcement-compose-time"
                      label="Hẹn gửi (giờ Việt Nam)"
                      type="datetime-local"
                      value={sendAt}
                      onChange={(e) => setSendAt(e.target.value)}
                      error={serverErrors.sendAt}
                      hint="Có thể sửa hoặc hủy khi thông báo còn hẹn gửi."
                    />
                  </AnnouncementStep>
                )}
                <AnnouncementStep title="Tệp đính kèm">
                  <AnnouncementAttachments
                    existing={initial?.attachments}
                    keepIds={keepIds}
                    files={files}
                    onKeepChange={setKeepIds}
                    onFilesChange={setFiles}
                  />
                </AnnouncementStep>
              </div>
            </div>
          </fieldset>
          <AnnouncementSummary
            recurring={recurring}
            title={title}
            target={target}
            schedule={schedule}
            sendAt={sendAt}
            preview={preview}
            nextRunAt={initial?.nextRunAt}
            action={saveAction}
          />
        </div>
      </form>
      <ConfirmationModal
        open={!!pending}
        title={`${saveLabel}?`}
        message={
          recurring
            ? `Lịch sẽ gửi theo thời gian đã chọn. Nhóm nhận hiện có ${preview?.total ?? 0} người.`
            : pending?.sendAt
              ? `Thông báo sẽ được hẹn gửi tới nhóm hiện có ${preview?.total ?? 0} người nhận. Danh sách được chốt tại thời điểm gửi.`
              : `Thông báo sẽ được gửi ngay tới nhóm đã chọn, hiện có ${preview?.total ?? 0} người nhận.`
        }
        confirmLabel={saveLabel}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const value = pending;
          setPending(null);
          await onSave(value, files);
        }}
      />
    </>
  );
}
