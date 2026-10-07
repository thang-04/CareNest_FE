import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, RotateCcw, Eye, Pencil, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useAllergyContext, useAllergyMenus, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { AllergenChips, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { allergyMenuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { sameAllergen } from '@/utils/menu-planning/menuCalculations';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { ALLERGENS, ALLERGY_GROUP_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

/** Screen #80 – alternative menus for allergy or health groups (UC 6.7). */
export default function AllergyMenuListPage() {
  const navigate = useNavigate();
  const { canManage } = useMenuAccess();
  const { catalog } = useMenuCatalog();
  const { rows: allergyRows } = useAllergyContext('');
  const [keyword, setKeyword] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [restriction, setRestriction] = useState('');
  const [page, setPage] = useState(1);
  const { items, loading, error, reload } = useAllergyMenus({ keyword, ageGroupId, restriction });
  const safePage = Math.min(page, Math.max(1, Math.ceil(items.length / 8)));
  const filtered = keyword || ageGroupId || restriction;
  const reset = () => {
    setKeyword('');
    setAgeGroupId('');
    setRestriction('');
    setPage(1);
  };

  return (
    <div className="page">
      <Breadcrumb items={allergyMenuCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Thực đơn thay thế (dị ứng, chế độ ăn)</h1>
        {canManage && (
          <Link to="/menu/allergy-menus/new" className="btn btn--primary btn--lg">
            <Plus size={18} /> Tạo thực đơn thay thế
          </Link>
        )}
      </div>
      {allergyRows.length > 0 && (
        <div className="alert alert--warning mb-16">
          <ShieldAlert size={18} />
          <div>
            Dị ứng đã ghi nhận trong trường:{' '}
            {allergyRows.map((r, i) => (
              <span key={r.allergen}>
                {i > 0 && ' · '}
                <b>{r.allergen}</b> ({r.childCount} trẻ, {r.classes.length} lớp)
              </span>
            ))}
            . Chỉ dữ liệu dị ứng đã được Hiệu trưởng xác nhận mới được dùng để lập thực đơn thay thế.
          </div>
        </div>
      )}
      <div className="card">
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã hoặc tên thực đơn..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm kiếm"
            />
          </label>
          <select className="select" value={ageGroupId} onChange={(e) => setAgeGroupId(e.target.value)} aria-label="Nhóm tuổi">
            <option value="">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select className="select" value={restriction} onChange={(e) => setRestriction(e.target.value)} aria-label="Thành phần cần tránh">
            <option value="">Mọi thành phần cần tránh</option>
            {ALLERGENS.map((a) => (
              <option key={a} value={a}>
                Không {a}
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
                  <th>Tên thực đơn thay thế</th>
                  <th>Thực đơn gốc</th>
                  <th>Nhóm tuổi</th>
                  <th>Loại</th>
                  <th>Tránh</th>
                  <th>Trẻ cần dùng</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={9} />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={ShieldCheck}
                        title={filtered ? 'Không có kết quả phù hợp' : 'Chưa có thực đơn thay thế'}
                        description={
                          filtered
                            ? 'Thử đổi từ khóa hoặc bộ lọc.'
                            : 'Tạo thực đơn thay thế từ một thực đơn mẫu cho trẻ có dị ứng hoặc chế độ ăn riêng.'
                        }
                        action={
                          filtered ? (
                            <button className="btn" onClick={reset}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          ) : (
                            canManage && (
                              <Link className="btn btn--primary" to="/menu/allergy-menus/new">
                                <Plus size={16} /> Tạo thực đơn thay thế
                              </Link>
                            )
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(items, safePage).map((a) => {
                    const base = catalog.menuById[a.baseMenuId];
                    const concerned = allergyRows
                      .filter((r) => a.restrictions.some((x) => sameAllergen(x, r.allergen)))
                      .flatMap((r) => r.classes.filter((c) => c.ageGroupId === a.ageGroupId));
                    const childCount = concerned.reduce((s, c) => s + c.count, 0);
                    return (
                      <tr key={a.id} className="row-click" onClick={() => navigate(`/menu/allergy-menus/${a.id}`)}>
                        <td className="fw-600 text-primary nowrap">{a.code}</td>
                        <td style={{ maxWidth: 280, whiteSpace: 'normal' }}>{a.name}</td>
                        <td className="text-sm">{base ? `${base.code}` : '—'}</td>
                        <td className="text-sm">{ageGroupById(a.ageGroupId)?.shortName}</td>
                        <td className="text-sm">{ALLERGY_GROUP_LABELS[a.groupType]}</td>
                        <td>
                          <AllergenChips allergens={a.restrictions} />
                        </td>
                        <td className="text-sm">{childCount ? `${childCount} lượt trẻ` : <span className="muted">Chưa có trẻ</span>}</td>
                        <td>
                          <RecordStatusBadge status={a.status} />
                        </td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          <Link className="icon-btn" to={`/menu/allergy-menus/${a.id}`} title="Xem" aria-label={`Xem ${a.code}`}>
                            <Eye size={17} />
                          </Link>
                          {canManage && (
                            <Link className="icon-btn" to={`/menu/allergy-menus/${a.id}/edit`} title="Sửa" aria-label={`Sửa ${a.code}`}>
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
        {!loading && items.length > 0 && <Pagination page={safePage} total={items.length} onChange={setPage} unit="thực đơn" />}
      </div>
      <p className="text-xs muted mt-8">
        "Lượt trẻ" đếm theo từng thành phần cần tránh; một trẻ dị ứng nhiều thành phần được đếm nhiều lượt.
      </p>
    </div>
  );
}
