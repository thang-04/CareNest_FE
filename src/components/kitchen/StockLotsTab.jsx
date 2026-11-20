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

/** NCC của các lô: một NCC thì hiện tên, nhiều thì hiện số NCC. */
const supplierSummary = (lots) => {
  const names = [...new Set(lots.map((l) => l.supplierName).filter(Boolean))];
  if (!names.length) return <span className="muted">—</span>;
  return names.length === 1 ? names[0] : <span title={names.join(', ')}>{names.length} nhà cung cấp</span>;
};

/**
 * Tồn kho khô của một điểm trường: mỗi thực phẩm một dòng (tổng còn lại, số lô, hạn gần nhất), bấm để mở các lô; trong
 * thực phẩm lô hết hạn sớm đứng trước (thứ tự BE trả). Bố cục giống màn Thực phẩm.
 */
export function StockLotsTab({ campusId }) {
  const [keyword, setKeyword] = useState('');
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [foodGroup, setFoodGroup] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(() => new Set());
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
  const isOpen = (g) => g.byLot || open.has(keyOf(g));
  const toggle = (g) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(keyOf(g))) next.delete(keyOf(g));
      else next.add(keyOf(g));
      return next;
    });
  const allOpen = rows.length > 0 && rows.every(isOpen);
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(rows.map(keyOf)));

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
              <th>Thực phẩm</th>
              <th className="center">Số lô</th>
              <th className="center">Hạn sử dụng</th>
              <th className="center">Ngày nhập</th>
              <th>Nhà cung cấp</th>
              <th className="num">Đã nhập</th>
              <th className="num">Còn lại</th>
              <th className="money">Đơn giá</th>
            </tr>
          </thead>
          <tbody>
            {paginate(rows, safePage, PAGE).map((g) => {
              const expanded = isOpen(g);
              return (
                <Fragment key={keyOf(g)}>
                  <tr className="kb-lots-food">
                    <td>
                      <Button
                        variant="link"
                        className="kb-lots-toggle"
                        icon={expanded ? ChevronDown : ChevronRight}
                        aria-expanded={expanded}
                        onClick={() => toggle(g)}
                      >
                        {g.food?.name}
                      </Button>
                    </td>
                    <td className="center nowrap">{g.lots.length} lô</td>
                    <td className="center">
                      <ExpiryCell expiryDate={g.lots[0]?.expiryDate} />
                    </td>
                    <td />
                    <td>{supplierSummary(g.lots)}</td>
                    <td />
                    <td className="num nowrap fw-600">{formatPurchaseQty(g.remaining, g.food)}</td>
                    <td />
                  </tr>
                  {expanded &&
                    g.lots.map((lot) => (
                      <tr key={lot.id} className="kb-lots-lot">
                        <td className="muted">Lô {lot.lotNo}</td>
                        <td />
                        <td className="center">
                          <ExpiryCell expiryDate={lot.expiryDate} />
                        </td>
                        <td className="center">{formatDate(lot.receivedDate)}</td>
                        <td>{lot.supplierName || <span className="muted">—</span>}</td>
                        <td className="num nowrap">{formatPurchaseQty(lot.quantity, lot.food)}</td>
                        <td className="num nowrap">{formatPurchaseQty(lot.remaining, lot.food)}</td>
                        <td className="money nowrap">
                          {lot.unitPrice == null ? '—' : `${formatMoney(lot.unitPrice)}/${lot.food?.purchaseUnit || ''}`}
                        </td>
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
        ['Số lô', 'Thực phẩm', 'Hạn sử dụng', 'Ngày nhập', 'Nhà cung cấp', 'Đã nhập', 'Còn lại', 'Đơn giá'],
        ...rows.flatMap(({ lots: list, food }) =>
          list.map((lot) => [
            lot.lotNo,
            food?.name,
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
