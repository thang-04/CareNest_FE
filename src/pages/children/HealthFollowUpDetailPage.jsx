import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, HeartPulse, Info, Handshake, FileCheck2, CircleX, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthFollowUp } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { FollowUpLevelShortBadge, FollowUpStatusBadge, MotorResultBadge } from '@/components/children/ChildBadges';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { closeFollowUp, recordFollowUpContact, recordFollowUpExternalResult } from '@/services/children/healthCheckService';
import { SCREENING_CRITERIA_LABELS } from '@/models/children/childrenConstants';
import { FOLLOW_UP_ACTION_LABELS, FOLLOW_UP_STATUS } from '@/models/children/healthCheckConstants';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { hasErrors, validateFollowUpAction } from '@/utils/children/childrenValidation';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const ACCESS_TEXT = {
  forbiddenTitle: 'Bạn không có quyền xem phiếu này',
  forbiddenDescription: 'Phiếu theo dõi chỉ hiển thị trong phạm vi lớp hoặc điểm trường được phân công.',
  notFoundTitle: 'Không tìm thấy phiếu theo dõi',
  notFoundDescription: 'Phiếu có thể ngoài phạm vi của bạn hoặc đường dẫn không đúng.',
  backTo: '/children/health-follow-ups',
  backLabel: 'Về danh sách phiếu',
};

const S = FOLLOW_UP_STATUS;
const ORDER = [S.WAITING_PARENT_CONTACT, S.PARENT_CONTACTED, S.EXTERNAL_RESULT_RECORDED, S.CLOSED];

/** Khối ghi nhận đã có (trao đổi phụ huynh / kết quả khám bên ngoài). */
function EntryView({ entry, dateLabel }) {
  return (
    <dl className="info-list">
      <dt>{dateLabel}</dt>
      <dd>{formatDate(entry.on)}</dd>
      <dt>Nội dung</dt>
      <dd className="tr-pre-line">{entry.note}</dd>
      <dt>Người ghi</dt>
      <dd>
        {entry.byName || '—'} · {formatDateTime(entry.at)}
      </dd>
    </dl>
  );
}

/** Form ghi nhận một bước của phiếu. kind: 'contact' | 'external'. */
function EntryForm({ kind, busy, onSubmit }) {
  const dateField = kind === 'contact' ? 'contactedOn' : 'resultOn';
  const [form, setForm] = useState({ [dateField]: todayInput(), note: '' });
  const [errors, setErrors] = useState({});
  const set = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    const nextErrors = validateFollowUpAction(kind, next);
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => nextErrors[k])));
  };
  const submit = async () => {
    const errs = validateFollowUpAction(kind, form);
    setErrors(errs);
    if (hasErrors(errs)) return;
    const details = await onSubmit(form);
    if (details) setErrors(details);
  };
  return (
    <>
      <div className="grid-2">
        <FormField label={kind === 'contact' ? 'Ngày trao đổi' : 'Ngày khám'} required error={errors[dateField]}>
          <input
            type="date"
            className="input"
            value={form[dateField]}
            max={todayInput()}
            onChange={(e) => set(dateField, e.target.value)}
          />
        </FormField>
      </div>
      <FormField
        label={kind === 'contact' ? 'Nội dung đã trao đổi' : 'Kết quả bác sĩ chuyên khoa báo lại'}
        required
        error={errors.note}
        hint={
          kind === 'contact'
            ? 'Ví dụ: đã gọi điện cho mẹ của trẻ, gửi kết quả khám và đề nghị đưa trẻ đi khám chuyên khoa.'
            : 'Ghi đúng lời bác sĩ phụ huynh báo lại; không tự kết luận hay ghi chẩn đoán thay bác sĩ.'
        }
        className="mt-12"
      >
        <textarea className="textarea" rows={3} maxLength={500} value={form.note} onChange={(e) => set('note', e.target.value)} />
      </FormField>
      <div className="row mt-12 tr-actions-end">
        <button className="btn btn--primary" onClick={submit} disabled={busy}>
          {busy ? <Spinner small /> : <Save size={16} />} {kind === 'contact' ? 'Ghi trao đổi' : 'Ghi kết quả khám'}
        </button>
      </div>
    </>
  );
}

