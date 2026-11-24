import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Download, Plus, RotateCcw } from '@/components/ui/icons';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { CategoryNav } from '@/components/ui/CategoryNav';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FOOD_GROUP_LABELS } from '@/models/foodGroups';
import { Button, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { useCanManageStock, useDryFoods, useLots } from '@/hooks/kitchen/useDryStock';
import { expiryStatus, groupLotsByFood } from '@/utils/kitchen/stockLots';
import { formatPurchaseQty, toPurchaseQuantity } from '@/utils/kitchen/stockUnits';
import { formatDate, formatMoney, formatQty, normalizeText, todayInput } from '@/utils/format';

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

// Số theo đơn vị mua, không kèm đơn vị (đơn vị có cột riêng)
const qtyOf = (quantity, food) => formatQty(toPurchaseQuantity(quantity, food));

/**
 * Tồn kho khô của một điểm trường theo bảng PMS: mỗi thực phẩm một dòng nhóm "Tên - Số lượng tồn: N", dưới là từng lô
 * (Nhập / Xuất / Tồn); trong thực phẩm lô hết hạn sớm đứng trước (thứ tự BE trả). Xuất = nhập − còn lại của lô.
 */
export function StockLotsTab({ campusId }) {
  const [keyword, setKeyword] = useState('');
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [foodGroup, setFoodGroup] = useState('');
  const [page, setPage] = useState(1);
  // Mặc định mở hết các lô như bảng PMS; chỉ nhớ nhóm người dùng thu gọn
  const [collapsed, setCollapsed] = useState(() => new Set());
  const canManage = useCanManageStock(campusId);
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
  // Mỗi thực phẩm một dòng; khớp tên thì giữ mọi lô, chỉ khớp số lô thì chỉ giữ lô đó và mở sẵn
  const rows = useMemo(() => {
    const q = normalizeText(keyword);
    return allGroups
      .filter((g) => !foodGroup || groupOfFood.get(String(g.food?.id)) === foodGroup)
      .map((g) => {
        if (!q || normalizeText(g.food?.name).includes(q)) return { ...g, byLot: false };
        const lotsHit = g.lots.filter((lot) => normalizeText(lot.lotNo).includes(q));
        // Tổng còn lại theo đúng các lô đang hiện
        return lotsHit.length ? { ...groupLotsByFood(lotsHit)[0], byLot: true } : null;
      })
      .filter(Boolean);
  }, [allGroups, foodGroup, groupOfFood, keyword]);
  const lotCount = rows.reduce((n, g) => n + g.lots.length, 0);
  const keyOf = (g) => String(g.food?.id);
  const isOpen = (g) => g.byLot || !collapsed.has(keyOf(g));
  const toggle = (g) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(keyOf(g))) next.delete(keyOf(g));
      else next.add(keyOf(g));
      return next;
    });
  const allOpen = rows.length > 0 && rows.every(isOpen);
  const toggleAll = () => setCollapsed(allOpen ? new Set(rows.map(keyOf)) : new Set());

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
        title={filtered ? 'Không có thực phẩm phù hợp' : 'Kho chưa có lô nào'}
        description={filtered ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Tồn kho tăng khi phiếu nhập được xác nhận.'}
        action={
          filtered ? (
            <Button icon={RotateCcw} onClick={reset}>
              Đặt lại bộ lọc
            </Button>
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
              <th rowSpan={2}>Tên thực phẩm</th>
              <th rowSpan={2} className="money">
                Đơn giá
              </th>
              <th colSpan={3} className="center">
                Số lượng
              </th>
              <th rowSpan={2} className="center">
                Đơn vị tính
              </th>
              <th rowSpan={2} className="center">
                Ngày nhập
              </th>
              <th rowSpan={2} className="center">
                Hạn sử dụng
              </th>
              <th rowSpan={2}>Nhà cung cấp</th>
            </tr>
            <tr>
              <th className="num">Nhập</th>
              <th className="num">Xuất</th>
              <th className="num">Tồn</th>
            </tr>
          </thead>
          <tbody>
            {paginate(rows, safePage, PAGE).map((g) => {
              const expanded = isOpen(g);
              return (
                <Fragment key={keyOf(g)}>
                  <tr className="kb-lots-food">
                    <td colSpan={9}>
                      <Button
                        variant="link"
                        className="kb-lots-toggle"
                        icon={expanded ? ChevronDown : ChevronRight}
                        aria-expanded={expanded}
                        onClick={() => toggle(g)}
                      >
                        {g.food?.name} - Số lượng tồn: {formatPurchaseQty(g.remaining, g.food)}
                      </Button>
                      <span className="muted text-sm kb-lots-count">{g.lots.length} lô</span>
                    </td>
                  </tr>
                  {expanded &&
                    g.lots.map((lot) => (
                      <tr key={lot.id} className="kb-lots-lot">
                        <td className="muted">{g.food?.name} · Lô {lot.lotNo}</td>
                        <td className="money nowrap">{lot.unitPrice == null ? '—' : formatMoney(lot.unitPrice)}</td>
                        <td className="num nowrap">{qtyOf(lot.quantity, lot.food)}</td>
                        <td className="num nowrap">{qtyOf(lot.quantity - lot.remaining, lot.food)}</td>
                        <td className="num nowrap fw-600">{qtyOf(lot.remaining, lot.food)}</td>
                        <td className="center nowrap">{lot.food?.purchaseUnit || '—'}</td>
                        <td className="center">{formatDate(lot.receivedDate)}</td>
                        <td className="center">
                          <ExpiryCell expiryDate={lot.expiryDate} />
                        </td>
                        <td>{lot.supplierName || <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  // Xuất tồn theo lô ra CSV (mở bằng Excel): số lượng theo đơn vị mua như trên bảng
  const exportCsv = () =>
    exportWithPreview(
      [
        ['Số lô', 'Thực phẩm', 'Đơn giá', 'Nhập', 'Xuất', 'Tồn', 'Đơn vị tính', 'Ngày nhập', 'Hạn sử dụng', 'Nhà cung cấp'],
        ...rows.flatMap(({ lots: list, food }) =>
          list.map((lot) => [
            lot.lotNo,
            food?.name,
            lot.unitPrice ?? '',
            qtyOf(lot.quantity, lot.food),
            qtyOf(lot.quantity - lot.remaining, lot.food),
            qtyOf(lot.remaining, lot.food),
            lot.food?.purchaseUnit || '',
            formatDate(lot.receivedDate),
            formatDate(lot.expiryDate),
            lot.supplierName || '',
          ]),
        ),
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
          <Button variant="ghost" icon={RotateCcw} onClick={reset} disabled={!filtered}>
            Đặt lại bộ lọc
          </Button>
          <Button variant="ghost" icon={allOpen ? ChevronsDownUp : ChevronsUpDown} onClick={toggleAll} disabled={!rows.length}>
            {allOpen ? 'Thu gọn tất cả' : 'Mở tất cả lô'}
          </Button>
          <Button icon={Download} onClick={exportCsv} disabled={!rows.length}>
            Xuất Excel
          </Button>
        </div>
        <FilterChips count={lots.loading ? null : rows.length} unit={`thực phẩm · ${lotCount} lô`} chips={chips} />
        {body}
        {!lots.loading && rows.length > 0 && (
          <Pagination page={safePage} total={rows.length} onChange={setPage} pageSize={PAGE} unit="thực phẩm" />
        )}
      </div>
    </section>
  );
}
