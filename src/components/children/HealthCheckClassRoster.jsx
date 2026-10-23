import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, RotateCcw, Search, Stethoscope, Users } from '@/components/ui/icons';
import { useHealthCheckClass } from '@/hooks/children/useHealthChecks';
import { useFilterParams } from '@/hooks/useFilterParams';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { ChildResultBadge, ConclusionCategoryBadge, FollowUpDueBadge, FollowUpLevelShortBadge, PublishStatusBadge } from './ChildBadges';
import { CHILD_RESULT_STATUS, CHILD_RESULT_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { CONCLUSION_CATEGORY_LABELS } from '@/models/children/healthExamForm';
import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '@/models/children/childrenConstants';
import { formatDate, normalizeText } from '@/utils/format';

const COLS = 6;
// 10 trẻ một trang (user yêu cầu 2026-10-23).
const PAGE_SIZE = 10;
// Bộ lọc lưu trên URL: mở phiếu khám rồi quay lại vẫn giữ. Không lọc theo công bố: lưu kết luận là công bố (2026-10-23).
const FILTER_DEFAULTS = { keyword: '', result: '', conclusion: '' };

/** Kết luận rút gọn BE trả: chuyên khoa được chuyển hoặc lời dặn. */
const conclusionNote = (c) => (c?.specialty ? `Chuyển khám: ${c.specialty}` : c?.adviceText ? `Lời dặn: ${c.adviceText}` : '');

/**
 * Danh sách trẻ của một lớp trong đợt khám; giáo viên phụ trách lớp mở phiếu khám Phụ lục II từng trẻ khi đợt đang diễn ra.
 * embedded: sổ ngay dưới dòng lớp của bảng tiến độ (không khung card, không tiêu đề riêng).
 */
export function HealthCheckClassRoster({ campaignId, classId, embedded = false }) {
  const { roster, loading, error, reload } = useHealthCheckClass(campaignId, classId);
  const rows = useMemo(() => roster?.children || [], [roster]);
  const concluded = rows.filter((r) => r.result === CHILD_RESULT_STATUS.RECORDED).length;
  const [filters, setFilters, resetFilterParams, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { keyword, result, conclusion } = filters;
  const [page, setPage] = useState(1);
  // Lọc trên danh sách BE trả theo trường BE trả, không tính lại kết quả.
  const visible = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return rows
      .filter((r) => !result || r.result === result)
      .filter((r) => !conclusion || r.conclusionCategory === conclusion)
      .filter((r) => !kw || normalizeText(`${r.fullName} ${r.code}`).includes(kw));
  }, [rows, keyword, result, conclusion]);
  const current = Math.min(page, Math.max(1, Math.ceil(visible.length / PAGE_SIZE)));
  const filtered = activeKeys.length > 0;
  const setFilter = (patch) => {
    setFilters(patch);
    setPage(1);
  };
  const resetFilters = () => {
    resetFilterParams();
    setPage(1);
  };
  const chipLabels = {
    keyword: `Từ khóa: ${keyword}`,
    result: `Phiếu khám: ${CHILD_RESULT_STATUS_LABELS[result] || result}`,
    conclusion: `Kết luận: ${CONCLUSION_CATEGORY_LABELS[conclusion] || conclusion}`,
  };
  const chips = activeKeys.map((key) => ({ key, label: chipLabels[key], onRemove: () => setFilter({ [key]: '' }) }));
  // Phiếu khám mang theo lớp và bộ lọc để "Về đợt khám" mở lại đúng danh sách.
  const listQuery = new URLSearchParams({ classId, ...Object.fromEntries(activeKeys.map((key) => [key, filters[key]])) }).toString();
  const examLink = (childId) => `/children/health-checks/${campaignId}/exam/${childId}?${listQuery}`;

  const body = error ? (
    <ErrorState error={error} onRetry={reload} />
  ) : (
    <>
      <div className="filter-bar">
        <SearchSubmit
          className="tr-search-grow"
          value={keyword}
          placeholder="Tìm theo họ tên hoặc mã trẻ..."
          label="Tìm theo họ tên hoặc mã trẻ"
          onSearch={(text) => setFilter({ keyword: text })}
        />
        <select className="select" aria-label="Phiếu khám" value={result} onChange={(e) => setFilter({ result: e.target.value })}>
          <option value="">Tất cả phiếu khám</option>
          {Object.entries(CHILD_RESULT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select className="select" aria-label="Kết luận" value={conclusion} onChange={(e) => setFilter({ conclusion: e.target.value })}>
          <option value="">Tất cả kết luận</option>
          {Object.entries(CONCLUSION_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={resetFilters} disabled={!filtered}>
          <RotateCcw size={15} /> Đặt lại bộ lọc
        </button>
      </div>
      <FilterChips count={loading ? null : visible.length} unit="trẻ" chips={chips} />
      <div className="table-wrap tr-table-flat">
        <table className="table table--grid">
          <thead>
            <tr>
              <th>Trẻ</th>
              <th>Lần khám trước</th>
              <th>Phiếu khám</th>
              <th>Kết luận</th>
              <th>Phụ huynh</th>
              <th className="cell--actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows rows={4} cols={COLS} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyState icon={Users} title="Lớp chưa có trẻ trong đợt này" description="Trẻ đang học của lớp sẽ hiện ở đây." />
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyState
                    icon={Search}
                    title="Không có trẻ phù hợp"
                    description="Không có trẻ nào của lớp theo bộ lọc đã chọn."
                    action={
                      <button type="button" className="btn" onClick={resetFilters}>
                        <RotateCcw size={15} /> Đặt lại bộ lọc
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              paginate(visible, current, PAGE_SIZE).map((r) => {
                const legacy = r.source === MEASUREMENT_SOURCE.LEGACY;
                const hasExam = !!r.measurementId && !legacy;
                return (
                  <tr key={r.childId}>
                    <td>
                      <div className="fw-600">{r.fullName}</div>
                      <div className="muted text-xs">{r.code}</div>
                      {/* Trẻ đang có phiếu theo dõi: người nhập và bác sĩ khám biết để chú ý (user chốt 2026-10-16). */}
                      {r.followUp && (
                        <div className="tr-cell-stack mt-8">
                          <Link className="text-primary text-xs" to={`/children/health-follow-ups/${r.followUp.id}`}>
                            Đang có phiếu theo dõi
                          </Link>
                          <FollowUpDueBadge dueOn={r.followUp.dueOn} overdueDays={r.followUp.overdueDays} hideOnTime />
                          {r.followUp.latestExternalResult && (
                            <span className="muted text-xs tr-note">Bác sĩ chuyên khoa: {r.followUp.latestExternalResult.note}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-sm">
                      {r.previous ? (
                        <div className="tr-cell-stack">
                          <span className="muted text-xs">{formatDate(r.previous.date)}</span>
                          <FollowUpLevelShortBadge status={r.previous.followUpLevel} />
                          {conclusionNote(r.previous.conclusion) && (
                            <span className="muted text-xs tr-note">{conclusionNote(r.previous.conclusion)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="muted">Chưa có</span>
                      )}
                    </td>
                    <td className="center">
                      <ChildResultBadge status={r.result} />
                      {r.date && <div className="muted text-xs mt-8">Ngày khám {formatDate(r.date)}</div>}
                      {legacy && <div className="muted text-xs">{MEASUREMENT_SOURCE_LABELS.LEGACY}</div>}
                    </td>
                    <td>
                      {r.conclusionCategory ? (
                        <div className="tr-cell-stack">
                          <ConclusionCategoryBadge status={r.conclusionCategory} />
                          {conclusionNote(r.conclusion) && <span className="muted text-xs tr-note">{conclusionNote(r.conclusion)}</span>}
                        </div>
                      ) : r.followUpLevel ? (
                        <FollowUpLevelShortBadge status={r.followUpLevel} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {r.result !== CHILD_RESULT_STATUS.RECORDED ? (
                        <span className="muted">—</span>
                      ) : (
                        <PublishStatusBadge status={r.published ? 'PUBLISHED' : 'UNPUBLISHED'} />
                      )}
                    </td>
                    <td className="cell--actions">
                      {roster.canRecord && r.result === CHILD_RESULT_STATUS.NOT_RECORDED && (
                        <Link className="btn btn--primary btn--sm" to={examLink(r.childId)}>
                          <Stethoscope size={14} /> Khám
                        </Link>
                      )}
                      {roster.canRecord && r.result === CHILD_RESULT_STATUS.IN_PROGRESS && (
                        <Link className="btn btn--primary btn--sm" to={examLink(r.childId)}>
                          <Stethoscope size={14} /> Tiếp tục khám
                        </Link>
                      )}
                      <RowActions
                        view={
                          hasExam && !(roster.canRecord && r.result === CHILD_RESULT_STATUS.IN_PROGRESS)
                            ? { to: examLink(r.childId), label: 'Xem phiếu khám' }
                            : null
                        }
                        name={r.fullName}
                        extra={{ label: 'Mở sổ sức khỏe', icon: HeartPulse, to: `/children/${r.childId}/health` }}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && visible.length > 0 && (
        <Pagination page={current} total={visible.length} onChange={setPage} pageSize={PAGE_SIZE} unit="trẻ" />
      )}
    </>
  );

  if (embedded)
    return (
      <div className="tr-acc-roster" role="region" aria-label={roster ? `Danh sách trẻ ${roster.cls.name}` : 'Danh sách trẻ của lớp'}>
        {body}
      </div>
    );
  return (
    <section className="card mt-16" aria-label={roster ? `Danh sách trẻ ${roster.cls.name}` : 'Danh sách trẻ của lớp'}>
      <div className="card__header">
        <h2 className="card__title">
          {roster ? `${roster.cls.name} – đã có kết luận ${concluded}/${rows.length} trẻ` : 'Danh sách trẻ của lớp'}
        </h2>
      </div>
      {body}
    </section>
  );
}
