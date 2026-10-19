import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Carrot, Eye, FileImport, Heart, HeartFilled, Pencil, Plus, RotateCcw, Search, Table2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFoods, useMenuAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { saveFoodsBulk, setFoodFavorite } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { FilterMore } from '@/components/ui/FilterMore';
import { RowMenu } from '@/components/ui/RowMenu';
import { AllergenChips } from '@/components/menu-planning/MenuBadges';
import { CategoryNav } from '@/components/menu-planning/CategoryNav';
import { FoodImportPanel } from '@/components/menu-planning/FoodImportPanel';
import { hasNutrition } from '@/utils/menu-planning/menuCalculations';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import {
  ALLERGENS,
  FOOD_GROUP_LABELS,
  FOOD_STORAGE_LABELS,
  RECORD_STATUS,
  RECORD_STATUS_LABELS,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const PAGE = 8;
const n = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN') : '—');
const needsData = (f) => !hasNutrition(f) || !f.unitPrice;
const QUICK = {
  '': () => true,
  MISSING: needsData,
  ALLERGEN: (f) => f.allergens.length > 0,
};
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
  const { canManage } = useMenuAccess();
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [quick, setQuick] = useState('');
  const [allergen, setAllergen] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [bulk, setBulk] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [bulkErrors, setBulkErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Lọc nhóm ở client để danh mục bên trái đếm theo các bộ lọc còn lại
  const { items, loading, error, reload } = useFoods({ keyword, allergen, status });
  const { items: allFoods } = useFoods({});
  const rows = items.filter((f) => (!group || f.group === group) && (!favoriteOnly || f.favorite) && QUICK[quick](f));
  const filtered = keyword || group || favoriteOnly || quick || allergen || status;
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE)));
  const changedCount = Object.values(drafts).reduce((sum, d) => sum + Object.keys(d).length, 0);
  const change = (setter) => (v) => {
    setter(v);
    setPage(1);
  };
  const reset = () => {
    setKeyword('');
    setGroup('');
    setFavoriteOnly(false);
    setQuick('');
    setAllergen('');
    setStatus('');
    setPage(1);
  };
  const toggleFavorite = async (f) => {
    try {
      await setFoodFavorite(f.id, !f.favorite, user);
    } catch (err) {
      toast.error(err.message, 'Không cập nhật được');
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
      toast.error(err.message, 'Chưa lưu được');
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
          <p className="page__desc">Giá trị dinh dưỡng trên 100 g phần ăn được theo bảng có nguồn. AI không tạo hay sửa số liệu này.</p>
        </div>
        {canManage && (
          <div className="page__actions">
            <button type="button" className="btn" onClick={() => setImportOpen(true)} disabled={bulk}>
              <FileImport size={16} /> Nhập khẩu cập nhật
            </button>
            <button type="button" className="btn" onClick={() => setBulk(true)} disabled={bulk}>
              <Table2 size={16} /> Chỉnh sửa hàng loạt
            </button>
            <Link to="/menu/foods/new" className="btn btn--primary">
              <Plus size={16} /> Thêm thực phẩm
            </Link>
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
        <CategoryNav title="Nhóm thực phẩm" items={navItems} value={group} onChange={change(setGroup)} />
        <div className="td-split-nav__main">
          <div className="filter-bar">
            <label className="search-box td-grow">
              <Search size={17} className="muted" />
              <input
                placeholder="Tìm tên hoặc mã thực phẩm…"
                value={keyword}
                onChange={(e) => change(setKeyword)(e.target.value)}
                aria-label="Tìm thực phẩm"
              />
            </label>
            <label className="checkbox text-sm">
              <input type="checkbox" checked={favoriteOnly} onChange={(e) => change(setFavoriteOnly)(e.target.checked)} /> Chỉ hay dùng
            </label>
            <FilterMore count={[quick, allergen, status].filter(Boolean).length}>
              <label className="field">
                <span className="field__label">Số liệu</span>
                <select className="select" value={quick} onChange={(e) => change(setQuick)(e.target.value)}>
                  <option value="">Mọi số liệu</option>
                  <option value="MISSING">Thiếu đơn giá hoặc dinh dưỡng</option>
                  <option value="ALLERGEN">Có chất gây dị ứng</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Chất gây dị ứng</span>
                <select className="select" value={allergen} onChange={(e) => change(setAllergen)(e.target.value)}>
                  <option value="">Mọi chất gây dị ứng</option>
                  {ALLERGENS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Trạng thái</span>
                <select className="select" value={status} onChange={(e) => change(setStatus)(e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(RECORD_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn--sm" onClick={reset} disabled={!filtered}>
                <RotateCcw size={14} /> Đặt lại bộ lọc
              </button>
            </FilterMore>
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap">
              <table className="table table--grid td-food-table">
                <thead>
                  <tr>
                    <th>Mã TP</th>
                    <th>Tên thực phẩm</th>
                    <th className="right">Đơn giá</th>
                    <th>Đơn vị</th>
                    <th className="right">Thải bỏ %</th>
                    <th className="right">Kcal</th>
                    <th className="right">Đạm</th>
                    <th className="right">Béo</th>
                    <th className="right">Bột</th>
                    <th>Dị ứng</th>
                    <th className="center">Hay dùng</th>
                    <th className="td-num-col" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows rows={5} cols={12} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={12}>
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
                                <Link className="btn btn--primary" to="/menu/foods/new">
                                  <Plus size={16} /> Thêm thực phẩm
                                </Link>
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
                        onClick={bulk ? undefined : () => navigate(`/menu/foods/${f.id}`)}
                      >
                        <td className="fw-600 text-primary">{f.code}</td>
                        <td>
                          <div className="fw-600">{f.name}</div>
                          <div className="text-xs muted">
                            {FOOD_GROUP_LABELS[f.group]} · {FOOD_STORAGE_LABELS[f.storage]?.toLowerCase() || '—'}
                            {f.status === RECORD_STATUS.INACTIVE && ' · ngừng sử dụng'}
                          </div>
                        </td>
                        <td className="right nowrap">
                          {bulk ? (
                            cell(f, ...BULK_FIELDS[0])
                          ) : f.unitPrice ? (
                            n(f.unitPrice)
                          ) : (
                            <span className="chip chip--orange">Chưa có</span>
                          )}
                        </td>
                        <td>{f.unitPrice || bulk ? f.purchaseUnit : '—'}</td>
                        <td className="right">{bulk ? cell(f, ...BULK_FIELDS[1]) : n(f.wastePct ?? 0)}</td>
                        {BULK_FIELDS.slice(2).map(([key, read]) => (
                          <td key={key} className="right nowrap">
                            {bulk ? cell(f, key, read) : read(f) == null ? <span className="td-warn">—</span> : n(read(f))}
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
                            disabled={!canManage || bulk}
                            onClick={() => toggleFavorite(f)}
                          >
                            {f.favorite ? <HeartFilled size={17} /> : <Heart size={17} />}
                          </button>
                        </td>
                        <td className="td-num-col">
                          {!bulk && (
                            <RowMenu
                              label={`Thao tác ${f.name}`}
                              items={[
                                { label: 'Xem chi tiết', to: `/menu/foods/${f.id}`, icon: Eye },
                                ...(canManage ? [{ label: 'Sửa', to: `/menu/foods/${f.id}/edit`, icon: Pencil }] : []),
                              ]}
                            />
                          )}
                        </td>
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
      <FoodImportPanel open={importOpen} onClose={() => setImportOpen(false)} foods={allFoods} />
    </div>
  );
}
