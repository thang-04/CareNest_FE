import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, RefreshCw } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { CampusFilter } from '@/components/ui/CampusFilter';
import { useToast } from '@/contexts/ToastContext';
import { DateInput } from '@/components/form/DateInput';
import { useMasterData } from '@/hooks/useMasterData';
import { useDayBoard } from '@/hooks/boarding/useDayBoard';
import { dayBoardApi } from '@/services/dayBoardApi';
import { buildDayBoardRows } from '@/utils/boarding/dayBoardRows';
import { isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/boarding.css';

function CampusBoard({ campus, date, syncing, onSyncStock }) {
  const rows = buildDayBoardRows(campus, { date });
  return (
    <section className="card" aria-label={campus.campusName}>
      <div className="card__header">
        <h2 className="card__title">{campus.campusName}</h2>
      </div>
      <div className="table-wrap">
        <table className="table table--grid bd-table">
          <thead>
            <tr>
              <th>Việc</th>
              <th>Trạng thái</th>
              <th>Chi tiết</th>
              <th className="cell--actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="bd-title">
                  {row.title}
                </th>
                <td>
                  <StatusBadge tone={row.tone} label={row.status} />
                </td>
                <td className="bd-detail">{row.detail}</td>
                <td className="cell--actions">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Bán trú hôm nay (`/boarding/today`): mỗi điểm trường một khối năm việc (thực đơn tuần, số suất, kho khô, hàng tươi, lưu mẫu)
 * với trạng thái do BE trả (`GET /nutrition/day-board`) và nút tới màn xử lý. Hiệu trưởng, Phó hiệu trưởng xem được.
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
  else
    body = (
      <div className="bd-stack">
        {board.data.campuses.map((campus) => (
          <CampusBoard key={campus.campusId} campus={campus} date={board.data.date || date} syncing={syncing} onSyncStock={syncStock} />
        ))}
      </div>
    );

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
