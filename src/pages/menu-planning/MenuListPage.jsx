import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, RotateCcw, Eye, Pencil, ClipboardList, Sparkles } from '@/components/ui/icons';
import { useMenuAccess, useMenuCatalog, useSampleMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { NormStatusChip, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { dayNormStatus } from '@/components/menu-planning/WeekDaysView';
import { compareToNorm, mealsTotals, priceOn } from '@/utils/menu-planning/menuCalculations';
import { sampleMenuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { RECORD_STATUS_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

/** Screen #77 – sample daily menus by age group (UC 6.6). */
export default function MenuListPage() {
  const navigate = useNavigate();
  const { canManage } = useMenuAccess();
  const { catalog } = useMenuCatalog();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { items, loading, error, reload } = useSampleMenus({ keyword, status });
  const rows = items.filter((m) => !ageGroupId || m.ageGroupId === ageGroupId);
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 8)));
  const filtered = keyword || status || ageGroupId;
  const reset = () => {
    setKeyword('');
    setStatus('');
    setAgeGroupId('');
    setPage(1);
  };
  const today = todayInput();

  return (
    <div className="page">
      <Breadcrumb items={sampleMenuCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Thực đơn mẫu</h1>
        {canManage && (
          <div className="row row--wrap td-actions">
            <Link to="/menu/ai-suggestion?kind=DAILY" className="btn btn--outline-primary btn--lg">
              <Sparkles size={18} /> Gợi ý bằng AI
            </Link>
            <Link to="/menu/menus/new" className="btn btn--primary btn--lg">
              <Plus size={18} /> Tạo thực đơn mẫu
            </Link>
          </div>
        )}
      </div>
      <div className="alert alert--info mb-16">
        <ClipboardList size={18} />
        <div>
          Thực đơn mẫu là thực đơn một ngày (gồm các bữa) của một nhóm tuổi. Thực đơn tuần được xếp từ các thực đơn mẫu; trẻ dị ứng dùng
          thực đơn thay thế.
        </div>
      </div>
      <div className="card">
        <div className="tabs" role="tablist">
          {[{ id: '', shortName: 'Tất cả' }, ...AGE_GROUPS].map((g) => (
            <button
              key={g.id || 'all'}
              role="tab"
              aria-selected={ageGroupId === g.id}
              className={`tab ${ageGroupId === g.id ? 'tab--active' : ''}`}
              onClick={() => {
                setAgeGroupId(g.id);
                setPage(1);
              }}
            >
              {g.shortName} <span className="tab__count">{items.filter((m) => !g.id || m.ageGroupId === g.id).length}</span>
            </button>
          ))}
        </div>
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
                  <th>Tên thực đơn</th>
                  <th>Nhóm tuổi</th>
                  <th className="right">Số món</th>
                  <th className="right">Năng lượng</th>
                  <th>Dinh dưỡng</th>
                  <th className="right">Chi phí / giá suất</th>
                  <th className="right">Thay thế</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={10} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState
                        icon={ClipboardList}
                        title={filtered ? 'Không có kết quả phù hợp' : 'Chưa có thực đơn mẫu'}
                        description={
                          filtered ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Tạo thực đơn mẫu cho từng nhóm tuổi để xếp thực đơn tuần.'
                        }
                        action={
                          filtered ? (
                            <button className="btn" onClick={reset}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          ) : (
                            canManage && (
                              <Link className="btn btn--primary" to="/menu/menus/new">
                                <Plus size={16} /> Tạo thực đơn mẫu
                              </Link>
                            )
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(rows, safePage).map((m) => {
                    const r = mealsTotals(m.meals, catalog.dishById, catalog.foodById, m.ageGroupId);
                    const price = priceOn(catalog.mealPrices, m.ageGroupId, today)?.price;
                    const alt = catalog.allergyMenus.filter((a) => a.baseMenuId === m.id).length;
                    return (
                      <tr key={m.id} className="row-click" onClick={() => navigate(`/menu/menus/${m.id}`)}>
                        <td className="fw-600 text-primary nowrap">{m.code}</td>
                        <td>{m.name}</td>
                        <td className="text-sm">{ageGroupById(m.ageGroupId)?.shortName}</td>
                        <td className="right">{m.meals.reduce((s, x) => s + x.items.length, 0)}</td>
                        <td className="right nowrap">{r.totals.kcal.toLocaleString('vi-VN')} kcal</td>
                        <td>
                          <NormStatusChip status={dayNormStatus(compareToNorm(r.totals, m.ageGroupId, r.missing.length > 0))} />
                        </td>
                        <td className={`right nowrap ${price && r.cost > price ? 'td-warn' : ''}`}>
                          {formatMoney(r.cost)} / {formatMoney(price)}
                        </td>
                        <td className="right">{alt}</td>
                        <td>
                          <RecordStatusBadge status={m.status} />
                        </td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          <Link className="icon-btn" to={`/menu/menus/${m.id}`} title="Xem" aria-label={`Xem ${m.name}`}>
                            <Eye size={17} />
                          </Link>
                          {canManage && (
                            <Link className="icon-btn" to={`/menu/menus/${m.id}/edit`} title="Sửa" aria-label={`Sửa ${m.name}`}>
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
        {!loading && rows.length > 0 && <Pagination page={safePage} total={rows.length} onChange={setPage} unit="thực đơn" />}
      </div>
    </div>
  );
}
