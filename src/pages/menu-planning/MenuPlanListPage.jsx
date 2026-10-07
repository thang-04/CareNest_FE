import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, RotateCcw, CalendarRange, RefreshCw } from 'lucide-react';
import { useMenuCatalog, useMenuPlans } from '@/hooks/menu-planning/useMenuPlanning';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { priceOn } from '@/utils/menu-planning/menuCalculations';
import { planCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDateTime, todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { formatMoney, mondayOf, weekLabel } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

/** Screen #88 – the Principal lists the published weekly menus (view only, UC 6.1). */
export default function MenuPlanListPage() {
  const navigate = useNavigate();
  const { catalog } = useMenuCatalog();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [month, setMonth] = useState(todayInput().slice(0, 7));
  const [page, setPage] = useState(1);
  const { items, loading, error, reload } = useMenuPlans({ ageGroupId, month });
  const safePage = Math.min(page, Math.max(1, Math.ceil(items.length / 8)));
  const thisWeek = mondayOf(todayInput());
  const filtered = ageGroupId || month;

  return (
    <div className="page">
      <Breadcrumb items={planCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Kế hoạch thực đơn</h1>
        <button className="btn" onClick={() => reload()}>
          <RefreshCw size={16} /> Tải lại
        </button>
      </div>
      <div className="card">
        <div className="filter-bar">
          <label className="row" style={{ gap: 8 }}>
            <span className="text-sm text-2">Tháng</span>
            <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Tháng" />
          </label>
          <select className="select" value={ageGroupId} onChange={(e) => setAgeGroupId(e.target.value)} aria-label="Nhóm tuổi">
            <option value="">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!filtered}
            onClick={() => {
              setAgeGroupId('');
              setMonth('');
              setPage(1);
            }}
          >
            <RotateCcw size={15} /> Xem tất cả
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
                  <th>Tuần</th>
                  <th>Nhóm tuổi</th>
                  <th className="right">Phiên bản</th>
                  <th className="right">Giá suất ăn</th>
                  <th>Xuất bản lúc</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={7} />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={CalendarRange}
                        title="Kỳ đã chọn chưa có thực đơn đã xuất bản"
                        description="Thực đơn tuần chỉ hiển thị ở đây sau khi Phó hiệu trưởng phụ trách dịch vụ chung xuất bản."
                        action={
                          filtered && (
                            <button
                              className="btn"
                              onClick={() => {
                                setAgeGroupId('');
                                setMonth('');
                              }}
                            >
                              <RotateCcw size={15} /> Xem tất cả kỳ
                            </button>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(items, safePage).map((w) => (
                    <tr key={w.id} className="row-click" onClick={() => navigate(`/menu/plans/${w.id}`)}>
                      <td className="fw-600 text-primary nowrap">{w.code}</td>
                      <td className="nowrap">
                        {weekLabel(w.weekStart)}
                        {w.weekStart === thisWeek && (
                          <span className="chip chip--teal" style={{ marginLeft: 8 }}>
                            Tuần này
                          </span>
                        )}
                      </td>
                      <td>{ageGroupById(w.ageGroupId)?.name}</td>
                      <td className="right">{w.version}</td>
                      <td className="right nowrap">{formatMoney(priceOn(catalog.mealPrices, w.ageGroupId, w.weekStart)?.price ?? null)}</td>
                      <td className="text-sm nowrap">{formatDateTime(w.publishedAt)}</td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <Link className="icon-btn" to={`/menu/plans/${w.id}`} title="Xem" aria-label={`Xem ${w.code}`}>
                          <Eye size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && items.length > 0 && <Pagination page={safePage} total={items.length} onChange={setPage} unit="thực đơn" />}
      </div>
    </div>
  );
}
