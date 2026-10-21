import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, Info, UtensilsCrossed, History } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { MealCountStatusBadge } from '@/components/attendance/AttendanceBadges';
import { DonutChart } from '@/components/charts/MiniCharts';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { useMealCounts } from '@/hooks/attendance/useAttendance';
import { confirmMealCount } from '@/services/attendance/attendanceService';
import { ROLES } from '@/models/User';
import { MEAL_COUNT_STATUS, MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { canConfirmMealCount } from '@/utils/attendance/attendancePermissions';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { dayRegister } from '@/utils/attendance/mealRegister';
import { downloadCsv } from '@/utils/exportCsv';
import { formatDate, formatDateTime } from '@/utils/format';
import '@/styles/modules/attendance.css';

// OPEN: chưa tới giờ chốt (sổ tạm tính)
const STATUS_ORDER = ['OPEN', MEAL_COUNT_STATUS.PENDING_CONFIRMATION, MEAL_COUNT_STATUS.CONFIRMED];

/** Trạng thái sổ của một ngày: bữa nào còn mở/chờ xác nhận thì cả ngày chưa chốt. */
const dayStatus = (counts) => STATUS_ORDER.find((st) => counts.some((c) => c.status === st)) || MEAL_COUNT_STATUS.CONFIRMED;

/**
 * Sổ báo ăn ngày của một điểm trường (BA): mỗi lớp một dòng số suất/ngày, lớp chưa hoàn thành điểm danh, một nút xác nhận cả ngày.
 * Dữ liệu vẫn theo bữa (BE); "Ăn" đánh dấu mọi bữa cùng lúc nên mỗi lớp lấy số ở bữa đầu tiên có lớp đó.
 */
function DayRegisterCard({ counts, campusName, user, md, onConfirm }) {
  const first = counts[0];
  const status = dayStatus(counts);
  const confirmable = counts.filter((c) => c.id && canConfirmMealCount(c, user));
  const reconfirm = counts.some((c) => c.needsReconfirmation);
  const register = dayRegister(counts);
  const incomplete = register.rows.filter((l) => l.missing > 0);
  const servings = register.servings;
  const classById = Object.fromEntries(register.rows.map((l) => [l.classId, l.className]));
  const adjustments = counts.flatMap((c) => c.adjustments.map((a) => ({ ...a, session: c.session })));
  const confirmed = counts.filter((c) => c.confirmedAt).sort((a, b) => (a.confirmedAt < b.confirmedAt ? 1 : -1))[0];
  return (
    <div className="card dd-count">
      <div className="card__header">
        <div className="card__title">Sổ báo ăn ngày{campusName ? ` · ${campusName}` : ''}</div>
        <MealCountStatusBadge status={status} />
      </div>
      <div className="card__body">
        {reconfirm && user?.role !== ROLES.KITCHEN_STAFF && (
          <div className="alert alert--warning mb-12" role="status">
            <AlertTriangle size={18} />
            <div>Điểm danh đã thay đổi sau khi mở lại lớp. Số dưới đây cần được xác nhận lại; bếp vẫn dùng số đã xác nhận trước đó.</div>
          </div>
        )}
        {status === 'OPEN' && (
          <div className="alert alert--info mb-12">
            <Info size={18} />
            <div>Giáo viên đang điểm danh và báo ăn. Số liệu dưới đây là tạm tính đến giờ chốt.</div>
          </div>
        )}
        {status !== MEAL_COUNT_STATUS.CONFIRMED && incomplete.length > 0 && (
          <div className="alert alert--warning mb-12">
            <AlertTriangle size={18} />
            <div>
              Lớp chưa hoàn thành điểm danh: <b>{incomplete.map((l) => l.className).join(', ')}</b>. Trẻ chưa điểm danh không được tính
              suất; kiểm tra với giáo viên trước khi xác nhận.
            </div>
          </div>
        )}
        <div className="dd-count__totals">
          <div>
            <span className="dd-count__num">{servings}</span>
            <span className="muted text-sm">Suất ăn / ngày</span>
          </div>
          <div>
            <span className="dd-count__num dd-count__num--sub">{register.substitute}</span>
            <span className="muted text-sm">Trong đó suất thay thế</span>
          </div>
          <div>
            <span className="dd-count__num">{counts.length}</span>
            <span className="muted text-sm">Bữa trong ngày</span>
          </div>
        </div>
        <div className="table-wrap mt-12">
          <table className="table table--grid table--compact table--wrap-head">
            <thead>
              <tr>
                <th>Lớp</th>
                <th className="num">Có mặt</th>
                <th className="num">Vắng</th>
                <th className="num">Chưa ĐD</th>
                <th className="num">Suất / ngày</th>
                <th className="num">Suất thay thế</th>
                <th>Điểm danh</th>
              </tr>
            </thead>
            <tbody>
              {register.rows.map((l) => (
                <tr key={l.classId}>
                  <td className="fw-600 nowrap">{l.className}</td>
                  <td className="num">{l.present}</td>
                  <td className="num">{l.absent}</td>
                  <td className={`num ${l.missing ? 'text-danger' : 'muted'}`}>{l.missing || '—'}</td>
                  <td className="num fw-600">{l.normal + l.substitute}</td>
                  <td className="num">{l.substitute}</td>
                  <td className={l.missing ? 'text-danger' : 'muted'}>{l.missing ? 'Chưa hoàn thành' : 'Hoàn thành'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {adjustments.length > 0 && (
          <div className="mt-12">
            <div className="subsection-title row">
              <History size={16} /> Điều chỉnh sau giờ chốt ({adjustments.length})
            </div>
            <ul className="dd-adjust">
              {adjustments.map((a, i) => (
                <li key={i}>
                  <span className="text-xs muted nowrap">{formatDateTime(a.at)}</span>
                  <span>
                    <b>{classById[a.classId]}</b> ({MEAL_SESSION_LABELS[a.session]}):{' '}
                    {a.normal ? `${a.normal} suất thường` : `${a.substitute} suất thay thế`} – {a.note}
                    <span className="muted"> ({md.userById?.(a.userId)?.fullName || 'Giáo viên'})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {confirmed && (
          <div className="text-sm muted mt-12">
            Xác nhận bởi {md.userById?.(confirmed.confirmedBy)?.fullName || 'Phó hiệu trưởng'} lúc {formatDateTime(confirmed.confirmedAt)}
          </div>
        )}
        {confirmable.length > 0 && (
          <div className="row mt-12 dd-count__actions">
            <button className="btn btn--primary" onClick={() => onConfirm({ counts: confirmable, servings, campusName, date: first.date })}>
              <CheckCircle2 size={16} /> {reconfirm ? 'Xác nhận lại sổ báo ăn ngày' : 'Xác nhận sổ báo ăn ngày'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Điểm danh và suất ăn trong ngày: mỗi lớp lấy 1 lần vì các bữa của lớp dùng chung số điểm danh BE trả. */
function dayAttendance(counts) {
  const d = dayRegister(counts);
  return { classes: d.rows.length, present: d.present, absent: d.absent, missing: d.missing, meals: d.servings };
}

/** Khối tổng đầu trang, cùng mẫu màn Tổng hợp điểm danh. */
function DayOverview({ counts }) {
  const d = dayAttendance(counts);
  return (
    <div className="dd-overview mb-16">
      <div className="card dd-overview__chart">
        <DonutChart
          caption="Điểm danh trong ngày"
          center={d.present}
          segments={[
            { key: 'present', label: 'Có mặt', value: d.present, color: 'var(--success)' },
            { key: 'absent', label: 'Vắng', value: d.absent, color: 'var(--warning)' },
            { key: 'missing', label: 'Chưa điểm danh', value: d.missing, color: 'var(--danger)' },
          ]}
        />
      </div>
      <div className="dd-stats">
        <div className="dd-stat">
          <span className="dd-stat__value">{d.present + d.absent + d.missing}</span>
          <span className="dd-stat__label">Sĩ số ({d.classes} lớp)</span>
        </div>
        <div className="dd-stat dd-stat--green">
          <span className="dd-stat__value">{d.present}</span>
          <span className="dd-stat__label">Có mặt</span>
        </div>
        <div className="dd-stat dd-stat--orange">
          <span className="dd-stat__value">{d.absent}</span>
          <span className="dd-stat__label">Vắng</span>
        </div>
        <div className={`dd-stat ${d.missing ? 'dd-stat--red' : 'dd-stat--gray'}`}>
          <span className="dd-stat__value">{d.missing}</span>
          <span className="dd-stat__label">Chưa điểm danh</span>
        </div>
        <div className="dd-stat dd-stat--blue">
          <span className="dd-stat__value">{d.meals}</span>
          <span className="dd-stat__label">Suất ăn / ngày</span>
        </div>
        <div className="dd-stat">
          <span className="dd-stat__value">{counts.length}</span>
          <span className="dd-stat__label">Bữa trong ngày</span>
        </div>
      </div>
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

  // Một lần xác nhận cho cả ngày: chốt mọi bữa còn chờ của điểm trường
  const doConfirm = async () => {
    try {
      for (const c of confirming.counts) await confirmMealCount(c.id, user);
      toast.success('Đã xác nhận sổ báo ăn ngày. Bếp đã nhận được số liệu.', 'Xác nhận thành công');
      setConfirming(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Không xác nhận được');
    }
  };

  const campuses = [...new Set((data?.counts || []).map((c) => c.campusId))];
  const exportCsv = () => {
    const rows = [['Điểm trường', 'Lớp', 'Có mặt', 'Vắng', 'Chưa điểm danh', 'Suất/ngày', 'Suất thay thế', 'Trạng thái']];
    campuses.forEach((campusId) => {
      const counts = data.counts.filter((c) => c.campusId === campusId);
      dayRegister(counts).rows.forEach((l) =>
        rows.push([
          md.campusById?.(campusId)?.name || campusId,
          l.className,
          l.present,
          l.absent,
          l.missing,
          l.normal + l.substitute,
          l.substitute,
          dayStatus(counts),
        ]),
      );
    });
    downloadCsv([[`Sổ báo ăn ngày ${formatDate(date)}`], ...rows], `so-bao-an-${date}.csv`);
  };

  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs('Sổ báo ăn', { linkParent: false })} />
      <div className="page__head">
        <h1 className="page__title">{kitchen ? 'Sổ báo ăn đã xác nhận' : 'Sổ báo ăn'}</h1>
        {data?.counts.length > 0 && (
          <button className="btn mt-8" onClick={exportCsv}>
            <Download size={16} /> Xuất Excel
          </button>
        )}
      </div>
      <ClassDateBar date={date} maxDate={today} onDateChange={(v) => setParams({ date: v }, { replace: true })}>
        <div className="spacer" />
        {kitchen && (
          <Link className="btn" to={`/attendance/meal-handover?date=${date}`}>
            <UtensilsCrossed size={16} /> Bàn giao suất ăn
          </Link>
        )}
      </ClassDateBar>
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
        <>
          <DayOverview counts={data.counts} />
          {campuses.map((campusId) => (
            <section key={campusId} className="mb-16">
              <DayRegisterCard
                counts={data.counts.filter((c) => c.campusId === campusId)}
                campusName={campuses.length > 1 ? md.campusById?.(campusId)?.name || campusId : ''}
                user={user}
                md={md}
                onConfirm={setConfirming}
              />
            </section>
          ))}
        </>
      )}
      <ConfirmationModal
        open={!!confirming}
        title="Xác nhận sổ báo ăn ngày"
        message={
          confirming
            ? `${confirming.campusName ? `${confirming.campusName}, ` : ''}ngày ${formatDate(confirming.date)}: ${confirming.servings} suất/ngày. Xác nhận một lần cho ${confirming.counts.length} bữa; bếp dùng số liệu này để tính nguyên liệu và xuất kho.`
            : ''
        }
        confirmLabel="Xác nhận sổ báo ăn"
        onConfirm={doConfirm}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
}
