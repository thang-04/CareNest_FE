import { Fragment } from 'react';
import { EmptyState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ContractStatusBadge, contractNeedsAttention } from '@/components/menu-planning/ContractStatusBadge';
import { NormRowBadge } from '@/components/menu-planning/MenuBadges';
import { DISH_TYPE_LABELS, MEAL_SESSION_LABELS, SESSION_ORDER, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { dishTypeClass } from '@/utils/dishTypeClass';
import { BIG_UNITS, buysInBaseUnit, dishNutrition, storageGroups, supplierGroups } from '@/utils/menu-planning/menuStatistics';

/*
 * Bảng thống kê một ngày thực đơn cho N trẻ (BE `POST /nutrition/menu-statistics`): thực phẩm × N trẻ, bảng dinh dưỡng
 * so định mức gam/P:L:G, % năng lượng từng bữa. Mọi số do BE tính; màn chỉ đổi đơn vị hiển thị (g → kg, ml → lít).
 */
const num = (v, digits = 1) => (v == null || v === '' ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: digits }));
const big = (v, unit) => (BIG_UNITS[unit] ? `${num(Number(v) / 1000, 2)} ${BIG_UNITS[unit]}` : `${num(v, 2)} ${unit || ''}`);
const range = (row, suffix = '', digits = 1) =>
  row?.min == null ? 'Chưa đặt' : `${num(row.min, digits)}–${num(row.max, digits)}${suffix}`;
const CELL_TONES = { OK: 'td-stat--ok', LOW: 'td-stat--low', HIGH: 'td-stat--high' };
// Cơ cấu áp dụng: % trường đã cấu hình ở Định mức dinh dưỡng (BE trả `applied` trên dòng đạm, béo, bột đường)
const appliedLabel = (row) => (row?.applied == null ? 'Chưa đặt' : num(row.applied));
const cellTone = (row) => CELL_TONES[row?.status] || '';

