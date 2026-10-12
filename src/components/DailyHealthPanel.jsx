import { useEffect, useRef, useState } from 'react';
import { HeartPulse, Save, ArrowRight, Clock, CheckCircle2 } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState, SubmitOverlay } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { getDailyHealth, notifyDailyHealth } from '@/services/dailyHealthService';
import { HEALTH_SYMPTOMS, validateDailyHealth } from '@/utils/dailyHealthValidation';
import { formatDateTime, initials, avatarTone } from '@/utils/format';
import { useToast } from '@/contexts/ToastContext';

const blank = () => ({ temperature: '', observation: '', symptoms: [], note: '' });

export function DailyHealthPanel({
  child,
  classId,
  className,
  date,
  user,
  presentSaved,
  presentDraft,
  canDraft,
  attendanceDirty,
  parentBusy,
  onSave,
  onDirty,
  onBusy,
  onNext,
}) {
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const submitRef = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const { data, loading, error, reload } = useAsync(
    () => getDailyHealth({ classId, childId: child.id, date }, user),
    [classId, child.id, date, user.id, presentSaved],
  );
  const dirty = !!(form.temperature || form.observation || form.symptoms.length || form.note);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);

  const set = (key, value) => {
    requestId.current = crypto.randomUUID();
    setForm((current) => ({ ...current, [key]: value, ...(key === 'observation' && value === 'NO_CONCERN' ? { symptoms: [] } : {}) }));
    setErrors({});
  };
  const editable = presentDraft && ((canDraft && !error) || (presentSaved && data?.canRecord)) && !loading && !error;
  const showForm = editable && (adding || dirty || !data?.entries.length || attendanceDirty);
  const save = async (next) => {
    if (submitRef.current || parentBusy || !editable) return;
    const invalid = validateDailyHealth(form);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    submitRef.current = true;
    setBusy(true);
    onBusy(true);
    setSaveError('');
    try {
      await onSave({ ...form, classId, childId: child.id, date, requestId: requestId.current });
      setForm(blank());
      setAdding(false);
      requestId.current = crypto.randomUUID();
      onDirty(false);
      toast.success(
        form.observation === 'NOTED'
          ? 'Đã lưu sức khỏe và tạo thông báo phụ huynh (demo, chưa gửi App thật).'
          : attendanceDirty
            ? 'Đã lưu điểm danh và sức khỏe của trẻ.'
            : 'Đã thêm lần ghi nhận sức khỏe.',
      );
      await reload({ silent: true });
      if (next) onNext();
    } catch (err) {
      setErrors(['attendance', 'notification'].includes(err.receptionStage) ? {} : err.details || {});
      if (err.healthSaved) {
        setForm(blank());
        setAdding(false);
        onDirty(false);
        requestId.current = crypto.randomUUID();
      }
      setSaveError(
        err.healthSaved
          ? `Điểm danh và sức khỏe đã lưu, nhưng chưa tạo được thông báo: ${err.message} Bấm Gửi lại thông báo ở lần ghi nhận bên dưới, không cần đo lại.`
          : err.attendanceSaved
            ? `Điểm danh đã lưu. Sức khỏe chưa lưu: ${err.message} Thông tin đang nhập được giữ lại; hãy lưu lại sức khỏe.`
            : `Chưa lưu sức khỏe: ${err.message} Thông tin đang nhập được giữ lại.`,
      );
      toast.error(err.message, err.healthSaved ? 'Chưa tạo được thông báo' : 'Chưa lưu được sức khỏe');
      await reload({ silent: true });
    } finally {
      submitRef.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  const resend = async (entry) => {
    if (submitRef.current || parentBusy) return;
    submitRef.current = true;
    setBusy(true);
    onBusy(true);
    try {
      await notifyDailyHealth(entry.id, user);
      setSaveError('');
      toast.success('Đã tạo thông báo phụ huynh trong demo, không thêm lần ghi nhận sức khỏe.');
      await reload({ silent: true });
    } catch (err) {
      setSaveError(`Sức khỏe vẫn đã lưu. Chưa tạo được thông báo: ${err.message}`);
    } finally {
      submitRef.current = false;
      setBusy(false);
      onBusy(false);
    }
  };

  return (
    <section className="card dd-health" aria-labelledby="daily-health-heading">
      <div className="card__header">
        <h2 id="daily-health-heading" className="card__title">
          <HeartPulse size={20} /> Sức khỏe trong ngày
        </h2>
        <span className="chip chip--gray">
          <Clock size={14} /> {data?.entries.length || 0} lần ghi nhận
        </span>
      </div>
      <div className="dd-health__identity">
        <span className={`avatar avatar--lg avatar--tone-${avatarTone(child.fullName)}`} aria-hidden="true">
          {initials(child.fullName)}
        </span>
        <div>
          <h3 className="dd-health__name">{child.fullName}</h3>
          <div className="muted text-sm">
            {child.code} · {className}
          </div>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          {!editable && (
            <div className="alert alert--info">
              <HeartPulse size={18} />
              <div>
                {presentDraft
                  ? 'Chỉ thêm ghi nhận cho ngày hôm nay. Bạn vẫn có thể xem lịch sử.'
                  : 'Chọn Có mặt trong danh sách để nhập sức khỏe ngay.'}
              </div>
            </div>
          )}
          {saveError && (
            <div className="alert alert--danger mb-12" role="alert">
              {saveError}
            </div>
          )}
          {editable && !showForm && (
            <button className="btn btn--primary" type="button" disabled={busy || parentBusy} onClick={() => setAdding(true)}>
              <HeartPulse size={16} /> Thêm lần ghi nhận
            </button>
          )}
          {showForm && (
            <form
              className="dd-health__form"
              onSubmit={(event) => {
                event.preventDefault();
                save(false);
              }}
            >
              {busy && <SubmitOverlay state="sending" />}
              <fieldset disabled={busy || parentBusy} className="dd-health__fields">
                {attendanceDirty && (
                  <p className="muted text-sm">Chưa lưu điểm danh của trẻ. Nút bên dưới sẽ lưu điểm danh trước, rồi lưu sức khỏe.</p>
                )}
                <FormField label="Thân nhiệt (°C)" hint="Không bắt buộc · để trống nếu chưa đo" error={errors.temperature}>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={form.temperature}
                    placeholder="Ví dụ: 36,8"
                    onChange={(event) => set('temperature', event.target.value)}
                  />
                </FormField>
                <fieldset className="dd-health__fields" aria-describedby={errors.observation ? 'health-observation-error' : undefined}>
                  <legend className="field__label">
                    Quan sát ban đầu <span className="req">*</span>
                  </legend>
                  <div className="dd-health__observations">
                    {[
                      ['NO_CONCERN', 'Không ghi nhận bất thường'],
                      ['NOTED', 'Có dấu hiệu cần lưu ý'],
                    ].map(([value, label]) => (
                      <label className={`dd-health__option ${form.observation === value ? 'is-selected' : ''}`} key={value}>
                        <input
                          type="radio"
                          name={`observation-${child.id}`}
                          value={value}
                          checked={form.observation === value}
                          onChange={() => set('observation', value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {errors.observation && (
                    <div id="health-observation-error" className="field__error" role="alert">
                      {errors.observation}
                    </div>
                  )}
                </fieldset>
                {form.observation === 'NOTED' && (
                  <fieldset className="dd-health__fields">
                    <legend className="field__label">Biểu hiện ghi nhận</legend>
                    <div className="dd-health__symptoms">
                      {Object.entries(HEALTH_SYMPTOMS).map(([value, label]) => (
                        <label className={`dd-health__option ${form.symptoms.includes(value) ? 'is-selected' : ''}`} key={value}>
                          <input
                            type="checkbox"
                            checked={form.symptoms.includes(value)}
                            onChange={(event) =>
                              set(
                                'symptoms',
                                event.target.checked ? [...form.symptoms, value] : form.symptoms.filter((item) => item !== value),
                              )
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <FormField label="Ghi chú" error={errors.note} hint="Ghi nhận quan sát và việc đã thực hiện; không tự chẩn đoán.">
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={500}
                    value={form.note}
                    placeholder="Quan sát hoặc lời dặn của phụ huynh"
                    onChange={(event) => set('note', event.target.value)}
                  />
                </FormField>
                {form.observation === 'NOTED' && (
                  <div>
                    <button className="btn" type="button" onClick={() => setContactOpen(true)}>
                      Liên hệ phụ huynh
                    </button>
                  </div>
                )}
                <div className="dd-health__actions">
                  <button className="btn" type="submit" disabled={!dirty}>
                    <Save size={16} /> {attendanceDirty ? 'Lưu điểm danh & sức khỏe' : 'Lưu lần ghi nhận'}
                  </button>
                  <button className="btn btn--primary" type="button" disabled={!dirty} onClick={() => save(true)}>
                    Lưu & trẻ tiếp theo <ArrowRight size={16} />
                  </button>
                </div>
                {form.observation === 'NOTED' && (
                  <span className="muted text-xs">Khi lưu sẽ tạo thông báo phụ huynh (demo, chưa gửi App thật).</span>
                )}
              </fieldset>
            </form>
          )}
          <section className="dd-health__history" aria-labelledby="health-history-heading">
            <h3 id="health-history-heading" className="dd-health__name">
              Các lần ghi nhận trong ngày đã chọn
            </h3>
            <p className="muted text-sm">Mỗi lần ghi nhận được lưu riêng, kể cả sau giờ khóa điểm danh.</p>
            {!data?.entries.length ? (
              <EmptyState title="Chưa có lần ghi nhận" description="Lần kiểm tra đã lưu sẽ hiển thị tại đây." />
            ) : (
              <ol className="dd-health__timeline">
                {data.entries.map((entry) => (
                  <li key={entry.id}>
                    <div className="row row--wrap">
                      <CheckCircle2 size={16} />
                      <strong>{formatDateTime(entry.recordedAt)}</strong>
                      <span>{entry.temperature === null ? 'Chưa đo thân nhiệt' : `${entry.temperature.toLocaleString('vi-VN')} °C`}</span>
                    </div>
                    <p>
                      {entry.observation === 'NO_CONCERN' ? 'Không ghi nhận bất thường' : 'Có dấu hiệu cần lưu ý'}
                      {entry.symptoms.length ? ` · ${entry.symptoms.map((item) => HEALTH_SYMPTOMS[item]).join(', ')}` : ''}
                    </p>
                    {entry.note && <p>{entry.note}</p>}
                    {entry.observation === 'NOTED' && (
                      <div className="dd-health__actions">
                        <span className={`chip ${entry.notificationStatus === 'DEMO_QUEUED' ? 'chip--blue' : 'chip--orange'}`}>
                          {entry.notificationStatus === 'DEMO_QUEUED' ? 'Đã tạo thông báo (demo)' : 'Chưa tạo thông báo phụ huynh'}
                        </span>
                        {entry.notificationStatus !== 'DEMO_QUEUED' && (
                          <button className="btn btn--sm" type="button" disabled={busy || parentBusy} onClick={() => resend(entry)}>
                            Gửi lại thông báo
                          </button>
                        )}
                      </div>
                    )}
                    <div className="muted text-sm">Ghi nhận bởi {entry.recordedByName}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
      <Modal
        open={contactOpen}
        title="Liên hệ phụ huynh"
        size="sm"
        onClose={() => setContactOpen(false)}
        footer={
          <button className="btn" type="button" onClick={() => setContactOpen(false)}>
            Đóng
          </button>
        }
      >
        <p className="muted text-sm">Phụ huynh của {child.fullName}</p>
        {!data?.contacts?.length ? (
          <p>Chưa có thông tin liên hệ phụ huynh trong hồ sơ trẻ.</p>
        ) : (
          <div className="dd-health__contact">
            {data.contacts.map((contact, index) => (
              <div className="dd-health__contact-person" key={`${contact.email || contact.phone}:${index}`}>
                <div>
                  <strong>{contact.fullName}</strong>
                  <div className="muted text-sm">
                    {contact.relation} · {contact.phone || 'Chưa có số điện thoại'}
                  </div>
                </div>
                {contact.phone && (
                  <a className="btn btn--sm" href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>
                    Gọi
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </section>
  );
}
