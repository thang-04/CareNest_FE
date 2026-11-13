import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RotateCcw, Search, Scale } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useHealthChecks } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { SegmentedProgress } from '@/components/ui/SegmentedProgress';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { clickableRowProps } from '@/utils/clickableRow';
import { CampaignKindBadge, CampaignStatusBadge } from '@/components/children/ChildBadges';
import { CAMPAIGN_KIND, CAMPAIGN_KIND_LABELS, CAMPAIGN_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { formatDate } from '@/utils/format';
import { canManageHealthCheck, isPrincipal } from '@/utils/children/childrenPermissions';
import { healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';
import { CampusFilter } from '@/components/ui/CampusFilter';

const COLS = 7;

// Cộng 5 số BE trả ở progress.bmi (mỗi trẻ một mức) để hiện một dòng tổng ở danh sách; không tính lại từ số đo (HLT-18).
const bmiWarningTotal = (progress) => Object.values(progress.bmi || {}).reduce((sum, n) => sum + n, 0);

/**
 * Danh sách đợt khám sức khỏe và kỳ cân đo theo điểm trường (user chốt 2026-10-15, 2026-10-31; PROPOSED). Đợt khám thường
 * 1 lần/năm học, kỳ cân đo khoảng 3 tháng/lần; HT, PHT tạo.
 */
export default function HealthCheckListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  // Một nút tạo; trong form chuyển qua lại đợt khám / kỳ cân đo
  const createActions = manage && (
    <Link to="/children/health-checks/new" className="btn btn--primary">
      <Plus size={16} /> Tạo đợt khám
    </Link>
  );

  return (
    <div className="page">
      <Breadcrumb items={healthCheckCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Đợt khám và kỳ cân đo</h1>
        {manage && <div className="row row--wrap gap-2">{createActions}</div>}
      </div>

      <div className="card">
        <div className="filter-bar">
          {isPrincipal(user) && (
            <CampusFilter
              campuses={md.campuses}
              value={campusId}
              onChange={(v) => {
                setCampusId(v);
                setPage(1);
              }}
              hideLabel
            />
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
            <table className="table table--grid table--wrap-head">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th className="center">Loại</th>
                  <th>Điểm trường</th>
                  <th className="center">Ngày</th>
                  <th className="center">Trạng thái</th>
                  <th className="center">Đã nhập kết quả</th>
                  <th>Cảnh báo</th>
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
                    // Bấm dòng mở chi tiết đợt (DESIGN §6.3), không còn cột Thao tác
                    <tr key={c.id} className="row-click" {...clickableRowProps(() => navigate(`/children/health-checks/${c.id}`))}>
                      <td className="tr-campaign-name">
                        <Link className="fw-600 text-primary" to={`/children/health-checks/${c.id}`}>
                          {c.name}
                        </Link>
                        {c.examiner && <div className="muted text-xs">{c.examiner}</div>}
                      </td>
                      <td className="center">
                        <CampaignKindBadge status={c.kind} />
                      </td>
                      <td className="text-sm">{c.campusName.split(' - ')[0]}</td>
                      <td className="text-sm center">
                        {formatDate(c.startDate)} – {formatDate(c.endDate)}
                      </td>
                      <td className="center">
                        <CampaignStatusBadge status={c.status} />
                      </td>
                      <td className="tr-progress-cell center">
                        {/* Xanh lá: đã nhập; xám: vắng — đợt đã đóng có trẻ vắng vẫn đọc là đủ, không cả thanh xám (user yêu cầu 2026-11-11) */}
                        <SegmentedProgress
                          compact
                          label="Đã nhập kết quả"
                          total={c.progress.total}
                          text={c.progress.total ? `${c.progress.recorded}/${c.progress.total}` : '—'}
                          segments={[
                            { key: 'recorded', label: 'Đã nhập', value: c.progress.recorded, tone: 'green' },
                            {
                              key: 'absent',
                              label: c.kind === CAMPAIGN_KIND.MEASUREMENT ? 'Vắng cân đo' : 'Vắng khám',
                              value: c.progress.absent || 0,
                              tone: 'gray',
                            },
                          ]}
                        />
                        {c.progress.absent > 0 && (
                          <div className="muted text-xs">
                            {c.progress.absent} {c.kind === CAMPAIGN_KIND.MEASUREMENT ? 'vắng cân đo' : 'vắng khám'}
                          </div>
                        )}
                      </td>
                      {/* Đợt khám: theo kết luận bác sĩ; kỳ cân đo: số trẻ có cảnh báo BMI theo tuổi (HLT-19). */}
                      <td className="text-sm nowrap">
                        {c.kind === CAMPAIGN_KIND.MEASUREMENT ? (
                          bmiWarningTotal(c.progress) > 0 ? (
                            <div>{bmiWarningTotal(c.progress)} trẻ có cảnh báo BMI</div>
                          ) : (
                            <span className="muted">—</span>
                          )
                        ) : c.progress.watch + c.progress.closeWatch === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            <div>{c.progress.watch} cần theo dõi</div>
                            <div className="text-danger">{c.progress.closeWatch} cần theo dõi sát</div>
                          </>
                        )}
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
