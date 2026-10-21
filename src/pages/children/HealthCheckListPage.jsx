import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RotateCcw, Info, Stethoscope, Search } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useHealthChecks } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { CampaignStatusBadge } from '@/components/children/ChildBadges';
import { CAMPAIGN_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { formatDate } from '@/utils/format';
import { canManageHealthCheck, isPrincipal, isTeacherRole } from '@/utils/children/childrenPermissions';
import { healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const COLS = 7;

/** Danh sách đợt khám sức khỏe theo điểm trường (user chốt 2026-10-15, PROPOSED). */
export default function HealthCheckListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [campusId, setCampusId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { campaigns, loading, error, reload } = useHealthChecks({ campusId, status });
  const manage = canManageHealthCheck(user);
  const filtered = !!(campusId || status);
  const pageRows = paginate(campaigns, page);
  const resetFilters = () => {
    setCampusId('');
    setStatus('');
    setPage(1);
  };

  return (
    <div className="page">
      <Breadcrumb items={healthCheckCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Đợt khám sức khỏe</h1>
        {manage && (
          <Link to="/children/health-checks/new" className="btn btn--primary">
            <Plus size={16} /> Tạo đợt khám
          </Link>
        )}
      </div>

      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {isTeacherRole(user)
            ? 'Mở đợt đang diễn ra để nhập kết quả khám cho trẻ lớp bạn phụ trách.'
            : 'Mỗi điểm trường chỉ có một đợt khám chưa đóng. Giáo viên phụ trách lớp nhập kết quả trong ngày khám; Hiệu trưởng đóng đợt khi nhập xong.'}
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          {isPrincipal(user) && (
            <select
              className="select"
              value={campusId}
              aria-label="Điểm trường"
              onChange={(e) => {
                setCampusId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả điểm trường</option>
              {md.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="select"
            value={status}
            aria-label="Trạng thái"
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(CAMPAIGN_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={resetFilters} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap tr-table-flat">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Đợt khám</th>
                  <th>Điểm trường</th>
                  <th>Ngày khám</th>
                  <th className="center">Trạng thái</th>
                  <th>Đã nhập kết quả</th>
                  <th>Cần theo dõi</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={COLS} />
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={COLS}>
                      {filtered ? (
                        <EmptyState
                          icon={Search}
                          title="Không có đợt khám phù hợp"
                          description="Không có đợt khám nào theo bộ lọc đã chọn."
                          action={
                            <button className="btn" onClick={resetFilters}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={Stethoscope}
                          title="Chưa có đợt khám sức khỏe"
                          description={
                            manage
                              ? 'Tạo đợt khám cho từng điểm trường để giáo viên nhập kết quả trong ngày khám.'
                              : 'Hiệu trưởng tạo đợt khám; đợt sẽ hiện ở đây để bạn theo dõi hoặc nhập kết quả.'
                          }
                          action={
                            manage && (
                              <Link to="/children/health-checks/new" className="btn btn--primary">
                                <Plus size={16} /> Tạo đợt khám
                              </Link>
                            )
                          }
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link className="fw-600 text-primary" to={`/children/health-checks/${c.id}`}>
                          {c.name}
                        </Link>
                        {c.examiner && <div className="muted text-xs">{c.examiner}</div>}
                      </td>
                      <td className="text-sm">{c.campusName.split(' - ')[0]}</td>
                      <td className="nowrap text-sm">
                        {formatDate(c.startDate)} – {formatDate(c.endDate)}
                      </td>
                      <td className="center">
                        <CampaignStatusBadge status={c.status} />
                      </td>
                      <td className="tr-progress-cell">
                        <ProgressBar value={c.progress.recorded} total={c.progress.total} />
                        {c.progress.absent > 0 && <div className="muted text-xs">{c.progress.absent} vắng khám</div>}
                      </td>
                      <td className="text-sm nowrap">
                        {c.progress.watch + c.progress.closeWatch === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            <div>{c.progress.watch} cần theo dõi</div>
                            <div className="text-danger">{c.progress.closeWatch} cần theo dõi sát</div>
                          </>
                        )}
                      </td>
                      <td className="cell--actions">
                        <RowActions view={{ to: `/children/health-checks/${c.id}`, label: 'Xem đợt khám' }} name={c.name} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && campaigns.length > 0 && (
          <Pagination page={page} total={campaigns.length} onChange={setPage} unit="đợt khám" />
        )}
      </div>
    </div>
  );
}
