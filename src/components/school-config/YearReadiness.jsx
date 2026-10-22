import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Play } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { useYearReadiness } from '@/hooks/school-config/useSchoolConfig';
import { activateSchoolYear } from '@/services/school-config/schoolConfigService';
import { READINESS_STEPS } from '@/models/school-config/schoolConfigConstants';
import { formatDate } from '@/utils/format';

const STEP_LINK = Object.fromEntries(READINESS_STEPS.map((s) => [s.key, s]));

/** "Chuẩn bị năm học" card of a planned year: steps computed by the backend, each with a link to its screen. */
export function YearReadinessCard({ year, onActivate }) {
  const { readiness, loading, error, reload } = useYearReadiness(year.id);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const steps = readiness?.steps || [];
  const required = steps.filter((s) => s.required);
  const done = required.filter((s) => s.ok).length;
  const reason = readiness?.canActivate
    ? 'Đã đủ điều kiện kích hoạt.'
    : readiness
      ? `Kích hoạt được từ ${formatDate(readiness.openFrom)} khi xong ${required.length - done} bước bắt buộc còn lại.`
      : '';
  return (
    <section className="card sc-ready" aria-label={`Chuẩn bị năm học ${year.name}`}>
      <div className="sc-ready__head">
        <div className="sc-ready__title">
          <h2 className="section-title">
            Chuẩn bị năm học {year.name} <YearStatusBadge status={year.status} />
          </h2>
          <span className="muted text-sm">
            {formatDate(year.startDate)} – {formatDate(year.endDate)}
          </span>
        </div>
        <div className="sc-ready__activate">
          <button className="btn btn--primary" disabled={!readiness?.canActivate} title={reason} onClick={() => onActivate(year)}>
            <Play size={16} /> Kích hoạt năm học
          </button>
          <span className="muted text-xs">{reason}</span>
        </div>
      </div>
      {loading && !readiness ? (
        <Spinner deferred />
      ) : (
        <>
          <ProgressBar value={done} total={required.length} label={`${done}/${required.length} bước bắt buộc`} />
          <ul className="sc-ready__steps">
            {steps.map((s) => (
              <li key={s.key} className="sc-ready__step">
                <span className={`sc-ready__dot ${s.ok ? 'sc-ready__dot--ok' : s.required ? 'sc-ready__dot--todo' : 'sc-ready__dot--opt'}`}>
                  {s.ok ? <CheckCircle2 size={16} aria-label="Đã xong" /> : <AlertTriangle size={16} aria-label="Chưa xong" />}
                </span>
                <b className="sc-ready__label">
                  {s.label}
                  {!s.required && <span className="muted text-xs"> · khuyến nghị</span>}
                </b>
                <span className="muted text-sm sc-ready__detail">{s.detail}</span>
                <Link className={`btn btn--sm sc-ready__go ${s.ok ? '' : 'btn--outline-primary'}`} to={STEP_LINK[s.key].to(year.id)}>
                  {s.ok ? 'Xem' : STEP_LINK[s.key].action}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Activation: lists what changes and asks to type the year name (the backend re-checks every step). */
export function ActivateYearModal({ year, activeYear, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const { readiness } = useYearReadiness(year?.id);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName('');
    setError('');
  }, [year?.id]);

  const submit = async () => {
    if (name.trim() !== year.name) return setError(`Gõ đúng "${year.name}" để xác nhận`);
    setBusy(true);
    try {
      await activateSchoolYear(year.id, { confirmName: name.trim() }, user);
      toast.success(`Đã kích hoạt năm học ${year.name}`);
      onDone();
    } catch (err) {
      toast.error(err, 'Không kích hoạt được năm học');
    } finally {
      setBusy(false);
    }
    return null;
  };

  return (
    <Modal
      open={!!year}
      title={year ? `Kích hoạt năm học ${year.name}?` : ''}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Quay lại
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={busy || !readiness?.canActivate || name.trim() !== year?.name}>
            {busy ? <Spinner small /> : <Play size={16} />} Kích hoạt năm học
          </button>
        </>
      }
    >
      {year && (
        <>
          {readiness && !readiness.canActivate && (
            <div className="alert alert--danger mb-12" role="alert">
              <AlertTriangle size={18} />
              <div>
                <b>Chưa kích hoạt được:</b>
                <ul className="sc-ready__list">
                  {readiness.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <p className="text-2">Khi kích hoạt:</p>
          <ul className="sc-ready__list">
            {activeYear && (
              <li>
                Năm học <b>{activeYear.name}</b> kết thúc; lớp và phân công của năm đó chỉ còn xem.
              </li>
            )}
            <li>
              {readiness?.impact.move ?? 0} trẻ chuyển sang lớp năm mới, {readiness?.impact.leave ?? 0} trẻ nghỉ học / ra trường theo bản
              xếp lớp.
            </li>
            <li>Phân công Phó hiệu trưởng, giáo viên, tổ trưởng của năm {year.name} có hiệu lực.</li>
            <li>Điểm danh, suất ăn, sức khỏe trong ngày dùng lớp của năm {year.name}.</li>
          </ul>
          <FormField label={`Gõ "${year.name}" để xác nhận`} required error={error} className="mt-12">
            <input
              className="input"
              value={name}
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
            />
          </FormField>
        </>
      )}
    </Modal>
  );
}
