import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, CircleCheck, Copy, Eye, Pencil, Plus, RotateCcw, Soup } from '@/components/ui/icons';
import { useDishes, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { useFilterParams } from '@/hooks/useFilterParams';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { FilterMore } from '@/components/ui/FilterMore';
import { FilterChips } from '@/components/ui/FilterChips';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { RowMenu } from '@/components/ui/RowMenu';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AllergenChips, DishStatusBadge } from '@/components/menu-planning/MenuBadges';
import { CategoryNav } from '@/components/menu-planning/CategoryNav';
import { ReferenceLibraryPanel } from '@/components/menu-planning/ReferenceLibraryPanel';
import { dishAllergens, missingPortionGroups } from '@/utils/menu-planning/menuCalculations';
import { activeAgeGroups, ageAbbr } from '@/utils/menu-planning/nutritionSetup';
import { dishCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { ALLERGENS, DISH_STATUS, DISH_STATUS_LABELS, DISH_TYPE_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const PAGE = 8;
const FILTER_DEFAULTS = { type: '', keyword: '', portion: '', allergen: '', status: '' };

/** Bước 2 luồng dinh dưỡng – danh mục món ăn: loại món bên trái, bảng bên phải; bấm món để mở trang sửa. */
export default function DishListPage() {
  const navigate = useNavigate();
  const { canManage } = useMenuAccess();
  const { catalog } = useMenuCatalog();
  // Bộ lọc lưu trên URL: mở món rồi Back vẫn giữ loại món, từ khóa và bộ lọc phụ
  const [filters, setFilters, resetFilters, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { keyword, type, portion, allergen, status } = filters;
  const [page, setPage] = useState(1);
  const [library, setLibrary] = useState(false);
  // Lọc loại món ở client để danh mục bên trái đếm đúng theo các bộ lọc còn lại
  const { items, loading, error, reload } = useDishes({ keyword, allergen, status });
  const groups = activeAgeGroups(catalog.nutritionSetups);
  const groupIds = groups.map((g) => g.id);
  const missingOf = (d) => missingPortionGroups(d, groupIds);
  const rows = items.filter((d) => (!type || d.type === type) && (!portion || missingOf(d).length > 0));
  const filtered = activeKeys.length > 0;
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE)));
  const open = (d) => navigate(canManage ? `/menu/dishes/${d.id}/edit` : `/menu/dishes/${d.id}`);
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
    type: `Loại món: ${DISH_TYPE_LABELS[type] || type}`,
    portion: 'Thiếu định lượng',
    allergen: `Chứa ${allergen}`,
    status: `Trạng thái: ${DISH_STATUS_LABELS[status] || status}`,
  };
  const chips = activeKeys.map((k) => ({ key: k, label: chipLabels[k], onRemove: () => change(k)('') }));
  const navItems = [
    { key: '', label: 'Tất cả', count: items.length },
    ...Object.entries(DISH_TYPE_LABELS).map(([k, label]) => ({ key: k, label, count: items.filter((d) => d.type === k).length })),
  ];

  return (
    <div className="page">
      <Breadcrumb items={dishCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Món ăn</h1>
          <p className="page__desc">Công thức món theo nhóm tuổi. Dinh dưỡng và chi phí do hệ thống tính từ định lượng.</p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn" onClick={() => setLibrary(true)}>
            <BookOpen size={16} /> Thư viện tham khảo
          </button>
          {canManage && (
            <Link to="/menu/dishes/new" className="btn btn--primary">
              <Plus size={16} /> Thêm món ăn
            </Link>
          )}
        </div>
      </div>
      <section className="card td-split-nav">
        <CategoryNav title="Loại món ăn" items={navItems} value={type} onChange={change('type')} />
        <div className="td-split-nav__main">
          <div className="filter-bar">
            <SearchSubmit className="td-grow" value={keyword} placeholder="Tìm tên món ăn" label="Tìm món" onSearch={change('keyword')} />
            <select className="select" value={portion} onChange={(e) => change('portion')(e.target.value)} aria-label="Định lượng">
              <option value="">Tất cả định lượng</option>
              <option value="MISSING">Thiếu định lượng</option>
            </select>
            <FilterMore count={[allergen, status].filter(Boolean).length}>
              <label className="field">
                <span className="field__label">Chất gây dị ứng</span>
                <select className="select" value={allergen} onChange={(e) => change('allergen')(e.target.value)}>
                  <option value="">Mọi chất gây dị ứng</option>
                  {ALLERGENS.map((a) => (
                    <option key={a} value={a}>
                      Chứa {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Trạng thái</span>
                <select className="select" value={status} onChange={(e) => change('status')(e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(DISH_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </FilterMore>
            <button type="button" className="btn" onClick={reset} disabled={!filtered}>
              <RotateCcw size={15} /> Đặt lại bộ lọc
            </button>
          </div>
          <FilterChips count={loading ? null : rows.length} unit="món" chips={chips} />
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap">
              <table className="table table--grid td-dish-table">
                <thead>
                  <tr>
                    <th className="td-num-col center">#</th>
                    <th>Tên món ăn</th>
                    <th>Loại món</th>
                    <th>Nhóm tuổi áp dụng</th>
                    <th>Định lượng</th>
                    <th className="td-num-col cell--actions" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows rows={5} cols={6} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          icon={Soup}
                          title={filtered ? 'Không có kết quả phù hợp' : 'Chưa có món ăn nào'}
                          description={filtered ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Thêm món hoặc chọn từ thư viện tham khảo.'}
                          action={
                            filtered ? (
                              <button className="btn" onClick={reset}>
                                <RotateCcw size={15} /> Đặt lại bộ lọc
                              </button>
                            ) : (
                              canManage && (
                                <Link className="btn btn--primary" to="/menu/dishes/new">
                                  <Plus size={16} /> Thêm món ăn
                                </Link>
                              )
                            )
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    paginate(rows, safePage, PAGE).map((d, i) => {
                      const missing = missingOf(d);
                      return (
                        <tr key={d.id} className="row-click" onClick={() => open(d)}>
                          <td className="muted td-num-col center">{(safePage - 1) * PAGE + i + 1}</td>
                          <td>
                            <span className="fw-600">{d.name}</span>{' '}
                            <AllergenChips allergens={dishAllergens(d, catalog.foodById)} empty="" />
                            {d.status !== DISH_STATUS.ACTIVE && <DishStatusBadge status={d.status} />}
                          </td>
                          <td className="text-sm">{DISH_TYPE_LABELS[d.type]}</td>
                          <td className="text-sm">
                            {groupIds
                              .filter((id) => !missing.includes(id))
                              .map(ageAbbr)
                              .join(' · ') || '—'}
                          </td>
                          <td>
                            {missing.length ? (
                              <StatusBadge tone="orange" icon={AlertCircle} label={`Thiếu ${missing.map(ageAbbr).join(', ')}`} />
                            ) : (
                              <StatusBadge tone="green" icon={CircleCheck} label="Đủ" />
                            )}
                          </td>
                          <td className="td-num-col cell--actions">
                            <RowMenu
                              label={`Thao tác ${d.name}`}
                              items={[
                                { label: 'Xem chi tiết', to: `/menu/dishes/${d.id}`, icon: Eye },
                                ...(canManage
                                  ? [
                                      { label: 'Sửa', to: `/menu/dishes/${d.id}/edit`, icon: Pencil },
                                      { label: 'Nhân bản', to: `/menu/dishes/new?from=${d.id}`, icon: Copy },
                                    ]
                                  : []),
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loading && rows.length > 0 && <Pagination page={safePage} total={rows.length} onChange={setPage} pageSize={PAGE} unit="món" />}
        </div>
      </section>
      <ReferenceLibraryPanel open={library} onClose={() => setLibrary(false)} groups={groups} canCopy={canManage} />
    </div>
  );
}
