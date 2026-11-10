import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Carrot, FileImport, Heart, HeartFilled, Plus, RotateCcw, Table2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFoods, useCatalogAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { useFilterParams } from '@/hooks/useFilterParams';
import { saveFoodsBulk, setFoodFavorite } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { FilterMore } from '@/components/ui/FilterMore';
import { FilterChips } from '@/components/ui/FilterChips';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { RowActions } from '@/components/ui/RowActions';
import { clickableRowProps } from '@/utils/clickableRow';
import { AllergenChips, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { CategoryNav } from '@/components/ui/CategoryNav';
import { FoodImportPanel } from '@/components/menu-planning/FoodImportPanel';
import { FoodEditModal } from '@/components/menu-planning/FoodEditModal';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { hasNutrition, hasOrigin } from '@/utils/menu-planning/menuCalculations';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import {
  ALLERGENS,
  FOOD_GROUP_LABELS,
  FOOD_ORIGIN_LABELS,
  RECORD_STATUS,
  RECORD_STATUS_LABELS,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const PAGE = 8;
const n = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN') : '—');
const needsData = (f) => !hasNutrition(f) || !hasOrigin(f) || !f.unitPrice;
const QUICK = {
  '': () => true,
  MISSING: needsData,
  ALLERGEN: (f) => f.allergens.length > 0,
};
const QUICK_LABELS = { MISSING: 'Thiếu đơn giá, dinh dưỡng hoặc nguồn gốc', ALLERGEN: 'Có chất gây dị ứng' };
const FILTER_DEFAULTS = { group: '', keyword: '', favorite: '', quick: '', allergen: '', status: '', origin: '' };
// Ô sửa được ở chế độ sửa hàng loạt: [khóa, đọc giá trị hiện tại]
const BULK_FIELDS = [
  ['unitPrice', (f) => f.unitPrice],
  ['wastePct', (f) => f.wastePct ?? 0],
  ['kcal', (f) => f.nutrition.kcal],
  ['protein', (f) => f.nutrition.protein],
  ['lipid', (f) => f.nutrition.lipid],
  ['glucid', (f) => f.nutrition.glucid],
];
const NUTRIENT_KEYS = ['kcal', 'protein', 'lipid', 'glucid'];
const toNum = (v) => (v === '' ? null : Number(v));

/** Bước 2 luồng dinh dưỡng – danh mục thực phẩm: nhóm bên trái, bảng bên phải; sửa hàng loạt và nhập khẩu từ file. */
export default function FoodListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { canManage, personalFavorite } = useCatalogAccess();
  // Bộ lọc lưu trên URL: mở thực phẩm rồi Back vẫn giữ nhóm, từ khóa và bộ lọc phụ
  const [filters, setFilters, resetFilters, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { keyword, group, quick, allergen, status, origin } = filters;
  const favoriteOnly = filters.favorite === '1';
  const [page, setPage] = useState(1);
  const [bulk, setBulk] = useState(false);
  // Cột Thao tác chỉ có sửa; người chỉ xem không có thao tác nào nên bỏ cả cột
  const showActions = canManage && !bulk;
  const canFavorite = (canManage || personalFavorite) && !bulk;
  const colCount = bulk ? 11 : showActions ? 9 : 8;
  const [drafts, setDrafts] = useState({});
  const [bulkErrors, setBulkErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // null = đóng; '' = thêm mới; id = sửa thực phẩm đó trong modal
  const [editing, setEditing] = useState(null);
  const options = (labels, all) => [{ value: '', label: all }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))];
  // Lọc nhóm ở client để danh mục bên trái đếm theo các bộ lọc còn lại
  const { items, loading, error, reload } = useFoods({ keyword, allergen, status });
  const rows = items.filter(
    (f) => (!group || f.group === group) && (!origin || f.origin === origin) && (!favoriteOnly || f.favorite) && QUICK[quick](f),
  );
  const filtered = activeKeys.length > 0;
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE)));
  const changedCount = Object.values(drafts).reduce((sum, d) => sum + Object.keys(d).length, 0);
  const change = (key) => (v) => {
    setFilters({ [key]: v });
    setPage(1);
  };
  const reset = () => {
    resetFilters();
    setPage(1);
  };
  const chipLabels = {
    keyword: `Từ khóa: ${keyword}`,
    group: `Nhóm: ${FOOD_GROUP_LABELS[group] || group}`,
    favorite: 'Chỉ hay dùng',
    quick: QUICK_LABELS[quick] || quick,
    allergen: `Dị ứng: ${allergen}`,
    status: `Trạng thái: ${RECORD_STATUS_LABELS[status] || status}`,
    origin: `Nguồn gốc: ${FOOD_ORIGIN_LABELS[origin] || origin}`,
  };
  const chips = activeKeys.map((k) => ({ key: k, label: chipLabels[k], onRemove: () => change(k)('') }));
  const toggleFavorite = async (f) => {
    try {
      await setFoodFavorite(f.id, !f.favorite, user);
    } catch (err) {
      toast.error(err, 'Không cập nhật được');
    }
  };
  const setDraft = (f, key, read, value) =>
    setDrafts((all) => {
      const d = { ...(all[f.id] || {}) };
      // Trả về đúng giá trị cũ thì không còn là thay đổi
      if (String(read(f) ?? '') === value) delete d[key];
      else d[key] = value;
      const next = { ...all, [f.id]: d };
      if (!Object.keys(d).length) delete next[f.id];
      return next;
    });
  const stopBulk = () => {
    setBulk(false);
    setDrafts({});
    setBulkErrors({});
  };
  const saveBulk = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(drafts).map(([id, d]) => {
        const data = {};
        const nutrition = {};
        Object.entries(d).forEach(([k, v]) => (NUTRIENT_KEYS.includes(k) ? (nutrition[k] = toNum(v)) : (data[k] = toNum(v))));
        if (Object.keys(nutrition).length) data.nutrition = nutrition;
        return { key: id, id, data };
      });
      const { updated } = await saveFoodsBulk(payload, user);
      toast.success(`Đã lưu ${updated} thực phẩm.`);
      stopBulk();
    } catch (err) {
      if (err.details) setBulkErrors(err.details);
      toast.error(err, 'Chưa lưu được');
    } finally {
      setSaving(false);
    }
  };
  const navItems = [
    { key: '', label: 'Tất cả', count: items.length },
    ...Object.entries(FOOD_GROUP_LABELS).map(([k, label]) => ({ key: k, label, count: items.filter((f) => f.group === k).length })),
  ];

  const cell = (f, key, read) => {
    const value = drafts[f.id]?.[key] ?? String(read(f) ?? '');
    const err = bulkErrors[`${f.id}.${key}`];
    return (
      <input
        className={`input td-bulk-cell ${drafts[f.id]?.[key] !== undefined ? 'td-bulk-cell--changed' : ''} ${err ? 'is-invalid' : ''}`}
        value={value}
        inputMode="decimal"
        title={err || undefined}
        aria-label={`${key} ${f.name}`}
        onChange={(e) => setDraft(f, key, read, e.target.value)}
      />
    );
  };

  return (
    <div className="page">
      <Breadcrumb items={foodCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Thực phẩm</h1>
        </div>
        {canManage && (
          <div className="page__actions">
            <button type="button" className="btn" onClick={() => setImportOpen(true)} disabled={bulk}>
              <FileImport size={16} /> Nhập từ Excel
            </button>
            <button type="button" className="btn" onClick={() => setBulk(true)} disabled={bulk}>
              <Table2 size={16} /> Chỉnh sửa hàng loạt
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setEditing('')} disabled={bulk}>
              <Plus size={16} /> Thêm thực phẩm
            </button>
          </div>
        )}
      </div>
      {bulk && (
        <div className="alert alert--info td-bulk-bar">
          <Table2 size={18} />
          <div className="td-grow">Đang sửa hàng loạt: sửa trực tiếp trong ô, bấm Lưu để ghi tất cả.</div>
          <button type="button" className="btn btn--sm" onClick={stopBulk} disabled={saving}>
            Hủy
          </button>
          <button type="button" className="btn btn--sm btn--primary" onClick={saveBulk} disabled={!changedCount || saving}>
            {saving && <Spinner small />} Lưu {changedCount} thay đổi
          </button>
        </div>
      )}
      <section className="card td-split-nav">
        <CategoryNav title="Nhóm thực phẩm" items={navItems} value={group} onChange={change('group')} />
        <div className="td-split-nav__main">
          <div className="filter-bar filter-bar--aligned">
            <SearchSubmit
              className="td-grow"
              value={keyword}
              placeholder="Tìm tên hoặc mã thực phẩm"
              label="Tìm thực phẩm"
              onSearch={change('keyword')}
            />
            {/* Nút bật / tắt cùng chiều cao với ô tìm và các nút lọc, thay cho ô tích chữ lệch hàng */}
            <button
              type="button"
              className="btn btn--toggle"
              aria-pressed={favoriteOnly}
              onClick={() => change('favorite')(favoriteOnly ? '' : '1')}
            >
              {favoriteOnly ? <HeartFilled size={16} /> : <Heart size={16} />} Chỉ hay dùng
            </button>
            <FilterMore count={[quick, allergen, status, origin].filter(Boolean).length}>
              <div className="field">
                <span className="field__label">Nguồn gốc</span>
                <SearchSelect
                  options={options(FOOD_ORIGIN_LABELS, 'Động vật và thực vật')}
                  value={origin}
                  onChange={change('origin')}
                  ariaLabel="Nguồn gốc"
                />
              </div>
              <div className="field">
                <span className="field__label">Số liệu</span>
                <SearchSelect options={options(QUICK_LABELS, 'Mọi số liệu')} value={quick} onChange={change('quick')} ariaLabel="Số liệu" />
              </div>
              <div className="field">
                <span className="field__label">Chất gây dị ứng</span>
                <SearchSelect
                  options={options(Object.fromEntries(ALLERGENS.map((a) => [a, a])), 'Mọi chất gây dị ứng')}
                  value={allergen}
                  onChange={change('allergen')}
                  ariaLabel="Chất gây dị ứng"
                />
              </div>
              <div className="field">
                <span className="field__label">Trạng thái</span>
                <SearchSelect
                  options={options(RECORD_STATUS_LABELS, 'Tất cả trạng thái')}
                  value={status}
                  onChange={change('status')}
                  ariaLabel="Trạng thái"
                />
              </div>
            </FilterMore>
            <button type="button" className="btn btn--ghost" onClick={reset} disabled={!filtered}>
              <RotateCcw size={15} /> Đặt lại bộ lọc
            </button>
          </div>
          <FilterChips count={loading ? null : rows.length} unit="thực phẩm" chips={chips} />
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap">
              <table className="table table--grid table--wrap-head td-food-table">
                <thead>
                  <tr>
                    <th className="center">Mã</th>
                    <th>Tên thực phẩm</th>
                    <th className="center">Đơn vị mua</th>
                    <th className="money">Đơn giá</th>
                    <th className="num">Thải bỏ (%)</th>
                    <th className="num">{bulk ? 'Kcal' : 'Năng lượng / 100 g'}</th>
                    {/* Đạm, béo, tinh bột chỉ hiện khi sửa hàng loạt; xem đủ trong modal sửa */}
                    {bulk && (
                      <>
                        <th className="num">Đạm (g)</th>
                        <th className="num">Béo (g)</th>
                        <th className="num">Tinh bột (g)</th>
                      </>
                    )}
                    <th>Dị ứng</th>
                    <th className="center" title={personalFavorite ? 'Đánh dấu riêng của bạn, lưu trên trình duyệt này' : undefined}>
                      Hay dùng
                    </th>
                    {showActions && <th className="cell--actions">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows rows={5} cols={colCount} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={colCount}>
                        <EmptyState
                          icon={Carrot}
                          title={filtered ? 'Không có kết quả phù hợp' : 'Chưa có thực phẩm'}
                          description={
                            filtered ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Nhập từ bảng thành phần thực phẩm hoặc thêm từng thực phẩm.'
                          }
                          action={
                            filtered ? (
                              <button className="btn" onClick={reset}>
                                <RotateCcw size={15} /> Đặt lại bộ lọc
                              </button>
                            ) : (
                              canManage && (
                                <button type="button" className="btn btn--primary" onClick={() => setEditing('')}>
                                  <Plus size={16} /> Thêm thực phẩm
                                </button>
                              )
                            )
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    paginate(rows, safePage, PAGE).map((f) => (
                      <tr
                        key={f.id}
                        className={`${bulk ? '' : 'row-click'} ${needsData(f) ? 'td-row--warn' : ''}`}
                        {...(bulk ? {} : clickableRowProps(() => navigate(`/menu/foods/${f.id}`)))}
                      >
                        <td className="muted nowrap center">{f.code}</td>
                        <td>
                          <div className="fw-600">{f.name}</div>
                          {f.status === RECORD_STATUS.INACTIVE && <RecordStatusBadge status={f.status} />}
                        </td>
                        <td className="center">{f.purchaseUnit || '—'}</td>
                        <td className="money nowrap">
                          {bulk ? (
                            cell(f, ...BULK_FIELDS[0])
                          ) : f.unitPrice ? (
                            `${n(f.unitPrice)} đ`
                          ) : (
                            <span className="td-warn">Chưa có giá</span>
                          )}
                        </td>
                        <td className="num">{bulk ? cell(f, ...BULK_FIELDS[1]) : n(f.wastePct ?? 0)}</td>
                        {(bulk ? BULK_FIELDS.slice(2) : BULK_FIELDS.slice(2, 3)).map(([key, read]) => (
                          <td key={key} className="num nowrap">
                            {bulk ? (
                              cell(f, key, read)
                            ) : read(f) == null || !hasOrigin(f) ? (
                              <span className="td-warn">Chưa đủ dữ liệu</span>
                            ) : (
                              `${n(read(f))} kcal`
                            )}
                          </td>
                        ))}
                        <td>
                          <AllergenChips allergens={f.allergens} />
                        </td>
                        <td className="center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`icon-btn ${f.favorite ? 'td-fav--on' : ''}`}
                            aria-pressed={!!f.favorite}
                            aria-label={`${f.favorite ? 'Bỏ' : 'Đánh dấu'} hay dùng: ${f.name}`}
                            disabled={!canFavorite}
                            onClick={() => toggleFavorite(f)}
                          >
                            {f.favorite ? <HeartFilled size={17} /> : <Heart size={17} />}
                          </button>
                        </td>
                        {showActions && (
                          <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                            <RowActions edit={{ onClick: () => setEditing(f.id) }} name={f.name} />
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <Pagination page={safePage} total={rows.length} onChange={setPage} pageSize={PAGE} unit="thực phẩm" />
          )}
        </div>
      </section>
      <FoodImportPanel open={importOpen} onClose={() => setImportOpen(false)} />
      {editing !== null && <FoodEditModal foodId={editing} onClose={() => setEditing(null)} onSaved={() => reload({ silent: true })} />}
    </div>
  );
}
