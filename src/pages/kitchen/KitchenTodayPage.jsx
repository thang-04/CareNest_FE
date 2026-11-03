import { Link, useSearchParams } from 'react-router-dom';
import { Camera, ClipboardCheck } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { KbCampusFilter, KbDateFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useKitchenDay } from '@/hooks/kitchen/useKitchenRecords';
import {
  FOOD_STORAGE_LABELS,
  KITCHEN_COUNT_STATUS_LABELS,
  KITCHEN_MENU_STATUS_LABELS,
  KITCHEN_RECORD_PAGES,
  MEAL_BLOCK_LABELS,
  MEAL_SESSION_LABELS,
} from '@/models/kitchen/kitchenRecordConstants';
import { foodNeedRows, menuBlocks, menuBySession, servingsBySession } from '@/utils/kitchen/kitchenRecords';
import { kitchenCrumbs } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';
import '@/styles/modules/kitchen-records.css';

function MenuCard({ menu }) {
  const blocks = menuBlocks(menu);
  const rows = menuBySession(menu);
  if (!rows.length) return <p className="card__body muted">Ngày này không có món trong thực đơn đã công bố.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--grid kr-table">
        <thead>
          <tr>
            <th>Bữa ăn</th>
            {blocks.map((block) => (
              <th key={block}>{MEAL_BLOCK_LABELS[block] || block}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.session}>
              <th scope="row">{MEAL_SESSION_LABELS[row.session] || row.session}</th>
              {blocks.map((block) => (
                <td key={block}>
                  <ul className="kr-dishes">
                    {(row.byBlock[block] || []).map((dish) => (
                      <li key={dish.id}>{dish.name}</li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServingsCard({ servings }) {
  const sessions = servingsBySession(servings);
  if (!sessions.length) return <p className="card__body muted">Chưa có bữa nào có số suất đã xác nhận.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--grid kr-table">
        <thead>
          <tr>
            <th>Bữa ăn</th>
            <th>Lớp</th>
            <th className="num">Suất thường</th>
            <th className="num">Suất thay thế</th>
          </tr>
        </thead>
        <tbody>
          {sessions.flatMap((group) =>
            group.classes.map((item, i) => (
              <tr key={`${group.session}-${item.classroomId}`}>
                {i === 0 && (
                  <th scope="row" rowSpan={group.classes.length}>
                    {MEAL_SESSION_LABELS[group.session] || group.session}
                  </th>
                )}
                <td>{item.classroomName}</td>
                <td className="num">{fmtQty(item.normal)}</td>
                <td className="num">{fmtQty(item.substitute)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function FoodsCard({ foods }) {
  const rows = foodNeedRows(foods);
  if (!rows.length) return <p className="card__body muted">Chưa có lượng thực phẩm: cần thực đơn đã công bố và số suất đã xác nhận.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--grid kr-table">
        <thead>
          <tr>
            <th>Thực phẩm</th>
            <th>Loại hàng</th>
            <th className="num">Số lượng cần</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.storage}-${row.food.id}`}>
              <td>{row.food.name}</td>
              <td>{FOOD_STORAGE_LABELS[row.storage] || row.storage}</td>
              <td className="num">
                {fmtQty(row.purchaseQuantity)} {row.food.purchaseUnit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Bếp hôm nay (`/kitchen/published-menu`) cho Hiệu trưởng, Phó hiệu trưởng xem: món đã công bố theo bữa × khối, suất đã
 * xác nhận theo lớp (không tên trẻ), lượng thực phẩm cần. Tất cả do BE trả (`GET /nutrition/kitchen/day`); bếp ghi nhận qua App.
 */
export default function KitchenTodayPage() {
  const [params, setParams] = useSearchParams();
  const campus = useStockCampus();
  const date = isIsoDate(params.get('date')) ? params.get('date') : todayInput();
  const day = useKitchenDay(campus.campusId, date);

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
    body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để xem bếp hôm nay." />;
  else if (day.error) body = <ErrorState error={day.error} onRetry={day.reload} />;
  else if (day.loading || !day.data) body = <LoadingState />;
  else if (day.data.dayOff)
    body = (
      <section className="card">
        <EmptyState title="Ngày nghỉ" description={`${formatDate(date)} là ngày nghỉ, bếp không phục vụ bán trú.`} />
      </section>
    );
  else {
    const data = day.data;
    const published = data.menuStatus === 'PUBLISHED';
    body = (
      <div className="kb-stack">
        <div className="kr-summary">
          <span className="chip chip--teal">Thực đơn: {KITCHEN_MENU_STATUS_LABELS[data.menuStatus] || data.menuStatus}</span>
          <span className="chip chip--teal">Số suất: {KITCHEN_COUNT_STATUS_LABELS[data.countStatus] || data.countStatus}</span>
          {data.confirmedAt && <span className="text-sm muted">Xác nhận lúc {formatDateTime(data.confirmedAt)}</span>}
        </div>
        {!published && (
          <section className="card">
            <EmptyState
              title={data.menuStatus === 'DRAFT' ? 'Thực đơn tuần còn là bản nháp' : 'Chưa có thực đơn tuần'}
              description="Bếp chỉ nhận món, số suất và lượng thực phẩm sau khi thực đơn tuần được công bố."
            />
          </section>
        )}
        {published && (
          <>
            <section className="card" aria-label="Món theo bữa">
              <div className="card__header">
                <h2 className="card__title">Món ăn theo bữa</h2>
              </div>
              <MenuCard menu={data.menu} />
            </section>
            <section className="card" aria-label="Suất đã xác nhận">
              <div className="card__header">
                <h2 className="card__title">Suất ăn đã xác nhận theo lớp</h2>
              </div>
              <ServingsCard servings={data.servings} />
            </section>
            <section className="card" aria-label="Thực phẩm cần">
              <div className="card__header">
                <h2 className="card__title">Thực phẩm cần cho ngày</h2>
              </div>
              <FoodsCard foods={data.foods} />
            </section>
          </>
        )}
      </div>
    );
  }

  const linkTo = (page, extra = {}) => {
    const search = new URLSearchParams({ ...(campus.campusId ? { campusId: campus.campusId } : {}), ...extra }).toString();
    return search ? `${page.to}?${search}` : page.to;
  };
  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_RECORD_PAGES.today)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Bếp hôm nay</h1>
          <p className="page__desc">Món, số suất đã xác nhận và lượng thực phẩm của ngày {formatDate(date)}.</p>
        </div>
        <div className="page__actions">
          <Link className="btn" to={linkTo(KITCHEN_RECORD_PAGES.foodSamples)}>
            <ClipboardCheck size={16} /> Lưu mẫu thức ăn
          </Link>
          <Link className="btn" to={linkTo(KITCHEN_RECORD_PAGES.mealPhotos, { date })}>
            <Camera size={16} /> Ảnh bữa ăn
          </Link>
        </div>
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={setDate} />
        {campus.campusId && <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />}
      </div>
      {body}
    </div>
  );
}
