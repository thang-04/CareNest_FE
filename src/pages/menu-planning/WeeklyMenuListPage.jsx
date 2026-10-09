import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, RotateCcw, Eye, Pencil, CalendarRange, Sparkles } from '@/components/ui/icons';
import { useMenuAccess, useWeeklyMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { WeeklyStatusBadge } from '@/components/menu-planning/MenuBadges';
import { weeklyCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDateTime, todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { WEEKLY_STATUS, mondayOf, weekLabel } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

/** Screen #84 – weekly menus by week and age group, Draft or Published (UC 6.8). */
export default function WeeklyMenuListPage() {
  const navigate = useNavigate();
  const { canManage } = useMenuAccess();
  const [status, setStatus] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const { items, loading, error, reload } = useWeeklyMenus({ ageGroupId, keyword });
  const rows = items.filter((w) => !status || w.status === status);
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 8)));
  const thisWeek = mondayOf(todayInput());
  const filtered = status || ageGroupId || keyword;
  const reset = () => {
    setStatus('');
    setAgeGroupId('');
    setKeyword('');
    setPage(1);
  };
  const stats = [
    { key: '', label: 'Tất cả', tone: 'blue' },
    { key: WEEKLY_STATUS.DRAFT, label: 'Bản nháp', tone: 'orange' },
    { key: WEEKLY_STATUS.PUBLISHED, label: 'Đã xuất bản', tone: 'green' },
    { key: WEEKLY_STATUS.REPLACED, label: 'Đã thay thế', tone: 'purple' },
  ];

  return (
    <div className="page">
      <Breadcrumb items={weeklyCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Thực đơn tuần</h1>
        {canManage && (
          <div className="row row--wrap td-actions">
            <Link to="/menu/ai-suggestion?kind=WEEKLY" className="btn btn--outline-primary btn--lg">
              <Sparkles size={18} /> Gợi ý bằng AI
            </Link>
            <Link to="/menu/weekly/new" className="btn btn--primary btn--lg">
              <Plus size={18} /> Lập thực đơn tuần
            </Link>
          </div>
        )}
      </div>
      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.key || 'all'}
            className={`stat-card stat-card--${s.tone} ${status === s.key ? 'stat-card--active' : ''}`}
            onClick={() => {
              setStatus(s.key);
              setPage(1);
            }}
          >
            <div className="stat-card__value">{items.filter((w) => !s.key || w.status === s.key).length}</div>
            <div className="stat-card__label">{s.label}</div>
            <StatCardIcon tone={s.tone} />
          </button>
        ))}
      </div>
      <div className="card">
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã thực đơn hoặc tuần (dd/mm)..."
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
                  <th>Tuần</th>
                  <th>Nhóm tuổi</th>
                  <th className="right">Phiên bản</th>
                  <th className="right">Ngày có thực đơn</th>
                  <th>Trạng thái</th>
                  <th>Xuất bản lúc</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={8} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={CalendarRange}
                        title={filtered ? 'Không có kết quả phù hợp' : 'Chưa có thực đơn tuần'}
                        description={filtered ? 'Thử đổi bộ lọc.' : 'Xếp thực đơn mẫu cho từng ngày học trong tuần rồi xuất bản.'}
                        action={
                          filtered ? (
                            <button className="btn" onClick={reset}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          ) : (
                            canManage && (
                              <Link className="btn btn--primary" to="/menu/weekly/new">
                                <Plus size={16} /> Lập thực đơn tuần
                              </Link>
                            )
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(rows, safePage).map((w) => {
                    const filled = w.days.filter((d) => !d.holiday && d.menuId).length;
                    const school = w.days.filter((d) => !d.holiday).length;
                    return (
                      <tr key={w.id} className="row-click" onClick={() => navigate(`/menu/weekly/${w.id}`)}>
                        <td className="fw-600 text-primary nowrap">{w.code}</td>
                        <td className="nowrap">
                          {weekLabel(w.weekStart)}
                          {w.weekStart === thisWeek && (
                            <span className="chip chip--teal" style={{ marginLeft: 8 }}>
                              Tuần này
                            </span>
                          )}
                        </td>
                        <td className="text-sm">{ageGroupById(w.ageGroupId)?.shortName}</td>
                        <td className="right">{w.version}</td>
                        <td className={`right ${filled < school ? 'td-warn' : ''}`}>
                          {filled}/{school}
                        </td>
                        <td>
                          <WeeklyStatusBadge status={w.status} />
                        </td>
                        <td className="text-sm nowrap">{w.publishedAt ? formatDateTime(w.publishedAt) : '—'}</td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          <Link className="icon-btn" to={`/menu/weekly/${w.id}`} title="Xem" aria-label={`Xem ${w.code}`}>
                            <Eye size={17} />
                          </Link>
                          {canManage && w.status === WEEKLY_STATUS.DRAFT && (
                            <Link className="icon-btn" to={`/menu/weekly/${w.id}/edit`} title="Sửa" aria-label={`Sửa ${w.code}`}>
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
