import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingBasket } from '@/components/ui/icons';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components';
// import { DryIntakeCard } from '@/components/kitchen/DryIntakeCard';
import { FreshRoundCard } from '@/components/kitchen/FreshRoundCard';
import { FreshHandlingCard } from '@/components/kitchen/FreshHandlingCard';
import { KbCampusFilter, KbDateFilter } from '@/components/kitchen/KitchenFilters';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useFoodGroupMap, useFreshCheck } from '@/hooks/kitchen/useFreshGoods';
import { FRESH_ROUND_LABELS } from '@/models/kitchen/kitchenConstants';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';

/**
 * Kiểm nhận hàng hôm nay trên BE (`/kitchen/fresh-receipts`): hàng tươi hai lần trong ngày — lần 1 so bản dự trù, lần 2 so
 * bản cân đối lần 2 (xử lý chênh lệch) hoặc suất đã xác nhận — và các đợt hàng khô giao trong ngày (so lượng đặt của bản dự trù). Chọn ngày và điểm trường (?date=&campusId=); lần nào mở được, số cần nhận, quyền ghi đều do BE trả.
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
    body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để kiểm nhận hàng." />;
  else if (check.error) body = <ErrorState error={check.error} onRetry={check.reload} />;
  else if (check.loading || !check.data) body = <LoadingState />;
  else {
    const freshClosed = check.data.rounds.every((r) => !r.available && !r.recorded && !r.lines.length);
    body = (
      <div className="kb-stack">
        {check.data.canManage && check.data.lockReason === 'NOT_TODAY' && (
          <div className="alert alert--info" role="status">
            Kiểm nhận chỉ ghi hoặc sửa trong ngày nhận hàng; ngày này chỉ xem.
          </div>
        )}
        {check.data.canManage && check.data.lockReason === 'M1_SIGNED' && (
          <div className="alert alert--info" role="status">
            Biên bản M1 hàng tươi của ngày đã ký nên kiểm nhận bị khóa. Muốn sửa, bấm Sửa lại ở{' '}
            <Link to={`/kitchen/inspections?date=${date}&campusId=${campus.campusId}&form=fresh`}>biên bản M1 tươi</Link>.
          </div>
        )}
        {freshClosed ? (
          // Cả hai lần hàng tươi chưa mở: một thẻ giải thích điều kiện của từng lần thay vì hai thẻ trống giống nhau
          <section className="card">
            <EmptyState
              title="Chưa có lần kiểm nhận hàng tươi nào mở trong ngày này"
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
        ) : (
          check.data.rounds.map((round) => {
            const common = {
              round,
              campusId: campus.campusId,
              date,
              canManage: check.data.canManage && check.data.editable !== false,
              onSaved: check.setData,
              onStale: () => check.reload({ silent: true }),
            };
            // Lần 2 theo cân đối: xử lý chênh lệch thay cho chọn đủ / thiếu / thừa
            return round.handlingRequired ? (
              <FreshHandlingCard
                key={round.round}
                {...common}
                campusName={campus.campuses?.find((c) => String(c.id) === String(campus.campusId))?.name}
              />
            ) : (
              <FreshRoundCard key={round.round} {...common} groupOfFood={foodGroups} />
            );
          })
        )}
        {/* Tạm ẩn: hàng khô nhập qua Phiếu nhập, màn này chỉ kiểm hàng tươi. Bỏ comment khối dưới để bật lại.
        <DryIntakeCard
          dry={check.data.dry}
          campusId={campus.campusId}
          date={date}
          // BE chỉ nhận đợt hàng khô trong ngày nhận hàng; ngày khác chỉ xem
          canWrite={check.data.canManage && date === todayInput()}
          onSaved={check.setData}
        />
        */}
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        crumbs={kitchenCrumbs(KITCHEN_PAGES.freshReceipts)}
        title="Kiểm nhận hàng hôm nay"
        readOnly={!!check.data && !check.data.canManage}
      />
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
