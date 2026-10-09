import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, RotateCcw, Eye, Pencil, Soup } from '@/components/ui/icons';
import { useDishes, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { AllergenChips, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { dishAllergens, dishTotals } from '@/utils/menu-planning/menuCalculations';
import { dishCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { ALLERGENS, DISH_TYPE_LABELS, RECORD_STATUS_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const g = (v) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** Screen #72 – dishes with their standard portion and nutrition values. */
export default function DishListPage() {
  const navigate = useNavigate();
  const { canManage } = useMenuAccess();
  const { catalog } = useMenuCatalog();
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [allergen, setAllergen] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { items, loading, error, reload } = useDishes({ keyword, type, allergen, status });
  const filtered = keyword || type || allergen || status;
  const safePage = Math.min(page, Math.max(1, Math.ceil(items.length / 8)));
  const reset = () => {
    setKeyword('');
    setType('');
    setAllergen('');
    setStatus('');
    setPage(1);
  };

  return (
    <div className="page">
      <Breadcrumb items={dishCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Danh mục món ăn</h1>
        {canManage && (
          <Link to="/menu/dishes/new" className="btn btn--primary btn--lg">
            <Plus size={18} /> Thêm món ăn
          </Link>
        )}
      </div>
      <div className="card">
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã hoặc tên món..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm kiếm"
            />
          </label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại món">
            <option value="">Tất cả loại món</option>
            {Object.entries(DISH_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="select" value={allergen} onChange={(e) => setAllergen(e.target.value)} aria-label="Chất gây dị ứng">
            <option value="">Mọi chất gây dị ứng</option>
            {ALLERGENS.map((a) => (
              <option key={a} value={a}>
                Chứa {a}
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
                  <th>Tên món</th>
                  <th>Loại</th>
                  <th className="right">Thực phẩm</th>
                  <th className="right">Năng lượng</th>
                  <th className="right">Đạm / Béo / Bột (g)</th>
                  <th className="right">Chi phí</th>
                  <th>Chứa</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={10} />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState
                        icon={Soup}
                        title={filtered ? 'Không có kết quả phù hợp' : 'Chưa có món ăn'}
                        description={
                          filtered ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Tạo món từ các thực phẩm và định lượng cho một khẩu phần.'
                        }
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
                  paginate(items, safePage).map((d) => {
                    const r = dishTotals(d, catalog.foodById);
                    return (
                      <tr key={d.id} className="row-click" onClick={() => navigate(`/menu/dishes/${d.id}`)}>
                        <td className="fw-600 text-primary">{d.code}</td>
                        <td>{d.name}</td>
                        <td className="text-sm">{DISH_TYPE_LABELS[d.type]}</td>
                        <td className="right">{d.ingredients.length}</td>
                        <td className="right nowrap">
                          {g(r.totals.kcal)} kcal
                          {r.missing.length > 0 && <div className="text-xs td-warn">Thiếu số liệu</div>}
                        </td>
                        <td className="right nowrap">
                          {g(r.totals.protein)} / {g(r.totals.lipid)} / {g(r.totals.glucid)}
                        </td>
                        <td className="right nowrap">{formatMoney(r.cost)}</td>
                        <td>
                          <AllergenChips allergens={dishAllergens(d, catalog.foodById)} />
                        </td>
                        <td>
                          <RecordStatusBadge status={d.status} />
                        </td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          <Link className="icon-btn" to={`/menu/dishes/${d.id}`} title="Xem" aria-label={`Xem ${d.name}`}>
                            <Eye size={17} />
                          </Link>
                          {canManage && (
                            <Link className="icon-btn" to={`/menu/dishes/${d.id}/edit`} title="Sửa" aria-label={`Sửa ${d.name}`}>
                              <Pencil size={17} />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && items.length > 0 && <Pagination page={safePage} total={items.length} onChange={setPage} unit="món" />}
      </div>
      <p className="text-xs muted mt-8">
        Giá trị tính cho một khẩu phần chuẩn (hệ số 1); khi xếp thực đơn, khẩu phần được nhân theo nhóm tuổi.
      </p>
    </div>
  );
}
