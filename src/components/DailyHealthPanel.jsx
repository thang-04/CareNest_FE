import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Save, ArrowRight, Clock, CheckCircle2, Phone, ChevronDown, ChevronUp } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { EmptyState, ErrorState, LoadingState, SubmitOverlay } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { getDailyHealth, notifyDailyHealth } from '@/services/dailyHealthService';
import { HEALTH_ACTIONS, HEALTH_SYMPTOMS, actionSummary, validateDailyHealth } from '@/utils/dailyHealthValidation';
import { temperatureLevel } from '@/utils/attendance/temperatureLevels';
import { TemperatureBadge } from '@/components/attendance/TemperatureBadge';
import { HealthObservationBadge, ParentNotifyBadge, ParentNotifyShortBadge } from '@/components/attendance/AttendanceBadges';
import { formatDateTime } from '@/utils/format';
import { ChildAvatar } from '@/components/ChildAvatar';
import { useToast } from '@/contexts/ToastContext';

const blank = () => ({
  temperature: '',
  observation: '',
  symptoms: [],
  note: '',
  actions: [],
  referral: { place: '', time: '', escort: '' },
});
// Giờ hiện tại hh:mm (giờ máy) để điền sẵn giờ đón / giờ chuyển
const nowTime = () => new Date().toTimeString().slice(0, 5);

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
  const dirty = !!(form.temperature || form.observation || form.symptoms.length || form.note || form.actions.length);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);

  const set = (key, value) => {
    requestId.current = crypto.randomUUID();
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'observation' && value === 'NO_CONCERN' ? { symptoms: [], actions: [] } : {}),
    }));
    setErrors({});
  };
  const toggleAction = (value, checked) => {
    const actions = checked ? [...form.actions, value] : form.actions.filter((a) => a !== value);
    set('actions', actions);
    // Tích đón về sớm / chuyển cơ sở y tế thì điền sẵn giờ hiện tại
    if (checked && value === 'REFERRAL' && !form.referral.time) set('referral', { ...form.referral, time: nowTime() });
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
        attendanceDirty ? 'Đã lưu điểm danh, sức khỏe và gửi thông báo phụ huynh.' : 'Đã lưu lần ghi nhận và gửi thông báo phụ huynh.',
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
      toast.error(err, err.healthSaved ? 'Chưa tạo được thông báo' : 'Chưa lưu được sức khỏe');
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
                <FormField label="Thân nhiệt (°C)" error={errors.temperature}>
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
                {form.observation === 'NOTED' && (
                  <fieldset className="dd-health__fields">
                    <legend className="field__label">Xử trí</legend>
                    <div className="dd-health__symptoms">
                      {Object.entries(HEALTH_ACTIONS).map(([value, label]) => (
                        <label className={`dd-health__option ${form.actions.includes(value) ? 'is-selected' : ''}`} key={value}>
                          <input
                            type="checkbox"
                            checked={form.actions.includes(value)}
                            onChange={(event) => toggleAction(value, event.target.checked)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {errors.actions && <div className="field__error">{errors.actions}</div>}
                    {form.actions.includes('REFERRAL') && (
                      <div className="dd-health__sub">
                        <FormField label="Nơi chuyển đến" required error={errors.referral}>
                          <input
                            className="input"
                            maxLength={150}
                            value={form.referral.place}
                            placeholder="Ví dụ: Trạm y tế phường"
                            onChange={(e) => set('referral', { ...form.referral, place: e.target.value })}
                          />
                        </FormField>
                        <FormField label="Giờ" required>
                          <input
                            type="time"
                            className="input"
                            value={form.referral.time}
                            onChange={(e) => set('referral', { ...form.referral, time: e.target.value })}
                          />
                        </FormField>
                        <FormField label="Người đi cùng">
                          <input
                            className="input"
                            maxLength={100}
                            value={form.referral.escort}
                            onChange={(e) => set('referral', { ...form.referral, escort: e.target.value })}
                          />
                        </FormField>
                      </div>
                    )}
                  </fieldset>
                )}
                <FormField label="Ghi chú" error={errors.note}>
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
              </fieldset>
            </form>
          )}
          <section className="dd-health__history" aria-labelledby="health-history-heading">
            <h3 id="health-history-heading" className="dd-health__name">
              Các lần ghi nhận trong ngày đã chọn
            </h3>
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
                        {entry.actions?.length > 0 && (
                          <p className="dd-health__action-line">
                            Xử trí: {entry.actions.map((a) => HEALTH_ACTIONS[a]).join(', ')}
                            {entry.actions.includes('EARLY_PICKUP') &&
                              (entry.earlyPickup
                                ? ` · ${entry.earlyPickup.relation} ${entry.earlyPickup.fullName} đã đón lúc ${entry.earlyPickup.time}`
                                : ' · chờ phụ huynh đến đón')}{' '}
                            {entry.actions.includes('EARLY_PICKUP') && (
                              <Link to={`/pickup?classId=${classId}&date=${date}`} className="text-sm">
                                {entry.earlyPickup ? 'Xem ở Đón trẻ' : 'Trả trẻ ở Đón trẻ'}
                              </Link>
                            )}
                            {entry.referral &&
                              ` · chuyển ${entry.referral.place} lúc ${entry.referral.time}${entry.referral.escort ? `, đi cùng ${entry.referral.escort}` : ''}`}
                          </p>
                        )}
                        {entry.notificationStatus !== 'NOT_REQUIRED' && (
                          <div className="dd-health__actions">
                            <ParentNotifyBadge status={entry.notificationStatus === 'DEMO_QUEUED' ? 'DEMO_QUEUED' : 'PENDING'} />
                            {entry.notificationStatus === 'DEMO_QUEUED' && entry.parentNotifications?.[0] && (
                              <span className="muted text-sm">{formatDateTime(entry.parentNotifications[0].createdAt)}</span>
                            )}
                            {entry.notificationStatus !== 'DEMO_QUEUED' && (
                              <button className="btn btn--sm" type="button" disabled={busy || parentBusy} onClick={() => resend(entry)}>
                                Gửi lại thông báo
                              </button>
                            )}
                          </div>
                        )}
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
                          <HealthObservationBadge status={entry.observation === 'NO_CONCERN' ? 'NO_CONCERN' : 'NOTED'} />
                          <span className="dd-health__compact-text">
                            {[
                              entry.symptoms.map((item) => HEALTH_SYMPTOMS[item]).join(', '),
                              entry.actions?.length ? actionSummary([entry]) : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                          {!['DEMO_QUEUED', 'NOT_REQUIRED'].includes(entry.notificationStatus) && (
                            <ParentNotifyShortBadge status="PENDING" />
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
