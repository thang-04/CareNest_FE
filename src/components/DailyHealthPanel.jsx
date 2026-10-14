import { useEffect, useRef, useState } from 'react';
import { HeartPulse, Save, ArrowRight, Clock, CheckCircle2, Phone, ChevronDown, ChevronUp } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { EmptyState, ErrorState, LoadingState, SubmitOverlay } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { getDailyHealth, notifyDailyHealth } from '@/services/dailyHealthService';
import { HEALTH_SYMPTOMS, validateDailyHealth } from '@/utils/dailyHealthValidation';
import { temperatureLevel } from '@/utils/attendance/temperatureLevels';
import { TemperatureBadge } from '@/components/attendance/TemperatureBadge';
import { formatDateTime } from '@/utils/format';
import { ChildAvatar } from '@/components/ChildAvatar';
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
  // Lần mới nhất hiện đầy đủ; các lần cũ mở từng lần một (accordion), quá 3 lần cũ thì ẩn bớt
  const [expanded, setExpanded] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const toggleEntry = (id) => setExpanded((cur) => (cur === id ? null : id));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  // Ô SĐT bố mẹ thu gọn mặc định; đổi trẻ thì thu lại
  const [contactOpen, setContactOpen] = useState(false);
  useEffect(() => setContactOpen(false), [child.id]);
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
          ? 'Đã lưu sức khỏe và gửi thông báo phụ huynh (demo, chưa gửi App thật).'
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
        <ChildAvatar child={child} size="lg" />
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
          {presentSaved && data?.healthSummary?.reminder && (
            <div className="alert alert--warning mb-12" role="status">
              <HeartPulse size={18} />
              <div>
                <strong>{data.healthSummary.reminder}.</strong>{' '}
                {data.healthSummary.entryCount
                  ? 'Các lần ghi nhận đã lưu chưa có thân nhiệt. Nếu đã đo, thêm một lần ghi nhận để lưu số đo.'
                  : 'Trẻ đang được chọn Có mặt nhưng chưa có lần kiểm tra nào được lưu trong ngày đã chọn.'}
                <div className="text-sm">Đây là nhắc nhở cho cô, không phải dấu hiệu bất thường. Điểm danh vẫn có thể lưu riêng.</div>
              </div>
            </div>
          )}
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
                {temperatureLevel(form.temperature)?.chip && (
                  // Gợi ý mức theo khoảng đo; cô vẫn tự chọn quan sát và biểu hiện
                  <p className="text-sm" role="status">
                    <TemperatureBadge value={Number(form.temperature.trim().replace(',', '.'))} />
                  </p>
                )}
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
                {/* Chỉ xem SĐT bố mẹ từ hồ sơ nhập học; nút Gọi chỉ có trên App */}
                {form.observation === 'NOTED' && (
                  <div>
                    {/* Một nút: bấm mở, bấm lần nữa thu lại */}
                    <button
                      className="btn btn--sm"
                      type="button"
                      aria-expanded={contactOpen}
                      onClick={() => setContactOpen((open) => !open)}
                    >
                      <Phone size={16} /> Liên hệ phụ huynh {contactOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {contactOpen && (
                      <div className="dd-health__contact mt-8" role="group" aria-label="Số điện thoại phụ huynh">
                        {(data?.contacts || []).map((contact, index) => (
                          <div className="dd-health__contact-person" key={`${contact.relation}:${index}`}>
                            <span>
                              {contact.relation} · {contact.fullName || 'Chưa có thông tin'}
                            </span>
                            <span className="dd-health__phone">{contact.phone || 'Chưa có số'}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                  <span className="muted text-xs">Khi lưu sẽ gửi thông báo cho phụ huynh (demo, chưa gửi App thật).</span>
                )}
              </fieldset>
            </form>
          )}
          <section className="dd-health__history" aria-labelledby="health-history-heading">
            <h3 id="health-history-heading" className="dd-health__name">
              Các lần ghi nhận trong ngày đã chọn
            </h3>
            <p className="muted text-sm">Mỗi lần ghi nhận được lưu riêng, kể cả sau giờ khóa điểm danh.</p>
            {data?.entries.filter((e) => Number.isFinite(e.temperature)).length > 1 && (
              <p className="text-sm">
                Thân nhiệt hôm nay:{' '}
                {data.entries
                  .filter((e) => Number.isFinite(e.temperature))
                  .map((e) => e.temperature.toLocaleString('vi-VN'))
                  .reverse()
                  .join(' → ')}{' '}
                °C
              </p>
            )}
            {!data?.entries.length ? (
              <EmptyState title="Chưa có lần ghi nhận" description="Lần kiểm tra đã lưu sẽ hiển thị tại đây." />
            ) : (
              <>
                <ol className="dd-health__timeline">
                  {/* Lần mới nhất hiện đầy đủ; các lần trước gọn 1 dòng, bấm để mở — danh sách không kéo dài */}
                  {data.entries.slice(0, showAll ? undefined : 4).map((entry, index) =>
                    index === 0 || expanded === entry.id ? (
                      <li key={entry.id}>
                        {index === 0 ? (
                          <div className="row row--wrap">
                            <CheckCircle2 size={16} />
                            <strong>{formatDateTime(entry.recordedAt)}</strong>
                            {entry.temperature === null ? <span>Chưa đo thân nhiệt</span> : <TemperatureBadge value={entry.temperature} />}
                          </div>
                        ) : (
                          // Lần cũ đang mở: bấm lại đầu dòng để thu gọn
                          <button
                            type="button"
                            className="dd-health__compact-btn dd-health__compact-btn--open"
                            aria-expanded
                            onClick={() => toggleEntry(entry.id)}
                            title="Bấm để thu gọn"
                          >
                            <strong className="nowrap">{formatDateTime(entry.recordedAt)}</strong>
                            {entry.temperature === null ? (
                              <span className="muted">Chưa đo thân nhiệt</span>
                            ) : (
                              <TemperatureBadge value={entry.temperature} />
                            )}
                            <span className="dd-health__compact-text" />
                            <ChevronUp size={16} aria-hidden="true" />
                          </button>
                        )}
                        <p>
                          {entry.observation === 'NO_CONCERN' ? 'Không ghi nhận bất thường' : 'Có dấu hiệu cần lưu ý'}
                          {entry.symptoms.length ? ` · ${entry.symptoms.map((item) => HEALTH_SYMPTOMS[item]).join(', ')}` : ''}
                        </p>
                        {entry.note && <p>{entry.note}</p>}
                        {entry.observation === 'NOTED' && (
                          <div className="dd-health__actions">
                            <span className={`chip ${entry.notificationStatus === 'DEMO_QUEUED' ? 'chip--blue' : 'chip--orange'}`}>
                              {entry.notificationStatus === 'DEMO_QUEUED'
                                ? `Đã gửi thông báo phụ huynh${entry.parentNotifications?.[0] ? ` · ${formatDateTime(entry.parentNotifications[0].createdAt)}` : ''}`
                                : 'Chưa gửi được thông báo phụ huynh'}
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
                    ) : (
                      <li key={entry.id} className="dd-health__compact">
                        <button
                          type="button"
                          className="dd-health__compact-btn"
                          aria-expanded={false}
                          onClick={() => toggleEntry(entry.id)}
                          title="Xem chi tiết lần ghi nhận"
                        >
                          <span className="nowrap">{formatDateTime(entry.recordedAt).split(' ')[1]}</span>
                          {entry.temperature === null ? (
                            <span className="muted">Chưa đo</span>
                          ) : (
                            <TemperatureBadge value={entry.temperature} showLabel={false} />
                          )}
                          <span className="dd-health__compact-text">
                            {entry.observation === 'NO_CONCERN' ? 'Bình thường' : 'Có dấu hiệu'}
                            {entry.symptoms.length ? ` · ${entry.symptoms.map((item) => HEALTH_SYMPTOMS[item]).join(', ')}` : ''}
                          </span>
                          {entry.observation === 'NOTED' && entry.notificationStatus !== 'DEMO_QUEUED' && (
                            <span className="chip chip--orange">Chưa gửi PH</span>
                          )}
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
                      </li>
                    ),
                  )}
                </ol>
                {data.entries.length > 4 && (
                  <button className="btn btn--sm btn--ghost" type="button" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Ẩn bớt' : `Xem thêm ${data.entries.length - 4} lần`}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
