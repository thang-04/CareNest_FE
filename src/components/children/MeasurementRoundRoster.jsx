import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, RotateCcw, Scale, Search, Users } from '@/components/ui/icons';
import { useHealthCheckClass } from '@/hooks/children/useHealthChecks';
import { useFilterParams } from '@/hooks/useFilterParams';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { MeasurementResultBadge } from './ChildBadges';
import { CHILD_RESULT_STATUS, MEASUREMENT_RESULT_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { formatDate, normalizeText } from '@/utils/format';

const COLS = 5;
const PAGE_SIZE = 10;
const FILTER_DEFAULTS = { keyword: '', result: '' };

/** Đường dẫn form số đo trong kỳ; mang theo lớp để "Lưu và nhập trẻ tiếp theo" và quay về đúng danh sách. */
export const measurementFormLink = (campaignId, classId, childId, measurementId) => {
  const query = new URLSearchParams({ campaignId, classId }).toString();
  return measurementId ? `/children/${childId}/health/${measurementId}/edit?${query}` : `/children/${childId}/health/new?${query}`;
};

/**
 * Danh sách trẻ của một lớp trong kỳ cân đo (user chốt 2026-10-31): giáo viên phụ trách lớp nhập số đo từng trẻ khi kỳ đang
 * diễn ra. Không có kết luận, phiếu theo dõi. embedded: sổ ngay dưới dòng lớp của bảng tiến độ.
 */
export function MeasurementRoundRoster({ campaignId, classId, embedded = false }) {
  const { roster, loading, error, reload } = useHealthCheckClass(campaignId, classId);
  const rows = useMemo(() => roster?.children || [], [roster]);
  const measured = rows.filter((r) => r.result === CHILD_RESULT_STATUS.RECORDED).length;
  const [filters, setFilters, resetFilterParams, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { keyword, result } = filters;
  const [page, setPage] = useState(1);
  const visible = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return rows.filter((r) => !result || r.result === result).filter((r) => !kw || normalizeText(`${r.fullName} ${r.code}`).includes(kw));
  }, [rows, keyword, result]);
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
    result: `Số đo: ${MEASUREMENT_RESULT_STATUS_LABELS[result] || result}`,
  };
  const chips = activeKeys.map((key) => ({ key, label: chipLabels[key], onRemove: () => setFilter({ [key]: '' }) }));

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
        <select className="select" aria-label="Số đo" value={result} onChange={(e) => setFilter({ result: e.target.value })}>
          <option value="">Tất cả trẻ</option>
          {Object.entries(MEASUREMENT_RESULT_STATUS_LABELS).map(([value, label]) => (
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
              <th>Số đo</th>
              <th className="num">Chiều cao (cm)</th>
              <th className="num">Cân nặng (kg)</th>
              <th className="cell--actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows rows={4} cols={COLS} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyState icon={Users} title="Lớp chưa có trẻ trong kỳ này" description="Trẻ đang học của lớp sẽ hiện ở đây." />
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
                const recorded = r.result === CHILD_RESULT_STATUS.RECORDED;
                return (
                  <tr key={r.childId}>
                    <td>
                      <div className="fw-600">{r.fullName}</div>
                      <div className="muted text-xs">{r.code}</div>
                    </td>
                    <td>
                      <MeasurementResultBadge status={r.result} />
                      {r.date && <div className="muted text-xs mt-8">Ngày đo {formatDate(r.date)}</div>}
                    </td>
                    <td className="num">{r.heightCm ?? '—'}</td>
                    <td className="num">{r.weightKg ?? '—'}</td>
                    <td className="cell--actions">
                      {roster.canRecord && r.result === CHILD_RESULT_STATUS.NOT_RECORDED && (
                        <Link className="btn btn--primary btn--sm" to={measurementFormLink(campaignId, classId, r.childId)}>
                          <Scale size={14} /> Nhập số đo
                        </Link>
                      )}
                      <RowActions
                        name={r.fullName}
                        edit={
                          roster.canRecord && recorded
                            ? { to: measurementFormLink(campaignId, classId, r.childId, r.measurementId), label: 'Sửa số đo' }
                            : null
                        }
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

  const label = roster ? `Danh sách trẻ ${roster.cls.name}` : 'Danh sách trẻ của lớp';
  if (embedded)
    return (
      <div className="tr-acc-roster" role="region" aria-label={label}>
        {body}
      </div>
    );
  return (
    <section className="card mt-16" aria-label={label}>
      <div className="card__header">
        <h2 className="card__title">{roster ? `${roster.cls.name} – đã cân đo ${measured}/${rows.length} trẻ` : label}</h2>
      </div>
      {body}
    </section>
  );
}
