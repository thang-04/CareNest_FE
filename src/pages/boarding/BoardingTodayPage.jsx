import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, ClipboardCheck, FlaskConical, Package, RefreshCw, Truck, Users } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { StatCard } from '@/components/ui/StatCard';
import { CampusFilter } from '@/components/ui/CampusFilter';
import { useToast } from '@/contexts/ToastContext';
import { DateInput } from '@/components/form/DateInput';
import { useMasterData } from '@/hooks/useMasterData';
import { useDayBoard } from '@/hooks/boarding/useDayBoard';
import { dayBoardApi } from '@/services/dayBoardApi';
import { buildDayBoardRows, summarizeBoardRows } from '@/utils/boarding/dayBoardRows';
import { isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/boarding.css';

const TASK_ICONS = { menu: CalendarDays, mealCount: Users, dryStock: Package, freshReceipt: Truck, foodSample: FlaskConical };

/** Ô giao giữa một việc và một điểm trường: huy hiệu trạng thái, chi tiết và nút tới màn xử lý. */
function TaskCell({ row, campus, syncing, onSyncStock }) {
  return (
    <div className="bd-cell">
      <StatusBadge tone={row.tone} label={row.status} />
      <p className="bd-detail">{row.detail}</p>
      <div className="bd-actions">
        {row.actions.map((action, i) =>
          action.syncStock ? (
            <button
              key={action.key}
              type="button"
              className="btn btn--sm btn--primary"
              disabled={syncing}
              onClick={() => onSyncStock(campus)}
            >
              <RefreshCw size={14} /> {action.label}
            </button>
          ) : (
            <Link key={action.to} className={`btn btn--sm ${i ? 'btn--ghost' : ''}`} to={action.to}>
              {action.label} <ArrowRight size={14} />
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

/** Dải số liệu đầu trang: bao nhiêu việc cần xử lý, đang chờ, đã xong và chưa có thông tin trên các điểm trường đang xem. */
function BoardSummary({ rowsPerCampus }) {
  const sum = summarizeBoardRows(rowsPerCampus);
  return (
    <div className="stat-grid">
      <StatCard tone="red" label="Việc cần xử lý" value={sum.attention} />
      <StatCard tone="orange" label="Việc đang chờ" value={sum.waiting} />
      <StatCard tone="green" label="Việc đã xong" value={sum.done} />
      <StatCard tone="gray" label="Chưa có thông tin / ngày nghỉ" value={sum.idle} />
    </div>
  );
}

/**
 * Bảng việc × điểm trường: mỗi hàng một việc bán trú trong ngày, mỗi cột một điểm trường, nên nhìn ngang so sánh được các điểm.
 * Trạng thái do BE trả (`GET /nutrition/day-board`); nút trong ô mở màn xử lý tương ứng.
 */
function BoardTable({ campuses, rowsPerCampus, syncing, onSyncStock }) {
  const tasks = rowsPerCampus[0] || [];
  return (
    <section className="card">
      <div className="table-wrap">
        <table className="table table--grid bd-matrix">
          <thead>
            <tr>
              <th scope="col">Công việc</th>
              {campuses.map((campus) => (
                <th key={campus.campusId} scope="col">
                  {campus.campusName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, i) => {
              const Icon = TASK_ICONS[task.key] || ClipboardCheck;
              return (
                <tr key={task.key}>
                  <th scope="row" className="bd-matrix__task">
                    <span className="bd-matrix__icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    {task.title}
                  </th>
                  {campuses.map((campus, ci) => (
                    <td key={campus.campusId}>
                      <TaskCell row={rowsPerCampus[ci][i]} campus={campus} syncing={syncing} onSyncStock={onSyncStock} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Bán trú hôm nay (`/boarding/today`): dải số liệu tổng quan và bảng năm việc (thực đơn tuần, số suất, kho khô, hàng tươi, lưu mẫu)
 * theo từng điểm trường, trạng thái do BE trả. Hiệu trưởng, Phó hiệu trưởng xem được.
 */
export default function BoardingTodayPage() {
  const [params, setParams] = useSearchParams();
  const md = useMasterData();
  const date = isIsoDate(params.get('date')) ? params.get('date') : todayInput();
  const campusId = params.get('campusId') || '';
  const board = useDayBoard(date, campusId);
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  const syncStock = async (campus) => {
    setSyncing(true);
    try {
      await dayBoardApi.syncStockDay({ date: board.data?.date || date, campusId: campus.campusId });
      toast.success(`Đã đồng bộ kho khô ${campus.campusName}.`);
      board.reload();
    } catch (err) {
      toast.error(err, 'Chưa đồng bộ được kho');
    } finally {
      setSyncing(false);
    }
  };

  const setFilter = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  let body;
  if (board.error) body = <ErrorState error={board.error} onRetry={board.reload} />;
  else if (board.loading || !board.data) body = <LoadingState />;
  else if (!board.data.campuses.length)
    body = (
      <section className="card">
        <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường nào để theo dõi bán trú." />
      </section>
    );
  else {
    const boardDate = board.data.date || date;
    const rowsPerCampus = board.data.campuses.map((campus) => buildDayBoardRows(campus, { date: boardDate }));
    body = (
      <>
        <BoardSummary rowsPerCampus={rowsPerCampus} />
        <BoardTable campuses={board.data.campuses} rowsPerCampus={rowsPerCampus} syncing={syncing} onSyncStock={syncStock} />
      </>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Bán trú hôm nay' }]} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Bán trú hôm nay</h1>
        </div>
      </div>
      <div className="bd-toolbar">
        <label className="date-filter">
          Ngày
          <DateInput value={date} onChange={(next) => isIsoDate(next) && setFilter('date', next)} aria-label="Ngày" />
        </label>
        <CampusFilter campuses={md.campuses} value={campusId} onChange={(id) => setFilter('campusId', id)} />
      </div>
      {body}
    </div>
  );
}
