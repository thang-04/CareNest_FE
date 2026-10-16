import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Coin, PackageMinus, Printer, Receipt, Scale } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useRequiredQuantity } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { Modal } from '@/components/ui/Modal';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { IssueStatusBadge } from '@/components/kitchen/KitchenBadges';
import { KbDateFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { MarketSheetPrint } from '@/components/kitchen/MarketSheetPrint';
import { AutoChecks } from '@/components/menu-planning/AutoChecks';
import { canSubmitMissingFood, isVicePrincipal } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import { FOOD_STORAGE_LABELS, addDays, formatMoney, mondayOf } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/kitchen.css';
// Khối Kiểm tra tự động dùng chung với luồng thực đơn
import '@/styles/modules/menu-planning.css';

// Ngày thứ Hai–Sáu liền trước, để xem nhanh ngày đã có số suất khi hôm nay chưa chốt
const prevWeekday = (iso) => {
  let d = addDays(iso, -1);
  while ([0, 6].includes(new Date(`${d}T00:00:00`).getDay())) d = addDays(d, -1);
  return d;
};
const qty = (n, unit) => `${Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${unit}`;

/**
 * Bước 5 luồng dinh dưỡng – Khẩu phần & đi chợ (bố cục 7): bảng gộp theo thực phẩm bên trái, cột phải Tổng thu / Tổng chi /
 * Chênh lệch và "Kiểm tra tự động". Mọi số do service tính (NUT-07); trang chỉ hiển thị. Phiếu xuất kho, báo thiếu giữ ở cuối.
 */
export default function RequiredFoodQuantityPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const campusId = user?.campusId;
  const { data, loading, error, reload } = useRequiredQuantity(campusId, date);
  const [printing, setPrinting] = useState(false);
  const sheetRef = useRef(null);
  const canReport = canSubmitMissingFood(user) && date >= todayInput();
  const ready = data?.status === 'READY' && data.foods.length > 0;
  const campus = md.campusById(campusId);
  const prev = prevWeekday(date);
  const goPrev = (
    <button type="button" className="btn" onClick={() => setParams({ date: prev }, { replace: true })}>
      Xem ngày {formatDate(prev)}
    </button>
  );

  const head = (
    <div className="page__head">
      <div>
        <h1 className="page__title">Khẩu phần & đi chợ</h1>
        <p className="page__desc">Lượng mua = số suất đã chốt × lượng ăn 1 trẻ ÷ (1 − thải bỏ), làm tròn theo đơn vị mua. Không dùng AI.</p>
      </div>
      <div className="page__actions">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        {canReport && (
          <Link className="btn" to={`/kitchen/missing-food?new=1&date=${date}`}>
            <PackageMinus size={16} /> Báo thiếu thực phẩm
          </Link>
        )}
        <button type="button" className="btn btn--primary" disabled={!ready} onClick={() => setPrinting(true)}>
          <Printer size={16} /> In phiếu đi chợ
        </button>
      </div>
    </div>
  );

  let body;
  if (loading) body = <LoadingState />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (data.status === 'NO_MENU')
    body = (
      <section className="card">
        <EmptyState
          title={`Chưa có thực đơn đã xuất bản ngày ${formatDate(date)}`}
          description="Phiếu đi chợ tính từ thực đơn tuần đã xuất bản và số suất đã chốt."
          action={
            <div className="row td-chips">
              {goPrev}
              {isVicePrincipal(user) && (
                <Link className="btn" to={`/menu/weekly?week=${mondayOf(date)}`}>
                  Mở Thực đơn tuần
                </Link>
              )}
            </div>
          }
        />
      </section>
    );
  else if (data.status === 'WAITING_MEAL_COUNT')
    body = (
      <section className="card">
        <EmptyState
          title={`Chưa chốt số suất ngày ${formatDate(date)}`}
          description="Phiếu đi chợ tính từ số suất đã xác nhận ở Điểm danh & suất ăn và thực đơn tuần đã xuất bản."
          action={
            <div className="row td-chips">
              <Link className="btn btn--primary" to={`/kitchen/meal-count?date=${date}`}>
                Mở Số suất ăn đã xác nhận
              </Link>
              {goPrev}
            </div>
          }
        />
      </section>
    );
  else
    body = (
      <div className="kb-market">
        <section className="card">
          <div className="table-wrap kb-market__table">
            <table className="table">
              <thead>
                <tr>
                  <th>Thực phẩm</th>
                  <th className="right">Lượng ăn</th>
                  <th className="right">Thải bỏ %</th>
                  <th className="right">Lượng mua</th>
                  <th className="right">Mua theo ĐVT</th>
                  <th className="right">Đơn giá</th>
                  <th className="right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {data.foods.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted text-sm">
                      Bữa đã chốt chưa có món cần mua.
                    </td>
                  </tr>
                ) : (
                  data.foods.map((f) => (
                    <tr key={f.foodId} className={f.unitPrice == null ? 'kb-row--warn' : undefined}>
                      <td>
                        <span className="fw-600">{f.name}</span>
                        {f.storage && <span className="text-xs muted kb-storage">{FOOD_STORAGE_LABELS[f.storage]}</span>}
                      </td>
                      <td className="right nowrap">{qty(f.eatQty, f.unit)}</td>
                      <td className="right">{fmtQty(f.wastePct)}</td>
                      <td className="right nowrap">{qty(f.buyQty, f.unit)}</td>
                      <td className="right nowrap fw-600">{qty(f.buyUnits, f.purchaseUnit)}</td>
                      <td className="right nowrap">
                        {f.unitPrice == null ? <span className="chip chip--orange">Chưa có</span> : formatMoney(f.unitPrice)}
                      </td>
                      <td className="right nowrap">{f.amount == null ? '—' : formatMoney(f.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="kb-market__aside">
          <div className="stat-card stat-card--green">
            <span className="stat-card__label">Tổng thu</span>
            <span className="stat-card__value kb-money">{formatMoney(data.revenue.total)}</span>
            <span className="kb-stat-hint">
              {data.revenue.parts.map((p) => `${p.servings} × ${p.price.toLocaleString('vi-VN')}`).join(' + ') ||
                'Chưa có suất trưa đã chốt'}
            </span>
            <span className="stat-card__icon" aria-hidden="true">
              <Coin size={76} stroke={1.75} />
            </span>
          </div>
          <div className="stat-card stat-card--blue">
            <span className="stat-card__label">Tổng chi</span>
            <span className="stat-card__value kb-money">{formatMoney(data.cost.total)}</span>
            <span className="kb-stat-hint">
              {data.cost.missingPrice.length ? `Chưa gồm ${data.cost.missingPrice.join(', ')}` : 'Đủ đơn giá'}
            </span>
            <span className="stat-card__icon" aria-hidden="true">
              <Receipt size={76} stroke={1.75} />
            </span>
          </div>
          <div className={`stat-card stat-card--${data.balance < 0 ? 'red' : 'orange'}`}>
            <span className="stat-card__label">Chênh lệch</span>
            <span className="stat-card__value kb-money">{formatMoney(data.balance)}</span>
            <span className="kb-stat-hint">Thu − chi</span>
            <span className="stat-card__icon" aria-hidden="true">
              <Scale size={76} stroke={1.75} />
            </span>
          </div>
          <AutoChecks
            note="Tính từ số suất đã chốt và thực đơn tuần đã xuất bản."
            items={[
              ...data.substitutes.map((s) => ({
                tone: 'warn',
                text: `Suất thay thế: ${s.original} → ${s.replacement || 'bỏ món'} · ${s.servings} suất`,
              })),
              ...data.checks,
            ]}
          />
        </aside>
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.requiredQuantity)} />
      {head}
      {body}

      {data && !loading && !error && (
        <section className="card kb-issue">
          <div className="card__header">
            <h2 className="card__title">Phiếu xuất kho ngày</h2>
            <IssueStatusBadge status={data.issueState} />
          </div>
          {data.issue ? (
            <>
              <div className="card__body text-sm">
                Mã phiếu <span className="fw-600 text-primary">{data.issue.code}</span> · duyệt lúc {formatDateTime(data.issue.approvedAt)}
              </div>
              <div className="table-wrap kb-issue__table">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Thực phẩm</th>
                      <th className="right">Số lượng xuất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.issue.items.map((it) => (
                      <tr key={it.foodId}>
                        <td>{it.name}</td>
                        <td className="right nowrap">
                          {fmtQty(it.requiredQty)} {it.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.issueState === 'APPROVED' && canSubmitMissingFood(user) && (
                <div className="card__body">
                  <Link className="btn btn--primary" to={`/kitchen/ingredient-receipts?date=${date}`}>
                    Xác nhận nhận thực phẩm
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="card__body muted">Phiếu xuất kho hiển thị sau khi Phó hiệu trưởng duyệt.</div>
          )}
        </section>
      )}

      {ready && (
        <Modal
          open={printing}
          onClose={() => setPrinting(false)}
          size="xl"
          className="kb-print-modal"
          title="Phiếu đi chợ"
          footer={<PrintToolbar sheetRef={sheetRef} fileBase={`Phieu_di_cho_${date}`} printLabel="In phiếu" />}
        >
          <div className="print-preview__paper">
            <MarketSheetPrint ref={sheetRef} data={data} campusName={campus?.shortName || campus?.name} />
          </div>
        </Modal>
      )}
    </div>
  );
}
