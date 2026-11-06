import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus } from '@/components/ui/icons';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { CategoryNav } from '@/components/ui/CategoryNav';
import { FOOD_GROUP_LABELS } from '@/models/foodGroups';
import { EmptyState, ErrorState, LoadingState, SearchSelect, StatusBadge } from '@/components';
import { useCanManageStock, useDryFoods, useLots } from '@/hooks/kitchen/useDryStock';
import { expiryStatus, groupLotsByFood } from '@/utils/kitchen/stockLots';
import { formatPurchaseQty } from '@/utils/kitchen/stockUnits';
import { formatDate, formatMoney, todayInput } from '@/utils/format';

const EXPIRY_BADGE = {
  EXPIRED: ['red', () => 'Quá hạn'],
  SOON: ['orange', (days) => (days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`)],
};

function ExpiryCell({ expiryDate }) {
  const { state, days } = expiryStatus(expiryDate, todayInput());
  const badge = EXPIRY_BADGE[state];
  return (
    <span className="nowrap">
      {formatDate(expiryDate)}
      {badge && (
        <span className="kb-chip-after">
          <StatusBadge tone={badge[0]} label={badge[1](days)} />
        </span>
      )}
    </span>
  );
}

/** Tồn kho khô của một điểm trường: lô còn hàng gom theo thực phẩm, lô hết hạn sớm đứng trước. */
export function StockLotsTab({ campusId }) {
  const [foodId, setFoodId] = useState('');
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const canManage = useCanManageStock();
  const { foods } = useDryFoods();
  const lots = useLots({ campusId, foodId, includeEmpty });
  const [foodGroup, setFoodGroup] = useState('');
  const allGroups = useMemo(() => groupLotsByFood(lots.data || []), [lots.data]);
  const groupOfFood = useMemo(() => new Map(foods.map((f) => [String(f.id), f.group])), [foods]);
  // Danh mục nhóm thực phẩm bên trái như màn Thực phẩm: chỉ hiện nhóm có hàng trong kho
  const navItems = useMemo(
    () => [
      { key: '', label: 'Tất cả', count: allGroups.length },
      ...Object.entries(FOOD_GROUP_LABELS)
        .map(([key, label]) => ({ key, label, count: allGroups.filter((g) => groupOfFood.get(String(g.food?.id)) === key).length }))
        .filter((item) => item.count > 0),
    ],
    [allGroups, groupOfFood],
  );
  const groups = useMemo(
    () => (foodGroup ? allGroups.filter((g) => groupOfFood.get(String(g.food?.id)) === foodGroup) : allGroups),
    [allGroups, foodGroup, groupOfFood],
  );
  const foodOptions = useMemo(
    () => [{ value: '', label: 'Tất cả thực phẩm' }, ...foods.map((f) => ({ value: String(f.id), label: f.name }))],
    [foods],
  );

  let body;
  if (lots.error) body = <ErrorState error={lots.error} onRetry={lots.reload} />;
  else if (lots.loading || !lots.data) body = <LoadingState />;
  else if (!groups.length)
    body = (
      <EmptyState
        title="Kho chưa có lô nào"
        description={foodId || includeEmpty ? 'Không có lô khớp bộ lọc.' : 'Tồn kho tăng khi phiếu nhập được xác nhận.'}
        action={
          canManage && (
            <Link className="btn btn--primary" to={`/kitchen/stock-receipts/new?campusId=${campusId}`}>
              <Plus size={16} /> Lập phiếu nhập
            </Link>
          )
        }
      />
    );
  else
    body = (
      <div className="table-wrap">
        <table className="table table--grid">
          <thead>
            <tr>
              <th>Thực phẩm / lô</th>
              <th>Hạn sử dụng</th>
              <th>Ngày nhập</th>
              <th>Nhà cung cấp</th>
              <th className="num">Đã nhập</th>
              <th className="num">Còn lại</th>
              <th className="money">Đơn giá</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.food?.id}>
              <tr className="kb-group-row">
                <th scope="rowgroup" colSpan={5}>
                  {group.food?.name}
                </th>
                <th className="num">{formatPurchaseQty(group.remaining, group.food)}</th>
                <th />
              </tr>
              {group.lots.map((lot) => (
                <tr key={lot.id}>
                  <td className="kb-lot-name">Lô {lot.lotNo}</td>
                  <td>
                    <ExpiryCell expiryDate={lot.expiryDate} />
                  </td>
                  <td>{formatDate(lot.receivedDate)}</td>
                  <td>{lot.supplierName || <span className="muted">—</span>}</td>
                  <td className="num nowrap">{formatPurchaseQty(lot.quantity, lot.food)}</td>
                  <td className="num nowrap fw-600">{formatPurchaseQty(lot.remaining, lot.food)}</td>
                  <td className="money nowrap">
                    {lot.unitPrice == null ? '—' : `${formatMoney(lot.unitPrice)}/${lot.food?.purchaseUnit || ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    );

  // Xuất tồn theo lô ra CSV (mở bằng Excel): số lượng theo đơn vị mua như trên bảng
  const exportCsv = () =>
    exportWithPreview(
      [
        ['Thực phẩm', 'Số lô', 'Hạn sử dụng', 'Ngày nhập', 'Nhà cung cấp', 'Đã nhập', 'Còn lại', 'Đơn giá'],
        ...groups.flatMap((g) =>
          g.lots.map((lot) => [
            g.food?.name,
            lot.lotNo,
            formatDate(lot.expiryDate),
            formatDate(lot.receivedDate),
            lot.supplierName || '',
            formatPurchaseQty(lot.quantity, lot.food),
            formatPurchaseQty(lot.remaining, lot.food),
            lot.unitPrice ?? '',
          ]),
        ),
      ],
      `ton-kho-kho-${todayInput()}.xlsx`,
    );

  return (
    <section className="card td-split-nav">
      <CategoryNav title="Nhóm thực phẩm" items={navItems} value={foodGroup} onChange={setFoodGroup} />
      <div className="td-split-nav__main">
        <div className="card__body kb-toolbar kb-toolbar--card">
          <div className="field kb-field-food">
            <span className="field__label">Thực phẩm</span>
            <SearchSelect options={foodOptions} value={foodId} onChange={setFoodId} ariaLabel="Lọc theo thực phẩm" />
          </div>
          <label className="kb-check">
            <input type="checkbox" checked={includeEmpty} onChange={(e) => setIncludeEmpty(e.target.checked)} /> Hiện cả lô đã hết
          </label>
          <button type="button" className="btn kb-toolbar__end" onClick={exportCsv} disabled={!groups.length}>
            <Download size={16} /> Xuất Excel
          </button>
        </div>
        {body}
      </div>
    </section>
  );
}
