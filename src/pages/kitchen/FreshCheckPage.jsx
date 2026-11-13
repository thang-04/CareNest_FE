import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingBasket } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { FreshRoundCard } from '@/components/kitchen/FreshRoundCard';
import { KbCampusFilter, KbDateFilter } from '@/components/kitchen/KitchenFilters';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useFoodGroupMap, useFreshCheck } from '@/hooks/kitchen/useFreshGoods';
import { FRESH_ROUND_LABELS } from '@/models/kitchen/kitchenConstants';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';

/**
 * Kiểm nhận hàng tươi trên BE (`/kitchen/fresh-receipts`): hai lần trong ngày — lần 1 so bản dự trù, lần 2 so suất đã xác
 * nhận. Chọn ngày và điểm trường (?date=&campusId=); lần nào mở được, số cần nhận, quyền ghi đều do BE trả.
 */
export default function FreshCheckPage() {
  const [params, setParams] = useSearchParams();
  const campus = useStockCampus();
  const date = isIsoDate(params.get('date')) ? params.get('date') : todayInput();
  const check = useFreshCheck(campus.campusId, date);
  const foodGroups = useFoodGroupMap();

  const setDate = (next) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('date', next);
        return p;
      },
      { replace: true },
    );

  let body;
  if (campus.error) body = <ErrorState error={campus.error} onRetry={campus.reload} />;
  else if (campus.loading) body = <LoadingState />;
  else if (!campus.campusId)
    body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để kiểm nhận hàng tươi." />;
  else if (check.error) body = <ErrorState error={check.error} onRetry={check.reload} />;
  else if (check.loading || !check.data) body = <LoadingState />;
  else if (check.data.rounds.every((r) => !r.available && !r.recorded && !r.lines.length))
    // Cả hai lần chưa mở: một thẻ giải thích điều kiện của từng lần thay vì hai thẻ trống giống nhau
    body = (
      <section className="card">
        <EmptyState
          title="Chưa có lần kiểm nhận nào mở trong ngày này"
          description={
            <ul className="kb-reasons">
              {check.data.rounds.map((r) => (
                <li key={r.round}>
                  <b>{FRESH_ROUND_LABELS[r.round]}:</b> {r.unavailableReason || 'chưa mở.'}
                </li>
              ))}
            </ul>
          }
        />
      </section>
    );
  else
    body = (
      <div className="kb-stack">
        {!check.data.canManage && (
          <div className="alert alert--info" role="status">
            Tài khoản chỉ được xem kiểm nhận hàng tươi, không ghi nhận được.
          </div>
        )}
        {check.data.rounds.map((round) => (
          <FreshRoundCard
            key={round.round}
            round={round}
            campusId={campus.campusId}
            date={date}
            canManage={check.data.canManage}
            groupOfFood={foodGroups}
            onSaved={check.setData}
            onStale={() => check.reload({ silent: true })}
          />
        ))}
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.freshReceipts)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Kiểm nhận hàng tươi</h1>
        </div>
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={setDate} />
        {campus.campusId && <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />}
        {campus.campusId && (
          <div className="kb-toolbar__end">
            <Link className="btn" to={`/kitchen/forecast?campusId=${campus.campusId}`}>
              <ShoppingBasket size={16} /> Bản dự trù
            </Link>
          </div>
        )}
      </div>
      {body}
    </div>
  );
}
