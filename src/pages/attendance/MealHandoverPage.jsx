import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChefHat, PackageCheck, PackagePlus, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useClasses } from '@/hooks/useSchool';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { HandoverStatusBadge } from '@/components/attendance/AttendanceBadges';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { useMealHandovers } from '@/hooks/attendance/useAttendance';
import { confirmHandover, reportHandoverShortage, supplementHandover } from '@/services/attendance/attendanceService';
import { ROLES } from '@/models/User';
import { HANDOVER_STATUS, MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { canReceiveHandover, canSupplementHandover } from '@/utils/attendance/attendancePermissions';
import { validateHandoverCheck } from '@/utils/attendance/attendanceValidation';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { formatDate, formatDateTime } from '@/utils/format';
import '@/styles/modules/attendance.css';

function CheckModal({ handover, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    normal: String(handover.expected.normal),
    substitute: String(handover.expected.substitute),
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const run = async (kind) => {
    const shortage = kind === 'shortage';
    const errs = validateHandoverCheck(form, handover.expected, { shortage });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(kind);
    try {
      if (shortage) {
        await reportHandoverShortage(handover.id, form, user);
        toast.warning('Đã báo thiếu suất. Bếp sẽ bổ sung và bạn kiểm lại.', 'Đã gửi báo thiếu');
      } else {
        await confirmHandover(handover.id, form, user);
        toast.success('Đã xác nhận nhận đủ suất ăn.', 'Nhận suất thành công');
      }
      onDone();
    } catch (err) {
      setErrors(err.details || {});
      toast.error(err.message, 'Không lưu được');
    } finally {
      setBusy('');
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal
      open
      size="md"
      onClose={onClose}
      title={`Kiểm nhận suất ăn – ${handover.className} · ${MEAL_SESSION_LABELS[handover.session]}`}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={!!busy}>
            Quay lại
          </button>
          <div className="spacer" />
          <button className="btn btn--warning" onClick={() => run('shortage')} disabled={!!busy}>
            {busy === 'shortage' ? <Spinner small /> : <AlertTriangle size={16} />} Báo thiếu suất
          </button>
          <button className="btn btn--primary" onClick={() => run('confirm')} disabled={!!busy}>
            {busy === 'confirm' ? <Spinner small /> : <CheckCircle2 size={16} />} Xác nhận đã nhận đủ
          </button>
        </>
      }
    >
      <p className="text-2 mb-12">
        Đếm số suất bếp giao và nhập số thực nhận. Lớp cần nhận <b>{handover.expected.normal}</b> suất thường và{' '}
        <b>{handover.expected.substitute}</b> suất thay thế.
      </p>
      <div className="grid-2">
        <FormField label="Suất thường đã nhận" required error={errors.normal}>
          <input className="input" type="number" min={0} inputMode="numeric" value={form.normal} onChange={set('normal')} />
        </FormField>
        <FormField label="Suất thay thế đã nhận" required error={errors.substitute}>
          <input className="input" type="number" min={0} inputMode="numeric" value={form.substitute} onChange={set('substitute')} />
        </FormField>
      </div>
      <FormField label="Ghi chú" error={errors.note} hint="Bắt buộc khi báo thiếu suất" className="mt-12">
        <textarea className="textarea" rows={2} maxLength={300} value={form.note} onChange={set('note')} />
      </FormField>
    </Modal>
  );
}

/** #68 Meal Handover (UC 6.26): teachers check the servings from the kitchen; the kitchen supplements shortages. */
export default function MealHandoverPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { classes } = useClasses();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const date = params.get('date') || today;
  const { data, loading, error, reload } = useMealHandovers(date);
  const [checking, setChecking] = useState(null);
  const [supplying, setSupplying] = useState(null);
  const kitchen = user?.role === ROLES.KITCHEN_STAFF;
  const classById = Object.fromEntries(classes.map((c) => [c.id, c]));

  const doSupplement = async () => {
    try {
      await supplementHandover(supplying.id, {}, user);
      toast.success('Đã báo giáo viên kiểm lại số suất.', 'Đã bổ sung suất');
      setSupplying(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message, 'Không lưu được');
    }
  };

  const list = data?.handovers || [];
  const pending = list.filter((h) =>
    kitchen ? h.status === HANDOVER_STATUS.SHORTAGE_REPORTED : canReceiveHandover(h, classById[h.classId], user),
  );

  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs('Bàn giao suất ăn', { linkParent: !kitchen })} />
      <h1 className="page__title">{kitchen ? 'Bàn giao suất ăn cho lớp' : 'Nhận suất ăn từ bếp'}</h1>
      <ClassDateBar date={date} maxDate={today} onDateChange={(v) => setParams({ date: v }, { replace: true })} />
      {pending.length > 0 && (
        <div className={`alert ${kitchen ? 'alert--danger' : 'alert--info'} mb-16`}>
          {kitchen ? <AlertTriangle size={18} /> : <PackageCheck size={18} />}
          <div>
            {kitchen ? (
              <>
                Có <b>{pending.length}</b> lớp báo thiếu suất. Bổ sung suất rồi bấm <b>Xác nhận đã bổ sung</b> để giáo viên kiểm lại.
              </>
            ) : (
              <>
                Có <b>{pending.length}</b> lượt suất ăn chờ lớp kiểm nhận. Đếm số suất và xác nhận, hoặc báo thiếu để bếp bổ sung.
              </>
            )}
          </div>
        </div>
      )}
      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading || !data ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UtensilsCrossed}
            title="Chưa có suất ăn cần bàn giao"
            description="Danh sách hiển thị sau khi Phó hiệu trưởng xác nhận sĩ số suất ăn của ngày."
          />
        </div>
      ) : (
        <div className="dd-handover-grid">
          {list.map((h) => {
            const cls = classById[h.classId];
            return (
              <div key={h.id} className={`card dd-handover dd-handover--${h.status.toLowerCase()}`}>
                <div className="card__header">
                  <div>
                    <div className="card__title">{h.className}</div>
                    <div className="text-sm muted">
                      {MEAL_SESSION_LABELS[h.session]} · {formatDate(h.date)}
                      {kitchen ? '' : ` · ${md.campusById?.(h.campusId)?.name || ''}`}
                    </div>
                  </div>
                  <HandoverStatusBadge status={h.status} />
                </div>
                <div className="card__body">
                  <div className="dd-handover__nums">
                    <div>
                      <span className="dd-count__num">{h.expected.normal}</span>
                      <span className="muted text-sm">Suất thường</span>
                    </div>
                    <div>
                      <span className="dd-count__num dd-count__num--sub">{h.expected.substitute}</span>
                      <span className="muted text-sm">Suất thay thế</span>
                    </div>
                  </div>
                  {h.status === HANDOVER_STATUS.WAITING_KITCHEN && (
                    <div className="text-sm muted mt-8 row">
                      <ChefHat size={15} /> Bếp chưa báo "Sẵn sàng bàn giao".
                    </div>
                  )}
                  {h.shortage && h.status !== HANDOVER_STATUS.CONFIRMED && (
                    <div className="alert alert--warning mt-12">
                      <AlertTriangle size={18} />
                      <div className="text-sm">
                        Thiếu {h.shortage.missing.normal} suất thường, {h.shortage.missing.substitute} suất thay thế – {h.shortage.note}
                        <div className="muted text-xs">{formatDateTime(h.shortage.reportedAt)}</div>
                      </div>
                    </div>
                  )}
                  {h.status === HANDOVER_STATUS.CONFIRMED && (
                    <div className="text-sm muted mt-8">
                      Đã nhận {h.received?.normal} + {h.received?.substitute} suất · {md.userById?.(h.confirmedBy)?.fullName || 'Giáo viên'}{' '}
                      · {formatDateTime(h.confirmedAt)}
                    </div>
                  )}
                  {canReceiveHandover(h, cls, user) && (
                    <button className="btn btn--primary btn--block mt-12" onClick={() => setChecking(h)}>
                      <PackageCheck size={16} /> {h.status === HANDOVER_STATUS.SUPPLEMENTED ? 'Kiểm lại suất ăn' : 'Kiểm nhận suất ăn'}
                    </button>
                  )}
                  {canSupplementHandover(h, user) && (
                    <button className="btn btn--primary btn--block mt-12" onClick={() => setSupplying(h)}>
                      <PackagePlus size={16} /> Xác nhận đã bổ sung
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {checking && (
        <CheckModal
          handover={checking}
          onClose={() => setChecking(null)}
          onDone={() => {
            setChecking(null);
            reload({ silent: true });
          }}
        />
      )}
      <ConfirmationModal
        open={!!supplying}
        title="Xác nhận đã bổ sung suất"
        message={
          supplying
            ? `${supplying.className} – ${MEAL_SESSION_LABELS[supplying.session].toLowerCase()}: đã giao thêm ${supplying.shortage?.missing.normal || 0} suất thường, ${supplying.shortage?.missing.substitute || 0} suất thay thế? Giáo viên sẽ được báo để kiểm lại.`
            : ''
        }
        confirmLabel="Xác nhận đã bổ sung"
        onConfirm={doSupplement}
        onClose={() => setSupplying(null)}
      />
    </div>
  );
}
