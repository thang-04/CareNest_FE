import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, Info, History } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { MealCountStatusBadge } from '@/components/attendance/AttendanceBadges';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { useMealCounts } from '@/hooks/attendance/useAttendance';
import { confirmMealCountDay } from '@/services/attendance/attendanceService';
import { ROLES } from '@/models/User';
import { MEAL_COUNT_STATUS, MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { canConfirmMealCount } from '@/utils/attendance/attendancePermissions';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { downloadCsv } from '@/utils/exportCsv';
import { formatDate, formatDateTime } from '@/utils/format';
import '@/styles/modules/attendance.css';

function CountCard({ count, md }) {
  const t = count.totals;
  const classById = Object.fromEntries(count.classes.map((l) => [l.classId, l.className]));
  return (
    <div className="card dd-count">
      <div className="card__header">
        <div className="card__title">{MEAL_SESSION_LABELS[count.session]}</div>
        <MealCountStatusBadge status={count.status} />
      </div>
      <div className="card__body">
        {count.status === 'OPEN' && (
          <div className="alert alert--info mb-12">
            <Info size={18} />
            <div>Giáo viên đang báo ăn. Số liệu dưới đây là tạm tính đến giờ khóa.</div>
          </div>
        )}
        {count.status === MEAL_COUNT_STATUS.PENDING_CONFIRMATION && t.missing > 0 && (
          <div className="alert alert--warning mb-12">
            <AlertTriangle size={18} />
            <div>
              Còn <b>{t.missing}</b> trẻ chưa được điểm danh trước giờ khóa (không tính suất ăn). Kiểm tra với giáo viên trước khi xác nhận.
            </div>
          </div>
        )}
        <div className="dd-count__totals">
          <div>
            <span className="dd-count__num">{t.normal + t.substitute}</span>
            <span className="muted text-sm">Tổng suất</span>
          </div>
          <div>
            <span className="dd-count__num">{t.normal}</span>
            <span className="muted text-sm">Suất thường</span>
          </div>
          <div>
            <span className="dd-count__num dd-count__num--sub">{t.substitute}</span>
            <span className="muted text-sm">Suất thay thế</span>
          </div>
        </div>
        <div className="table-wrap mt-12">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Lớp</th>
                <th className="right">Có mặt</th>
                <th className="right">Vắng</th>
                <th className="right">Chưa ĐD</th>
                <th className="right">Suất thường</th>
                <th className="right">Suất thay thế</th>
              </tr>
            </thead>
            <tbody>
              {count.classes.map((l) => (
                <tr key={l.classId}>
                  <td className="fw-600">{l.className}</td>
                  <td className="right">{l.present}</td>
                  <td className="right">{l.absent}</td>
                  <td className={`right ${l.missing ? 'text-danger' : 'muted'}`}>{l.missing || '—'}</td>
                  <td className="right">{l.normal}</td>
                  <td className="right">{l.substitute}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {count.adjustments.length > 0 && (
          <div className="mt-12">
            <div className="subsection-title row">
              <History size={16} /> Điều chỉnh sau giờ khóa ({count.adjustments.length})
            </div>
            <ul className="dd-adjust">
              {count.adjustments.map((a, i) => (
                <li key={i}>
                  <span className="text-xs muted nowrap">{formatDateTime(a.at)}</span>
                  <span>
                    <b>{classById[a.classId]}</b>: {a.normal ? `${a.normal} suất thường` : `${a.substitute} suất thay thế`} – {a.note}
                    <span className="muted"> ({md.userById?.(a.userId)?.fullName || 'Giáo viên'})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {count.confirmedAt && (
          <div className="text-sm muted mt-12">
            Xác nhận bởi {md.userById?.(count.confirmedBy)?.fullName || 'Phó hiệu trưởng'} lúc {formatDateTime(count.confirmedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Một nút chốt suất cả ngày cho mỗi cơ sở (khảo sát 18/10/2026, S2), hiện khi mọi bữa đã khóa và chờ xác nhận. */
function DayConfirmBar({ counts, user, onConfirm }) {
  const ready = counts.length > 0 && counts.every((c) => c.id && c.status === MEAL_COUNT_STATUS.PENDING_CONFIRMATION);
  if (!ready || !counts.every((c) => canConfirmMealCount(c, user))) return null;
  const parts = counts.map((c) => `${MEAL_SESSION_LABELS[c.session]} ${c.totals.normal + c.totals.substitute} suất`).join(', ');
  return (
    <div className="row mt-12 dd-count__actions">
      <button className="btn btn--primary" onClick={() => onConfirm({ campusId: counts[0].campusId, parts })}>
        <CheckCircle2 size={16} /> Chốt suất cả ngày
      </button>
    </div>
  );
}

/** #67 Meal Count Confirmation (UC 6.10) / View Confirmed Meal Count by Class (UC 6.16). */
export default function MealCountPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const date = params.get('date') || today;
  const { data, loading, error, reload } = useMealCounts(date);
  const [confirming, setConfirming] = useState(null);
  const kitchen = user?.role === ROLES.KITCHEN_STAFF;

  const doConfirm = async () => {
    try {
      await confirmMealCountDay({ campusId: confirming.campusId, date }, user);
      toast.success('Đã chốt suất cả ngày. Bếp đã nhận số liệu, đồ khô đã xuất kho.', 'Chốt suất thành công');
      setConfirming(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message, 'Không xác nhận được');
    }
  };

  const campuses = [...new Set((data?.counts || []).map((c) => c.campusId))];
  const exportCsv = () => {
    const rows = [['Điểm trường', 'Bữa', 'Lớp', 'Có mặt', 'Vắng', 'Chưa điểm danh', 'Suất thường', 'Suất thay thế', 'Trạng thái']];
    data.counts.forEach((c) =>
      c.classes.forEach((l) =>
        rows.push([
          md.campusById?.(c.campusId)?.name || c.campusId,
          MEAL_SESSION_LABELS[c.session],
          l.className,
          l.present,
          l.absent,
          l.missing,
          l.normal,
          l.substitute,
          c.status,
        ]),
      ),
    );
    downloadCsv([[`Sĩ số suất ăn ngày ${formatDate(date)}`], ...rows], `si-so-suat-an-${date}.csv`);
  };

  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs('Sĩ số suất ăn', { linkParent: false })} />
      <div className="page__head">
        <h1 className="page__title">{kitchen ? 'Sĩ số suất ăn đã xác nhận' : 'Xác nhận sĩ số suất ăn'}</h1>
        {data?.counts.length > 0 && (
          <button className="btn mt-8" onClick={exportCsv}>
            <Download size={16} /> Xuất Excel
          </button>
        )}
      </div>
      <ClassDateBar date={date} maxDate={today} onDateChange={(v) => setParams({ date: v }, { replace: true })}>
        <div className="spacer" />
      </ClassDateBar>
      {data && data.schoolDay && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            Sĩ số được tự động tổng hợp từ điểm danh và báo ăn đã khóa lúc <b>{data.cutoff}</b>. Suất thay thế dành cho trẻ có ghi nhận dị
            ứng.
            {kitchen ? ' Bếp chỉ xem, không sửa được sĩ số.' : ''}
          </div>
        </div>
      )}
      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading || !data ? (
        <LoadingState />
      ) : !data.schoolDay ? (
        <div className="card">
          <EmptyState title="Ngày đã chọn không phải ngày học." description="Chọn một ngày học khác." />
        </div>
      ) : data.counts.length === 0 ? (
        <div className="card">
          <EmptyState
            title={kitchen ? 'Chưa có sĩ số đã xác nhận' : 'Không có dữ liệu trong ngày đã chọn'}
            description={kitchen ? 'Sĩ số hiển thị sau khi Phó hiệu trưởng xác nhận.' : 'Chọn ngày khác.'}
          />
        </div>
      ) : (
        campuses.map((campusId) => (
          <section key={campusId} className="mb-16">
            {campuses.length > 1 && <h2 className="section-title mb-12">{md.campusById?.(campusId)?.name || campusId}</h2>}
            <div className="dd-count-grid">
              {data.counts
                .filter((c) => c.campusId === campusId)
                .map((c) => (
                  <CountCard key={`${c.campusId}-${c.session}`} count={c} md={md} />
                ))}
            </div>
            <DayConfirmBar counts={data.counts.filter((c) => c.campusId === campusId)} user={user} onConfirm={setConfirming} />
          </section>
        ))
      )}
      <ConfirmationModal
        open={!!confirming}
        title="Chốt suất cả ngày"
        message={
          confirming
            ? `Ngày ${formatDate(date)}: ${confirming.parts}. Chốt một lần cho mọi bữa; trẻ đến sau giờ chốt không thêm suất. Đồ khô được xuất kho theo số này.`
            : ''
        }
        confirmLabel="Chốt suất cả ngày"
        onConfirm={doConfirm}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}
