import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, RotateCcw, Eye, Pencil, Carrot } from 'lucide-react';
import { useFoods, useMenuAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { AllergenChips, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { hasNutrition } from '@/utils/menu-planning/menuCalculations';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { ALLERGENS, FOOD_GROUP_LABELS, RECORD_STATUS_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const n = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN') : '—');

/** Screen #69 – food items with nutrition values and allergens. */
export default function FoodListPage() {
  const navigate = useNavigate();
  const { canManage } = useMenuAccess();
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [allergen, setAllergen] = useState('');
  const [status, setStatus] = useState('');
  const [quick, setQuick] = useState('ALL');
  const [page, setPage] = useState(1);
  const { items, loading, error, reload } = useFoods({ keyword, group, allergen, status });
  const { items: all } = useFoods({});

  const quickMatch = {
    ALL: () => true,
    ALLERGEN: (f) => f.allergens.length > 0,
    MISSING: (f) => !hasNutrition(f),
    INACTIVE: (f) => f.status === 'INACTIVE',
  };
  const rows = items.filter(quickMatch[quick]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 8)));
  const stats = [
    { key: 'ALL', label: 'Tổng số thực phẩm', tone: 'blue' },
    { key: 'ALLERGEN', label: 'Có chất gây dị ứng', tone: 'red' },
    { key: 'MISSING', label: 'Thiếu số liệu dinh dưỡng', tone: 'orange' },
    { key: 'INACTIVE', label: 'Ngừng sử dụng', tone: 'purple' },
  ];
  const filtered = keyword || group || allergen || status || quick !== 'ALL';
  const reset = () => {
    setKeyword('');
    setGroup('');
    setAllergen('');
    setStatus('');
    setQuick('ALL');
    setPage(1);
  };

  return (
    <div className="page">
      <Breadcrumb items={foodCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Danh mục thực phẩm</h1>
        {canManage && (
          <Link to="/menu/foods/new" className="btn btn--primary btn--lg">
            <Plus size={18} /> Thêm thực phẩm
          </Link>
        )}
      </div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((s) => (
          <button
            key={s.key}
            className={`stat-card stat-card--${s.tone} ${quick === s.key ? 'stat-card--active' : ''}`}
            onClick={() => {
              setQuick(s.key);
              setPage(1);
            }}
          >
            <div className="stat-card__value">{all.filter(quickMatch[s.key]).length}</div>
            <div className="stat-card__label">{s.label}</div>
          </button>
        ))}
      </div>
      <div className="card">
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã hoặc tên thực phẩm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm kiếm"
            />
          </label>
          <select className="select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Nhóm thực phẩm">
            <option value="">Tất cả nhóm</option>
            {Object.entries(FOOD_GROUP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="select" value={allergen} onChange={(e) => setAllergen(e.target.value)} aria-label="Chất gây dị ứng">
            <option value="">Mọi chất gây dị ứng</option>
            {ALLERGENS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Trạng thái">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(RECORD_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn" onClick={reset} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên thực phẩm</th>
                  <th>Nhóm</th>
                  <th>Đơn vị mua</th>
                  <th className="right">Năng lượng</th>
                  <th className="right">Đạm</th>
                  <th className="right">Béo</th>
                  <th className="right">Bột</th>
                  <th>Chất gây dị ứng</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={11} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={11}>
                      <EmptyState
                        icon={Carrot}
                        title={filtered ? 'Không có kết quả phù hợp' : 'Chưa có thực phẩm'}
                        description={filtered ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Thêm thực phẩm cùng giá trị dinh dưỡng để lập món ăn.'}
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
                  paginate(rows, safePage).map((f) => (
                    <tr key={f.id} className="row-click" onClick={() => navigate(`/menu/foods/${f.id}`)}>
                      <td className="fw-600 text-primary">{f.code}</td>
                      <td>{f.name}</td>
                      <td className="text-sm">{FOOD_GROUP_LABELS[f.group]}</td>
                      <td className="text-sm nowrap">
                        {f.purchaseUnit}
                        <div className="muted text-xs">{formatMoney(f.unitPrice)}</div>
                      </td>
                      <td className="right nowrap">
                        {hasNutrition(f) ? `${n(f.nutrition.kcal)} kcal` : <span className="chip chip--orange">Thiếu số liệu</span>}
                      </td>
                      <td className="right">{n(f.nutrition.protein)}</td>
                      <td className="right">{n(f.nutrition.lipid)}</td>
                      <td className="right">{n(f.nutrition.glucid)}</td>
                      <td>
                        <AllergenChips allergens={f.allergens} />
                      </td>
                      <td>
                        <RecordStatusBadge status={f.status} />
                      </td>
                      <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                        <Link className="icon-btn" to={`/menu/foods/${f.id}`} title="Xem" aria-label={`Xem ${f.name}`}>
                          <Eye size={17} />
                        </Link>
                        {canManage && (
                          <Link className="icon-btn" to={`/menu/foods/${f.id}/edit`} title="Sửa" aria-label={`Sửa ${f.name}`}>
                            <Pencil size={17} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <Pagination page={safePage} total={rows.length} onChange={setPage} unit="thực phẩm" />}
      </div>
      <p className="text-xs muted mt-8">Giá trị dinh dưỡng tính trên 100 g (hoặc 100 ml) thực phẩm; đạm, béo, bột tính bằng gam.</p>
    </div>
  );
}
