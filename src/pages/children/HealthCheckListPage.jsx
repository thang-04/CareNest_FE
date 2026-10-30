import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RotateCcw, Info, Stethoscope, Search, Scale } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useHealthChecks } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { CampaignKindBadge, CampaignStatusBadge } from '@/components/children/ChildBadges';
import { CAMPAIGN_KIND, CAMPAIGN_KIND_LABELS, CAMPAIGN_STATUS, CAMPAIGN_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { formatDate } from '@/utils/format';
import { canManageHealthCheck, isPrincipal, isTeacherRole } from '@/utils/children/childrenPermissions';
import { healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const COLS = 8;

/**
 * Danh sách đợt khám sức khỏe và kỳ cân đo theo điểm trường (user chốt 2026-10-15, 2026-10-31; PROPOSED). Đợt khám thường
 * 1 lần/năm học, kỳ cân đo khoảng 3 tháng/lần; HT, PHT tạo.
 */
export default function HealthCheckListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [campusId, setCampusId] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // Đợt khám theo năm học chọn ở header, tính theo ngày bắt đầu khám (user chốt 2026-10-28, Y-4).
  const { schoolYear, schoolYears } = useSchoolYear();
  const yearLabel = schoolYears.find((y) => y.id === schoolYear)?.label || schoolYear;
  const { campaigns, loading, error, reload } = useHealthChecks({ campusId, kind, status, schoolYear });
  const manage = canManageHealthCheck(user);
  const filtered = !!(campusId || kind || status);
  const pageRows = paginate(campaigns, page);
  const resetFilters = () => {
    setCampusId('');
    setKind('');
    setStatus('');
    setPage(1);
  };
  const createActions = manage && (
    <>
      <Link to={`/children/health-checks/new?kind=${CAMPAIGN_KIND.EXAM}`} className="btn">
        <Stethoscope size={16} /> Tạo đợt khám
      </Link>
      <Link to={`/children/health-checks/new?kind=${CAMPAIGN_KIND.MEASUREMENT}`} className="btn btn--primary">
        <Plus size={16} /> Tạo kỳ cân đo
      </Link>
    </>
  );

  return (
    <div className="page">
      <Breadcrumb items={healthCheckCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Đợt khám và kỳ cân đo</h1>
        {manage && <div className="row row--wrap gap-2">{createActions}</div>}
      </div>

      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {isTeacherRole(user)
            ? 'Mở đợt khám hoặc kỳ cân đo đang diễn ra để nhập kết quả cho trẻ lớp bạn phụ trách.'
            : 'Đợt khám sức khỏe thường 1 lần/năm học; kỳ cân đo khoảng 3 tháng/lần. Mỗi điểm trường chỉ có một đợt khám hoặc kỳ cân đo chưa đóng. Giáo viên phụ trách lớp nhập kết quả; Hiệu trưởng hoặc Phó hiệu trưởng đóng khi nhập xong.'}{' '}
          Danh sách gồm các đợt, kỳ bắt đầu trong năm học {yearLabel}; chọn năm khác ở thanh trên để xem đợt cũ.
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
            value={kind}
            aria-label="Loại"
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả loại</option>
            {Object.entries(CAMPAIGN_KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
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
                  <th>Tên</th>
                  <th>Loại</th>
                  <th>Điểm trường</th>
                  <th>Ngày</th>
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
                          title="Không có đợt khám, kỳ cân đo phù hợp"
                          description="Không có đợt khám hoặc kỳ cân đo nào theo bộ lọc đã chọn."
                          action={
                            <button className="btn" onClick={resetFilters}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={Scale}
                          title={`Năm học ${yearLabel} chưa có đợt khám, kỳ cân đo`}
                          description={
                            manage
                              ? 'Tạo đợt khám hoặc kỳ cân đo cho từng điểm trường để giáo viên nhập kết quả.'
                              : 'Hiệu trưởng hoặc Phó hiệu trưởng tạo đợt khám, kỳ cân đo; chúng sẽ hiện ở đây để bạn theo dõi hoặc nhập kết quả.'
                          }
                          action={manage && <div className="row row--wrap gap-2">{createActions}</div>}
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
                      <td>
                        <CampaignKindBadge status={c.kind} />
                      </td>
                      <td className="text-sm">{c.campusName.split(' - ')[0]}</td>
                      <td className="nowrap text-sm">
                        {formatDate(c.startDate)} – {formatDate(c.endDate)}
                      </td>
                      <td className="center">
                        <CampaignStatusBadge status={c.status} />
                      </td>
                      <td className="tr-progress-cell">
                        <ProgressBar
                          value={c.progress.recorded}
                          total={c.progress.total}
                          ended={c.status === CAMPAIGN_STATUS.CLOSED || c.status === CAMPAIGN_STATUS.CANCELLED}
                        />
                        {c.progress.absent > 0 && (
                          <div className="muted text-xs">
                            {c.progress.absent} {c.kind === CAMPAIGN_KIND.MEASUREMENT ? 'vắng cân đo' : 'vắng khám'}
                          </div>
                        )}
                      </td>
                      <td className="text-sm nowrap">
                        {c.kind === CAMPAIGN_KIND.MEASUREMENT || c.progress.watch + c.progress.closeWatch === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            <div>{c.progress.watch} cần theo dõi</div>
                            <div className="text-danger">{c.progress.closeWatch} cần theo dõi sát</div>
                          </>
                        )}
                      </td>
                      <td className="cell--actions">
                        <RowActions
                          view={{ to: `/children/health-checks/${c.id}`, label: `Xem ${CAMPAIGN_KIND_LABELS[c.kind].toLowerCase()}` }}
                          name={c.name}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && campaigns.length > 0 && (
          <Pagination page={page} total={campaigns.length} onChange={setPage} unit="đợt, kỳ" />
        )}
      </div>
    </div>
  );
}
