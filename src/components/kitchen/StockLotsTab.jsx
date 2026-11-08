import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus, RotateCcw } from '@/components/ui/icons';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { CategoryNav } from '@/components/ui/CategoryNav';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FOOD_GROUP_LABELS } from '@/models/foodGroups';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { useCanManageStock, useDryFoods, useLots } from '@/hooks/kitchen/useDryStock';
import { expiryStatus, groupLotsByFood } from '@/utils/kitchen/stockLots';
import { formatPurchaseQty } from '@/utils/kitchen/stockUnits';
import { formatDate, formatMoney, normalizeText, todayInput } from '@/utils/format';

const PAGE = 8;
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

/** Tồn kho khô của một điểm trường: mỗi lô một dòng, lô hết hạn sớm đứng trước; bố cục giống màn Thực phẩm. */
export function StockLotsTab({ campusId }) {
  const [keyword, setKeyword] = useState('');
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [foodGroup, setFoodGroup] = useState('');
  const [page, setPage] = useState(1);
  const canManage = useCanManageStock();
  const { foods } = useDryFoods();
  const lots = useLots({ campusId, includeEmpty });
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
  // Mỗi lô một dòng; từ khóa khớp tên thực phẩm hoặc số lô
  const rows = useMemo(() => {
    const q = normalizeText(keyword);
    return allGroups
      .filter((g) => !foodGroup || groupOfFood.get(String(g.food?.id)) === foodGroup)
      .flatMap((g) => g.lots.map((lot) => ({ lot, food: g.food })))
      .filter(({ lot, food }) => !q || normalizeText(food?.name).includes(q) || normalizeText(lot.lotNo).includes(q));
  }, [allGroups, foodGroup, groupOfFood, keyword]);

  const chips = [
    keyword && { key: 'keyword', label: `Từ khóa: ${keyword}`, onRemove: () => change(setKeyword)('') },
    foodGroup && { key: 'group', label: `Nhóm: ${FOOD_GROUP_LABELS[foodGroup] || foodGroup}`, onRemove: () => change(setFoodGroup)('') },
    includeEmpty && { key: 'empty', label: 'Gồm cả lô đã hết', onRemove: () => change(setIncludeEmpty)(false) },
  ].filter(Boolean);
  const filtered = chips.length > 0;
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE)));
  function change(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }
  const reset = () => {
    setKeyword('');
    setFoodGroup('');
    setIncludeEmpty(false);
    setPage(1);
  };

  let body;
  if (lots.error) body = <ErrorState error={lots.error} onRetry={lots.reload} />;
  else if (lots.loading || !lots.data) body = <LoadingState />;
  else if (!rows.length)
    body = (
      <EmptyState
        title={filtered ? 'Không có lô phù hợp' : 'Kho chưa có lô nào'}
        description={filtered ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Tồn kho tăng khi phiếu nhập được xác nhận.'}
        action={
          filtered ? (
            <button type="button" className="btn" onClick={reset}>
              <RotateCcw size={15} /> Đặt lại bộ lọc
            </button>
          ) : (
            canManage && (
              <Link className="btn btn--primary" to={`/kitchen/stock-receipts/new?campusId=${campusId}`}>
                <Plus size={16} /> Lập phiếu nhập
              </Link>
            )
          )
        }
      />
    );
  else
    body = (
      <div className="table-wrap">
        <table className="table table--grid table--wrap-head kb-lots-table">
          <thead>
            <tr>
              <th>Số lô</th>
              <th>Thực phẩm</th>
              <th>Hạn sử dụng</th>
              <th>Ngày nhập</th>
              <th>Nhà cung cấp</th>
              <th className="num">Đã nhập</th>
              <th className="num">Còn lại</th>
              <th className="money">Đơn giá</th>
            </tr>
          </thead>
          <tbody>
            {paginate(rows, safePage, PAGE).map(({ lot, food }) => (
              <tr key={lot.id}>
                <td className="muted nowrap">{lot.lotNo}</td>
                <td className="fw-600">{food?.name}</td>
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
        </table>
      </div>
    );

  // Xuất tồn theo lô ra CSV (mở bằng Excel): số lượng theo đơn vị mua như trên bảng
  const exportCsv = () =>
    exportWithPreview(
      [
        ['Số lô', 'Thực phẩm', 'Hạn sử dụng', 'Ngày nhập', 'Nhà cung cấp', 'Đã nhập', 'Còn lại', 'Đơn giá'],
        ...rows.map(({ lot, food }) => [
          lot.lotNo,
          food?.name,
          formatDate(lot.expiryDate),
          formatDate(lot.receivedDate),
          lot.supplierName || '',
          formatPurchaseQty(lot.quantity, lot.food),
          formatPurchaseQty(lot.remaining, lot.food),
          lot.unitPrice ?? '',
        ]),
      ],
      `ton-kho-kho-${todayInput()}.xlsx`,
    );

  return (
    <section className="card td-split-nav">
      <CategoryNav title="Nhóm thực phẩm" items={navItems} value={foodGroup} onChange={change(setFoodGroup)} />
      <div className="td-split-nav__main">
        <div className="filter-bar filter-bar--aligned">
          <SearchSubmit
            className="td-grow"
            value={keyword}
            placeholder="Tìm số lô hoặc tên thực phẩm"
            label="Tìm lô"
            onSearch={change(setKeyword)}
          />
          <button
            type="button"
            className="btn btn--toggle"
            aria-pressed={includeEmpty}
            onClick={() => change(setIncludeEmpty)(!includeEmpty)}
          >
            Hiện cả lô đã hết
          </button>
          <button type="button" className="btn btn--ghost" onClick={reset} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
          <button type="button" className="btn" onClick={exportCsv} disabled={!rows.length}>
            <Download size={16} /> Xuất Excel
          </button>
        </div>
        <FilterChips count={lots.loading ? null : rows.length} unit="lô" chips={chips} />
        {body}
        {!lots.loading && rows.length > 0 && (
          <Pagination page={safePage} total={rows.length} onChange={setPage} pageSize={PAGE} unit="lô" />
        )}
      </div>
    </section>
  );
}