export default function HealthFollowUpDetailPage() {
  const { followUpId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { followUp: f, loading, error, reload } = useHealthFollowUp(followUpId);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(null);

  const crumbs = childrenCrumbs(
    { label: 'Phiếu theo dõi sức khỏe', to: '/children/health-follow-ups' },
    f ? f.child.fullName : 'Chi tiết phiếu',
  );

  if (loading)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (error || !f)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error || { status: 404 }} onRetry={reload} text={ACCESS_TEXT} />
      </div>
    );

  const step = ORDER.indexOf(f.status);
  const closed = f.status === S.CLOSED;
  const steps = [
    { label: 'Mở phiếu', sub: formatDate(f.openedAt.slice(0, 10)), done: true },
    { label: 'Trao đổi phụ huynh', sub: f.contact ? formatDate(f.contact.on) : undefined, done: !!f.contact },
    { label: 'Kết quả khám bên ngoài', sub: f.externalResult ? formatDate(f.externalResult.on) : undefined, done: !!f.externalResult },
    { label: 'Đóng phiếu', sub: f.closedAt ? formatDate(f.closedAt.slice(0, 10)) : undefined, done: closed },
  ];

  // Trả về lỗi trường từ BE để form hiển thị; null khi thành công
  const submit = async (action, body, success) => {
    setBusy(true);
    try {
      await action(f.id, body, user);
      toast.success(success);
      return null;
    } catch (err) {
      toast.error(err.message, 'Không lưu được phiếu theo dõi');
      return err.details || null;
    } finally {
      setBusy(false);
    }
  };

  const doClose = async () => {
    const errs = validateFollowUpAction('close', closing);
    if (hasErrors(errs)) {
      setClosing({ ...closing, error: errs.reason });
      return;
    }
    const details = await submit(closeFollowUp, { reason: closing.reason }, 'Đã đóng phiếu theo dõi.');
    if (details) setClosing({ ...closing, error: details.reason || '' });
    else setClosing(null);
  };

  const todo =
    f.canUpdate &&
    (f.status === S.WAITING_PARENT_CONTACT
      ? 'Trao đổi với phụ huynh về kết quả khám, đề nghị đưa trẻ đi khám chuyên khoa, rồi ghi lại bên dưới.'
      : f.status === S.PARENT_CONTACTED
        ? 'Khi phụ huynh báo kết quả khám chuyên khoa, ghi lại đúng lời bác sĩ bên dưới. Đóng phiếu khi không cần theo dõi thêm.'
        : f.status === S.EXTERNAL_RESULT_RECORDED
          ? 'Đã có kết quả khám bên ngoài. Đóng phiếu khi nhà trường không cần theo dõi thêm, hoặc để mở tới đợt khám sau.'
          : '');

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <div className="row row--wrap gap-2">
          <h1 className="page__title">Phiếu theo dõi: {f.child.fullName}</h1>
          <FollowUpStatusBadge status={f.status} size="lg" />
        </div>
        <Link className="btn" to={`/children/${f.child.id}/health`}>
          <HeartPulse size={16} /> Mở sổ sức khỏe
        </Link>
      </div>

      <section className="card mb-16">
        <ProgressSteps steps={steps} />
      </section>

      {todo && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>{todo}</div>
        </div>
      )}
      {!f.canUpdate && !closed && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>Giáo viên phụ trách lớp của trẻ cập nhật phiếu. Bạn đang xem để theo dõi tiến độ.</div>
        </div>
      )}

      <div className="detail-layout">
        <div className="detail-layout__main">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Kết quả khám liên quan</h2>
            </div>
            <div className="card__body">
              <dl className="info-list mb-12">
                <dt>Trẻ</dt>
                <dd>
                  {f.child.fullName} <span className="muted">({f.child.code})</span>
                </dd>
                <dt>Lớp</dt>
                <dd>
                  {f.child.className || 'Chưa xếp lớp'} · {f.child.campusName}
                </dd>
              </dl>
            </div>
            <div className="table-wrap tr-table-flat">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày đo</th>
                    <th className="right">Vòng đầu (cm)</th>
                    <th>Vận động</th>
                    <th>Mức theo dõi</th>
                  </tr>
                </thead>
                <tbody>
                  {f.measurements.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="fw-600">{formatDate(m.date)}</div>
                        <div className="muted text-xs tr-note">{m.campaignName || 'Ngoài đợt khám'}</div>
                      </td>
                      <td className="right">{formatNumber(m.headCircumferenceCm)}</td>
                      <td>
                        <div className="tr-cell-stack text-sm">
                          <span>Thô: {m.grossMotor ? <MotorResultBadge status={m.grossMotor} /> : '—'}</span>
                          <span>Tinh: {m.fineMotor ? <MotorResultBadge status={m.fineMotor} /> : '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="tr-cell-stack">
                          <FollowUpLevelShortBadge status={m.followUpLevel} />
                          <span className="muted text-xs">
                            {m.criteria
                              .filter((c) => c.flagged)
                              .map((c) => SCREENING_CRITERIA_LABELS[c.key])
                              .join(' · ')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="alert alert--info tr-alert-flat">
              <Info size={18} />
              <div>Mức theo dõi là kết quả sàng lọc theo ngưỡng tham chiếu tạm, không phải chẩn đoán.</div>
            </div>
          </section>

          <section className="card mt-16">
            <div className="card__header row gap-2">
              <Handshake size={18} />
              <h2 className="card__title">Trao đổi với phụ huynh</h2>
            </div>
            <div className="card__body">
              {f.contact ? (
                <EntryView entry={f.contact} dateLabel="Ngày trao đổi" />
              ) : f.canUpdate && step === 0 ? (
                <EntryForm
                  kind="contact"
                  busy={busy}
                  onSubmit={(body) => submit(recordFollowUpContact, body, 'Đã ghi trao đổi với phụ huynh.')}
                />
              ) : (
                <p className="muted m-0">Chưa ghi trao đổi với phụ huynh.</p>
              )}
            </div>
          </section>

          <section className="card mt-16">
            <div className="card__header row gap-2">
              <FileCheck2 size={18} />
              <h2 className="card__title">Kết quả khám bên ngoài</h2>
            </div>
            <div className="card__body">
              {f.externalResult ? (
                <EntryView entry={f.externalResult} dateLabel="Ngày khám" />
              ) : f.canUpdate && step === 1 ? (
                <EntryForm
                  kind="external"
                  busy={busy}
                  onSubmit={(body) => submit(recordFollowUpExternalResult, body, 'Đã ghi kết quả khám bên ngoài.')}
                />
              ) : (
                <p className="muted m-0">
                  {step === 0 && !closed ? 'Ghi trao đổi với phụ huynh trước.' : 'Chưa có kết quả khám bên ngoài.'}
                </p>
              )}
            </div>
          </section>

          {closed && (
            <section className="card mt-16">
              <div className="card__header">
                <h2 className="card__title">Đóng phiếu</h2>
              </div>
              <div className="card__body">
                <dl className="info-list">
                  <dt>Lý do</dt>
                  <dd className="tr-pre-line">{f.closeReason}</dd>
                  <dt>Người đóng</dt>
                  <dd>
                    {f.closedByName || '—'} · {formatDateTime(f.closedAt)}
                  </dd>
                </dl>
              </div>
            </section>
          )}
        </div>
        <aside className="detail-layout__aside">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Lịch sử</h2>
            </div>
            <div className="card__body">
              <ul className="history-list">
                {[...f.history].reverse().map((h, i) => (
                  <li key={`${h.at}${i}`}>
                    <span className="history-list__dot" />
                    <div>
                      <div className="fw-600">{FOLLOW_UP_ACTION_LABELS[h.action] || h.action}</div>
                      <div className="muted text-sm">
                        {h.userName || '—'} · {formatDateTime(h.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>

      <div className="page-actions">
        <Link className="btn" to="/children/health-follow-ups">
          <ArrowLeft size={16} /> Về danh sách phiếu
        </Link>
        {f.canUpdate && !closed && (
          <button className="btn btn--outline-danger" onClick={() => setClosing({ reason: '', error: '' })}>
            <CircleX size={16} /> Đóng phiếu
          </button>
        )}
      </div>

      <Modal
        open={!!closing}
        title="Đóng phiếu theo dõi"
        onClose={busy ? undefined : () => setClosing(null)}
        footer={
          <>
            <button className="btn" onClick={() => setClosing(null)} disabled={busy}>
              Quay lại
            </button>
            <button className="btn btn--danger" onClick={doClose} disabled={busy}>
              {busy ? <Spinner small /> : <CircleX size={16} />} Đóng phiếu
            </button>
          </>
        }
      >
        {closing && (
          <>
            <p className="mb-12">
              Phiếu đã đóng không cập nhật được nữa. Nếu lần khám sau trẻ vẫn ở mức Cần theo dõi sát, hệ thống mở phiếu mới.
            </p>
            <FormField label="Lý do đóng phiếu" required error={closing.error}>
              <textarea
                className="textarea"
                rows={3}
                maxLength={300}
                value={closing.reason}
                onChange={(e) => setClosing({ reason: e.target.value, error: '' })}
              />
            </FormField>
          </>
        )}
      </Modal>
    </div>
  );
}
