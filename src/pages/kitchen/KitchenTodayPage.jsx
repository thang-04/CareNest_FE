import { Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tabs } from '@/components/ui/Tabs';
import { dishTypeClass } from '@/utils/dishTypeClass';
import { useTabParam } from '@/hooks/useTabParam';
import { Camera, ClipboardCheck } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { KbCampusFilter, KbDateFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useDishTypeById, useKitchenDay } from '@/hooks/kitchen/useKitchenRecords';
import {
  FOOD_STORAGE_LABELS,
  KITCHEN_COUNT_STATUS_LABELS,
  KITCHEN_MENU_STATUS_LABELS,
  KITCHEN_RECORD_PAGES,
  MEAL_BLOCK_LABELS,
  MEAL_SESSION_LABELS,
} from '@/models/kitchen/kitchenRecordConstants';
import { foodNeedRows, menuBlocks, menuBySession, menuRowsOf, servingsBySession } from '@/utils/kitchen/kitchenRecords';
import { kitchenCrumbs } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';
import '@/styles/modules/kitchen.css';
import '@/styles/modules/kitchen-records.css';

// Tông trạng thái như Bán trú hôm nay: xong xanh lá, đang chờ cam, chưa có xám
const MENU_TONE = { PUBLISHED: 'green', DRAFT: 'orange', NONE: 'gray' };
const COUNT_TONE = { CONFIRMED: 'green', PARTIAL: 'orange', NONE: 'gray' };

function MenuCard({ menu, typeOf }) {
  const blocks = menuBlocks(menu);
  const rows = menuBySession(menu);
  if (!rows.length) return <p className="card__body muted">Ngày này không có món trong thực đơn đã công bố.</p>;
  return (
    // Cùng kiểu lưới với thực đơn tuần: dải tên bữa, món có vạch màu theo loại
    <div className="table-wrap td-week-wrap">
      <table className="table table--grid td-week kr-menu">
        <thead>
          <tr>
            <th className="td-week__label">Bữa ăn</th>
            {blocks.map((block) => (
              <th key={block}>{MEAL_BLOCK_LABELS[block] || block}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.session}>
              <tr className="td-week__band">
                <th scope="colgroup" colSpan={blocks.length + 1}>
                  {MEAL_SESSION_LABELS[row.session] || row.session}
                </th>
              </tr>
              {menuRowsOf(row, blocks, typeOf).map((line) => (
                <tr key={line.key}>
                  <th scope="row" className="td-week__label">
                    {line.label}
                  </th>
                  {blocks.map((block) => (
                    <td key={block}>
                      <ul className="td-week__dishes">
                        {(row.byBlock[block] || []).filter(line.pick).map((dish) => (
                          <li key={dish.id} className={`td-dish ${dishTypeClass(typeOf.get(String(dish.id)))}`}>
                            <span className="td-grow">{dish.name}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServingsCard({ servings }) {
  const sessions = servingsBySession(servings);
  if (!sessions.length) return <EmptyState title="Chưa có suất ăn" description="Chưa có bữa nào có số suất đã xác nhận." />;
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
  const [tab, setTab] = useTabParam(['menu', 'servings', 'foods']);
  const [params, setParams] = useSearchParams();
  const campus = useStockCampus();
  const date = isIsoDate(params.get('date')) ? params.get('date') : todayInput();
  const day = useKitchenDay(campus.campusId, date);
  const dishTypeOf = useDishTypeById();

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
          <StatusBadge
            tone={MENU_TONE[data.menuStatus] || 'gray'}
            label={`Thực đơn: ${KITCHEN_MENU_STATUS_LABELS[data.menuStatus] || data.menuStatus}`}
          />
          <StatusBadge
            tone={COUNT_TONE[data.countStatus] || 'gray'}
            label={`Số suất: ${KITCHEN_COUNT_STATUS_LABELS[data.countStatus] || data.countStatus}`}
          />
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
          // Chia tab (DESIGN §6.3): món · suất theo lớp · thực phẩm cần — mỗi tab một câu hỏi của bếp
          <>
            <Tabs
              ariaLabel="Phần bếp hôm nay"
              value={tab}
              onChange={setTab}
              items={[
                { key: 'menu', label: 'Món ăn theo bữa' },
                { key: 'servings', label: 'Suất ăn theo lớp' },
                { key: 'foods', label: 'Thực phẩm cần', count: data.foods?.length },
              ]}
            />
            <section className="card">
              {tab === 'menu' && <MenuCard menu={data.menu} typeOf={dishTypeOf} />}
              {tab === 'servings' && <ServingsCard servings={data.servings} />}
              {tab === 'foods' && <FoodsCard foods={data.foods} />}
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
        </div>
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={setDate} />
        {campus.campusId && <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />}
        {/* Nút đứng cùng hàng bộ lọc, căn phải (như Kho khô), không treo riêng một hàng dưới breadcrumb */}
        <div className="kb-toolbar__end">
          <Link className="btn" to={linkTo(KITCHEN_RECORD_PAGES.foodSamples)}>
            <ClipboardCheck size={16} /> Lưu mẫu thức ăn
          </Link>
          <Link className="btn" to={linkTo(KITCHEN_RECORD_PAGES.mealPhotos, { date })}>
            <Camera size={16} /> Ảnh bữa ăn
          </Link>
        </div>
      </div>
      {body}
    </div>
  );
}
