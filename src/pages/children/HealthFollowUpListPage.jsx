import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Info, RotateCcw, Search, ClipboardCheck } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useHealthFollowUps } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { FollowUpDueBadge, FollowUpStatusBadge } from '@/components/children/ChildBadges';
import { SCREENING_CRITERIA_LABELS } from '@/models/children/childrenConstants';
import { FOLLOW_UP_CLOSE_MEANING, FOLLOW_UP_STATUS, FOLLOW_UP_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { formatDate, formatDateTime, normalizeText } from '@/utils/format';
import { isPrincipal, isTeacherRole } from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const COLS = 6;
// OVERDUE: phiếu chờ trao đổi đã quá hạn (BE đếm), lọc riêng, không phải một trạng thái.
const STATS = [
  { key: 'OVERDUE', tone: 'red', label: 'Quá hạn trao đổi' },
  { key: FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT, tone: 'orange' },
  { key: FOLLOW_UP_STATUS.PARENT_CONTACTED, tone: 'blue' },
  { key: FOLLOW_UP_STATUS.EXTERNAL_RESULT_RECORDED, tone: 'teal' },
  { key: FOLLOW_UP_STATUS.CLOSED, tone: 'green' },
];

/** Phiếu theo dõi dài hạn của trẻ ở mức "Cần theo dõi sát" (user chốt 2026-10-15, 2026-10-16, PROPOSED). */
export default function HealthFollowUpListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [campusId, setCampusId] = useState('');
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const { followUps, counts, loading, error, reload } = useHealthFollowUps({ campusId, status, overdue });
  const rows = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return followUps.filter((f) => !kw || normalizeText(`${f.child.fullName} ${f.child.code}`).includes(kw));
  }, [followUps, keyword]);
  const filtered = !!(campusId || status || overdue || keyword);
  const resetFilters = () => {
    setCampusId('');
    setStatus('');
    setOverdue(false);
    setKeyword('');
    setPage(1);
  };
  const toggleStat = (key) => {
    if (key === 'OVERDUE') {
      setOverdue(!overdue);
      setStatus('');
    } else {
      setStatus(status === key ? '' : key);
      setOverdue(false);
    }
    setPage(1);
  };
  const statActive = (key) => (key === 'OVERDUE' ? overdue : status === key);

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Phiếu theo dõi sức khỏe')} />
      <h1 className="page__title">Phiếu theo dõi sức khỏe</h1>

      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Mỗi trẻ có 1 phiếu theo dõi dài hạn, tự mở khi kết quả khám ở mức <b>Cần theo dõi sát – đề nghị khám chuyên khoa</b>. Kết quả mới
          ở mức này đưa phiếu về "Chờ trao đổi phụ huynh", hạn trao đổi 7 ngày.{' '}
          {isTeacherRole(user)
            ? 'Bạn ghi lại các lần trao đổi với phụ huynh và kết quả bác sĩ chuyên khoa báo lại.'
            : 'Giáo viên phụ trách lớp cập nhật phiếu; Ban giám hiệu theo dõi tiến độ.'}{' '}
          {FOLLOW_UP_CLOSE_MEANING} Hệ thống chỉ sàng lọc, không chẩn đoán.
        </div>
      </div>

      <div className="stat-grid">
        {STATS.map((s) => (
          <button
            key={s.key}
            className={`stat-card stat-card--${s.tone} ${statActive(s.key) ? 'stat-card--active' : ''}`}
            aria-pressed={statActive(s.key)}
            onClick={() => toggleStat(s.key)}
          >
            <div className="stat-card__value">{counts[s.key] ?? 0}</div>
            <div className="stat-card__label">{s.label || FOLLOW_UP_STATUS_LABELS[s.key]}</div>
            <StatCardIcon tone={s.tone} />
          </button>
        ))}
      </div>

      <div className="card">
        <div className="filter-bar">
          <label className="search-box tr-search-grow">
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm theo họ tên hoặc mã trẻ..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              aria-label="Tìm theo họ tên hoặc mã trẻ"
            />
          </label>
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
              setOverdue(false);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(FOLLOW_UP_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={resetFilters} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap tr-table-flat">
            <table className="table">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  <th>Lớp</th>
                  <th>Lý do theo dõi (lần khám gần nhất)</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={COLS} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLS}>
                      {filtered ? (
                        <EmptyState
                          icon={Search}
                          title="Không có phiếu phù hợp"
                          description="Không có phiếu theo dõi nào theo bộ lọc đã chọn."
                          action={
                            <button className="btn" onClick={resetFilters}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={ClipboardCheck}
                          title="Chưa có phiếu theo dõi"
                          description="Khi một trẻ có kết quả khám ở mức Cần theo dõi sát, phiếu sẽ hiện ở đây."
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  paginate(rows, page).map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link className="fw-600 text-primary" to={`/children/health-follow-ups/${f.id}`}>
                          {f.child.fullName}
                        </Link>
                        <div className="muted text-xs">{f.child.code}</div>
                      </td>
                      <td className="nowrap">
                        {f.child.className || <span className="muted">Chưa xếp lớp</span>}
                        <div className="muted text-xs">{f.child.campusName.split(' - ')[0]}</div>
                      </td>
                      <td className="text-sm">
                        {f.latest ? (
                          <>
                            <div>
                              {/* Phiếu khám: lý do là đề nghị của bác sĩ; mẫu cũ: tiêu chí sàng lọc. */}
                              {f.referral && f.referral.measurementId === f.latest.measurementId
                                ? f.referral.specialty
                                  ? `Bác sĩ đề nghị khám chuyên khoa: ${f.referral.specialty}`
                                  : f.referral.issueText || '—'
                                : f.latest.criteria
                                    .filter((c) => c.flagged)
                                    .map((c) => SCREENING_CRITERIA_LABELS[c.key])
                                    .join(' · ') || '—'}
                            </div>
                            {f.tbRisk && <span className="chip chip--red mt-8">Nguy cơ mắc lao (tiền sử tiếp xúc)</span>}
                            <div className="muted text-xs">
                              {formatDate(f.latest.date)}
                              {f.latest.campaignName ? ` · ${f.latest.campaignName}` : ' · Ngoài đợt khám'}
                            </div>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="tr-cell-stack">
                          <FollowUpStatusBadge status={f.status} />
                          {f.currentRound && !f.currentRound.contacted && (
                            <FollowUpDueBadge dueOn={f.currentRound.dueOn} overdueDays={f.currentRound.overdueDays} />
                          )}
                        </div>
                      </td>
                      <td className="nowrap text-sm">{formatDateTime(f.updatedAt)}</td>
                      <td className="center nowrap">
                        {f.canUpdate && f.status !== FOLLOW_UP_STATUS.CLOSED ? (
                          <Link className="btn btn--primary btn--sm" to={`/children/health-follow-ups/${f.id}`}>
                            Cập nhật phiếu
                          </Link>
                        ) : (
                          <Link
                            className="icon-btn"
                            to={`/children/health-follow-ups/${f.id}`}
                            title="Xem phiếu"
                            aria-label={`Xem phiếu theo dõi của ${f.child.fullName}`}
                          >
                            <Eye size={17} />
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
        {!loading && !error && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="phiếu" />}
      </div>
    </div>
  );
}