/** Bảng món theo bữa (sáng → trưa → chiều); số một suất đọc từ danh mục món theo nhóm tuổi đang xem. */
export function StatisticsDishes({ dishes, catalog, ageGroup }) {
  if (!dishes.length) return <EmptyState title="Ngày này chưa có món" description="Nhóm tuổi này chưa có món trong ngày." />;
  const byId = Object.fromEntries((catalog || []).map((d) => [String(d.id), d]));
  const sessions = SESSION_ORDER.filter((s) => dishes.some((d) => d.session === s));
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-stat-table">
        <thead>
          <tr>
            <th>Bữa ăn</th>
            <th>Món ăn</th>
            <th className="center">Loại món</th>
            <th className="num">Năng lượng (kcal)</th>
            <th className="num">Đạm (g)</th>
            <th className="num">Béo (g)</th>
            <th className="num">Bột đường (g)</th>
          </tr>
        </thead>
        <tbody>
          {sessions.flatMap((s) => {
            const rows = dishes.filter((d) => d.session === s);
            return rows.map((d, i) => {
              const n = dishNutrition(byId[String(d.dishId)], ageGroup);
              return (
                <tr key={`${s}-${d.dishId}`}>
                  {i === 0 && (
                    <th scope="rowgroup" rowSpan={rows.length} className="td-stat-table__session">
                      {MEAL_SESSION_LABELS[s] || s}
                    </th>
                  )}
                  <td>{d.dishName}</td>
                  <td className="center">
                    <span className={`td-dish-type ${dishTypeClass(d.dishType)}`}>{DISH_TYPE_LABELS[d.dishType] || 'Món khác'}</span>
                  </td>
                  <td className="num">{num(n?.kcal)}</td>
                  <td className="num">{num(n?.protein)}</td>
                  <td className="num">{num(n?.lipid)}</td>
                  <td className="num">{num(n?.glucid)}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Nhãn nguồn giá hàng khô (NUT-27): giá lô FEFO trên tồn của điểm trường, phần thiếu kho theo giá danh mục. */
function PriceSourceTags({ row }) {
  const short = Number(row.stockShortQty) > 0;
  if (row.priceSource !== 'LOT' && row.priceSource !== 'MIXED' && !short) return null;
  return (
    <span className="td-chips">
      {row.priceSource === 'LOT' && <StatusBadge tone="blue" label="Giá lô" size="sm" />}
      {row.priceSource === 'MIXED' && <StatusBadge tone="blue" label="Giá lô + danh mục" size="sm" />}
      {short && <StatusBadge tone="orange" label={`Thiếu kho ${big(row.stockShortQty, row.unit)}`} size="sm" />}
    </span>
  );
}

const COST_HINT = 'Tiền = lượng mua (trước làm tròn ĐVT) × đơn giá; không theo số đơn vị mua đã làm tròn.';

/** Bảng thực phẩm × N trẻ; `groupBy` = 'storage' (Tươi/Khô) hoặc 'supplier' (danh sách đặt hàng theo NCC). */
export function StatisticsIngredients({ stats, groupBy = 'storage' }) {
  const n = stats.children;
  // Nhóm và tổng nhóm đều do BE trả; thiếu trường (BE cũ) ⇒ một bảng
  const groups = groupBy === 'supplier' ? supplierGroups(stats) : storageGroups(stats);
  const showSupplier = groupBy !== 'supplier' || !groups;
  const cols = showSupplier ? 9 : 8;
  return (
    <>
      <div className="table-wrap">
        <table className="table table--grid table--compact table--wrap-head td-stat-table">
          <thead>
            <tr>
              <th className="num">STT</th>
              <th>Tên thực phẩm</th>
              {showSupplier && <th>Nhà cung cấp</th>}
              <th className="num">Lượng ăn 1 trẻ</th>
              <th className="num">Lượng ăn {n} trẻ</th>
              <th className="num">Thải bỏ (%)</th>
              <th className="num">Lượng mua {n} trẻ</th>
              <th className="money">Đơn giá</th>
              <th className="money" title={COST_HINT}>
                Tiền ăn {n} trẻ (theo lượng dùng)
              </th>
            </tr>
          </thead>
          <tbody>
            {!stats.ingredients.length && (
              <tr>
                <td colSpan={cols}>
                  <EmptyState
                    title={`Các món chưa có định lượng cho ${stats.ageGroupName || 'nhóm tuổi này'}`}
                    description="Nhập định lượng ở màn Món ăn để có số liệu."
                  />
                </td>
              </tr>
            )}
            {(groups || [{ key: 'ALL', rows: stats.ingredients }]).map((g) => (
              <Fragment key={g.key}>
                {groups && (
                  <tr className="td-stat-group">
                    <th colSpan={cols} scope="colgroup">
                      {g.title} · {g.rows.length} thực phẩm
                      {contractNeedsAttention(g.contractStatus) && (
                        <>
                          {' '}
                          <ContractStatusBadge status={g.contractStatus} size="sm" />
                        </>
                      )}
                    </th>
                  </tr>
                )}
                {g.rows.map((r, i) => (
                  <tr key={r.foodId}>
                    <td className="num muted">{i + 1}</td>
                    <td>
                      {r.foodName}
                      <PriceSourceTags row={r} />
                    </td>
                    {showSupplier && (
                      <td>
                        {r.supplierName || <span className="muted">Chưa gán</span>}
                        {contractNeedsAttention(r.contractStatus) && (
                          <>
                            {' '}
                            <ContractStatusBadge status={r.contractStatus} size="sm" />
                          </>
                        )}
                      </td>
                    )}
                    <td className="num nowrap">
                      {num(r.gramsPerChild, 2)} {r.unit}
                    </td>
                    <td className="num nowrap">{big(r.eatenTotal, r.unit)}</td>
                    <td className="num">{num(r.wastePct)}</td>
                    <td className="num nowrap">
                      {r.purchaseUnit ? (
                        <>
                          <span className="fw-600">
                            {num(r.purchaseQty, 3)} {r.purchaseUnit}
                          </span>
                          {!buysInBaseUnit(r) && <div className="text-sm muted">{big(r.purchaseTotal, r.unit)}</div>}
                        </>
                      ) : (
                        big(r.purchaseTotal, r.unit)
                      )}
                    </td>
                    <td className="money nowrap">
                      {r.unitPrice == null ? '—' : `${formatMoney(r.unitPrice)}${r.purchaseUnit ? ` / ${r.purchaseUnit}` : ''}`}
                    </td>
                    <td className="money nowrap fw-600">{formatMoney(r.cost)}</td>
                  </tr>
                ))}
                {groups && (
                  <tr className="td-stat-subtotal">
                    <td />
                    <td colSpan={cols - 2}>Tổng {groupBy === 'supplier' ? g.title : g.title.toLowerCase()}</td>
                    <td className="money nowrap">{formatMoney(g.total)}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td colSpan={cols - 2} className="fw-600">
                Tổng tiền ăn {n} trẻ
              </td>
              <td className="money nowrap fw-600">{formatMoney(stats.totalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm muted mt-8">
        {COST_HINT} Nhà cung cấp và đơn giá theo mức giá hiệu lực tại ngày thực đơn. Hàng khô của điểm trường tính theo giá lô (hết hạn
        trước dùng trước) trên tồn hiện tại; phần thiếu kho tính theo giá danh mục.
      </p>
    </>
  );
}

const GRAM_KEYS = ['animalProteinG', 'plantProteinG', 'animalLipidG', 'plantLipidG', 'glucidG'];

/** Bảng dinh dưỡng: tổng, định mức gam/ngày (hàm lượng quy đổi, BE NUT-34), tỷ lệ đạt, cơ cấu P:L:G áp dụng và thực tế. */
export function StatisticsNutrition({ stats }) {
  const ev = stats.evaluation || {};
  const t = ev.totals || {};
  const row = Object.fromEntries((ev.rows || []).map((r) => [r.key, r]));
  // Chưa có định lượng món thì tổng là "—" (thiếu dữ liệu), không hiện 0 như số thật; "Chưa đặt" chỉ dành cho thiếu định mức
  const noQuantity = !stats.ingredients?.length;
  const values = [t.animalProtein, t.plantProtein, t.animalLipid, t.plantLipid, t.glucid];
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-stat-table">
        <thead>
          <tr>
            <th rowSpan={2}>Một trẻ / ngày</th>
            <th colSpan={2} className="center td-col-p">
              Đạm (g)
            </th>
            <th colSpan={2} className="center td-col-l">
              Béo (g)
            </th>
            <th rowSpan={2} className="num td-col-g">
              Đường (g)
            </th>
            <th rowSpan={2} className="num">
              Calo (kcal)
            </th>
            <th rowSpan={2} className="money">
              Tiền ăn 1 trẻ
            </th>
          </tr>
          <tr>
            <th className="num td-col-p">Động vật</th>
            <th className="num td-col-p">Thực vật</th>
            <th className="num td-col-l">Động vật</th>
            <th className="num td-col-l">Thực vật</th>
          </tr>
        </thead>
        <tbody>
          <tr className="fw-600">
            <td>Tổng cộng</td>
            {values.map((v, i) => (
              <td key={i} className="num">
                {noQuantity ? '—' : num(v)}
              </td>
            ))}
            <td className="num">
              <span className="td-tag td-tag--orange">{noQuantity ? '—' : num(t.kcal)}</span>
            </td>
            <td className="money nowrap">
              <span className="td-tag td-tag--green">{noQuantity ? '—' : formatMoney(stats.costPerChild)}</span>
            </td>
          </tr>
          <tr>
            <td>Định mức một ngày</td>
            {GRAM_KEYS.map((k) => (
              <td key={k} className="num nowrap">
                {range(row[k], '', 2)}
              </td>
            ))}
            <td className="num nowrap">{range(row.kcal)}</td>
            <td className="money nowrap">
              {(stats.foodBudget ?? stats.mealPrice) == null ? 'Chưa đặt' : formatMoney(stats.foodBudget ?? stats.mealPrice)}
            </td>
          </tr>
          <tr>
            <td>Tỷ lệ đạt (%)</td>
            {GRAM_KEYS.map((k) => (
              <td key={k} className={`num ${cellTone(row[k])}`}>
                {row[k]?.attainment == null ? '—' : row[k].attainment}
              </td>
            ))}
            <td className={`num ${cellTone(row.kcal)}`}>{row.kcal?.attainment == null ? '—' : row.kcal.attainment}</td>
            <td className="money nowrap">
              {stats.mealPrice == null || noQuantity
                ? '—'
                : `Chênh ${formatMoney(Number(stats.foodBudget ?? stats.mealPrice) - Number(stats.costPerChild || 0))}`}
            </td>
          </tr>
          <tr>
            <td>Cơ cấu áp dụng P : L : G (%)</td>
            <td colSpan={2} className="center">
              {appliedLabel(row.protein)}
            </td>
            <td colSpan={2} className="center">
              {appliedLabel(row.lipid)}
            </td>
            <td className="num nowrap">{appliedLabel(row.glucid)}</td>
            <td colSpan={2} />
          </tr>
          <tr>
            <td>Tỷ lệ P : L : G thực tế (%)</td>
            <td colSpan={2} className={`center ${cellTone(row.protein)}`}>
              {num(row.protein?.percent)}
            </td>
            <td colSpan={2} className={`center ${cellTone(row.lipid)}`}>
              {num(row.lipid?.percent)}
            </td>
            <td className={`num ${cellTone(row.glucid)}`}>{num(row.glucid?.percent)}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Đánh giá % năng lượng từng bữa so định mức (NUT-25). */
export function StatisticsSessions({ sessions, noQuantity = false }) {
  if (!sessions?.length) return <EmptyState title="Chưa có bữa nào để đánh giá" description="Thêm món cho ngày này rồi xem lại." />;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact">
        <thead>
          <tr>
            <th>Bữa ăn</th>
            <th className="num">kcal</th>
            <th className="num">% nhu cầu cả ngày</th>
            <th className="num">Định mức (%)</th>
            <th className="center">Đánh giá</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.session}>
              <td>{MEAL_SESSION_LABELS[s.session] || s.session}</td>
              <td className="num">{noQuantity ? '—' : num(s.kcal)}</td>
              <td className="num">{num(s.percent)}</td>
              <td className="num nowrap">{range(s)}</td>
              <td className="center">
                <NormRowBadge status={s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
