import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, UtensilsCrossed } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { MealAdjustModal, MealRegisterCard, dayStatus } from '@/components/attendance/MealRegisterCard';
import { CampusFilter } from '@/components/ui/CampusFilter';
import { DonutChart } from '@/components/charts/MiniCharts';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { useMealCounts } from '@/hooks/attendance/useAttendance';
import { confirmMealCount } from '@/services/attendance/attendanceService';
import { ROLES } from '@/models/User';
import { MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { dayBySession, dayRegister } from '@/utils/attendance/mealRegister';
import { downloadCsv } from '@/utils/exportCsv';
import { formatDate } from '@/utils/format';
import '@/styles/modules/attendance.css';

/** Điểm danh và suất ăn trong ngày: mỗi lớp lấy 1 lần vì các bữa của lớp dùng chung số điểm danh BE trả. */
function dayAttendance(counts) {
  const d = dayRegister(counts);
  // Suất: cộng đủ các bữa trong ngày (Cần chốt 20/10/2026)
  return { classes: d.rows.length, present: d.present, absent: d.absent, missing: d.missing, meals: dayBySession(counts).total };
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
          <span className="dd-stat__label">Tổng suất cả ngày</span>
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
  const [adjusting, setAdjusting] = useState(null);
  const kitchen = user?.role === ROLES.KITCHEN_STAFF;
  // Hiệu trưởng xem cả trường: lọc điểm trường
  const [campusFilter, setCampusFilter] = useState('');
  const allCampuses = [...new Set((data?.counts || []).map((c) => c.campusId))];
  const shownCounts = useMemo(() => (data?.counts || []).filter((c) => !campusFilter || c.campusId === campusFilter), [data, campusFilter]);

  // Xác nhận một bữa hoặc tất cả bữa còn chờ của điểm trường
  const doConfirm = async () => {
    try {
      for (const c of confirming.counts) await confirmMealCount(c.id, user);
      toast.success(`Đã xác nhận ${confirming.scope}. Bếp đã nhận được số liệu.`, 'Xác nhận thành công');
      setConfirming(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Không xác nhận được');
    }
  };

  const campuses = [...new Set(shownCounts.map((c) => c.campusId))];
  const exportCsv = () => {
    const sessions = [...new Set(shownCounts.map((c) => c.session))];
    const rows = [
      [
        'Điểm trường',
        'Lớp',
        'Có mặt',
        'Vắng',
        'Chưa điểm danh',
        ...sessions.map((sKey) => MEAL_SESSION_LABELS[sKey]),
        'Tổng suất',
        'Suất thay thế',
        'Trạng thái',
      ],
    ];
    campuses.forEach((campusId) => {
      const counts = shownCounts.filter((c) => c.campusId === campusId);
      dayBySession(counts).rows.forEach((l) =>
        rows.push([
          md.campusById?.(campusId)?.name || campusId,
          l.className,
          l.present,
          l.absent,
          l.missing,
          ...sessions.map((sKey) => (l.meals[sKey] ? l.meals[sKey].normal + l.meals[sKey].substitute : '')),
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
        <CampusFilter
          className="dd-bar__field"
          campuses={allCampuses.map((id) => ({ id, name: md.campusById?.(id)?.name || id }))}
          value={campusFilter}
          onChange={setCampusFilter}
        />
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
          <DayOverview counts={shownCounts} />
          {campuses.map((campusId) => (
            <section key={campusId} className="mb-16">
              <MealRegisterCard
                counts={shownCounts.filter((c) => c.campusId === campusId)}
                campusName={allCampuses.length > 1 ? md.campusById?.(campusId)?.name || campusId : ''}
                user={user}
                md={md}
                onConfirm={setConfirming}
                onAdjust={setAdjusting}
              />
            </section>
          ))}
        </>
      )}
      <ConfirmationModal
        open={!!confirming}
        title={confirming?.counts.length > 1 ? 'Xác nhận tất cả bữa' : `Xác nhận ${confirming?.scope || ''}`}
        message={
          confirming
            ? `${confirming.counts
                .map((c) => `${MEAL_SESSION_LABELS[c.session]} ${c.totals.normal + c.totals.substitute} suất`)
                .join('; ')} ngày ${formatDate(confirming.counts[0].date)}. Bếp dùng số liệu này để tính nguyên liệu và xuất kho.`
            : ''
        }
        confirmLabel={confirming?.counts.length > 1 ? `Xác nhận ${confirming.counts.length} bữa` : 'Xác nhận'}
        onConfirm={doConfirm}
        onClose={() => setConfirming(null)}
      />
      {adjusting && (
        <MealAdjustModal
          target={adjusting}
          user={user}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            reload({ silent: true });
          }}
        />
      )}
    </div>
  );
}
