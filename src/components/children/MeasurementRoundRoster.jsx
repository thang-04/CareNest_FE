import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, RotateCcw, Scale, Search, Users } from '@/components/ui/icons';
import { useHealthCheckClass } from '@/hooks/children/useHealthChecks';
import { useFilterParams } from '@/hooks/useFilterParams';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { clickableRowProps } from '@/utils/clickableRow';
import { RosterActions } from './RosterActions';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { BmiStatusBadge, MeasurementResultBadge } from './ChildBadges';
import { BMI_STATUS } from '@/models/children/childrenConstants';
import { CHILD_RESULT_STATUS, MEASUREMENT_RESULT_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { formatDate, normalizeText } from '@/utils/format';
import { formatNumber } from '@/utils/children/childrenHelpers';

const COLS = 7;
const PAGE_SIZE = 10;
const FILTER_DEFAULTS = { keyword: '', result: '', bmiWarning: '' };

// Trẻ có cảnh báo BMI theo mức BE trả (HLT-18); chỉ để lọc hiển thị.
const hasBmiWarning = (r) => !!r.bmiStatus && r.bmiStatus !== BMI_STATUS.NORMAL;

/** Đường dẫn form số đo trong kỳ; mang theo lớp để "Lưu và nhập trẻ tiếp theo" và quay về đúng danh sách. */
export const measurementFormLink = (campaignId, classId, childId, measurementId) => {
  const query = new URLSearchParams({ campaignId, classId }).toString();
  return measurementId ? `/children/${childId}/health/${measurementId}/edit?${query}` : `/children/${childId}/health/new?${query}`;
};

/**
 * Danh sách trẻ của một lớp trong kỳ cân đo (user chốt 2026-10-31): giáo viên phụ trách lớp nhập số đo từng trẻ khi kỳ đang
 * diễn ra. Không có kết luận bác sĩ; mỗi trẻ có BMI và mức BMI theo tuổi BE xếp (HLT-18). embedded: sổ ngay dưới dòng lớp.
 */
export function MeasurementRoundRoster({ campaignId, classId, embedded = false }) {
  const navigate = useNavigate();
  const { roster, loading, error, reload } = useHealthCheckClass(campaignId, classId);
  const rows = useMemo(() => roster?.children || [], [roster]);
  const measured = rows.filter((r) => r.result === CHILD_RESULT_STATUS.RECORDED).length;
  const [filters, setFilters, resetFilterParams, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { keyword, result, bmiWarning } = filters;
  const [page, setPage] = useState(1);
  const visible = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return rows
      .filter((r) => !result || r.result === result)
      .filter((r) => !bmiWarning || hasBmiWarning(r))
      .filter((r) => !kw || normalizeText(`${r.fullName} ${r.code}`).includes(kw));
  }, [rows, keyword, result, bmiWarning]);
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
    bmiWarning: 'Có cảnh báo BMI',
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
        <div className="date-filter__static">
          <label className="checkbox text-sm">
            <input type="checkbox" checked={!!bmiWarning} onChange={(e) => setFilter({ bmiWarning: e.target.checked ? '1' : '' })} />
            Chỉ trẻ có cảnh báo BMI
          </label>
        </div>
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
              <th className="num">BMI</th>
              <th>Cảnh báo BMI</th>
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
                const healthLink = `/children/${r.childId}/health`;
                // Việc chính: giáo viên nhập hoặc sửa số đo; không có thì bấm dòng mở sổ sức khỏe (DESIGN §6.3)
                const primary =
                  roster.canRecord && r.result === CHILD_RESULT_STATUS.NOT_RECORDED
                    ? { label: 'Nhập số đo', strong: true, icon: Scale, to: measurementFormLink(campaignId, classId, r.childId) }
                    : roster.canRecord && recorded
                      ? {
                          label: 'Sửa số đo',
                          strong: false,
                          icon: Pencil,
                          to: measurementFormLink(campaignId, classId, r.childId, r.measurementId),
                        }
                      : null;
                return (
                  <tr key={r.childId} className="row-click" {...clickableRowProps(() => navigate(primary ? primary.to : healthLink))}>
                    <td>
                      <div className="fw-600">{r.fullName}</div>
                      <div className="muted text-xs">{r.code}</div>
                    </td>
                    <td>
                      <MeasurementResultBadge status={r.result} />
                      {r.date && <div className="muted text-xs mt-8">Ngày đo {formatDate(r.date)}</div>}
                    </td>
                    <td className="num">{formatNumber(r.heightCm)}</td>
                    <td className="num">{formatNumber(r.weightKg)}</td>
                    <td className="num">{formatNumber(r.bmi)}</td>
                    <td>{r.bmiStatus ? <BmiStatusBadge status={r.bmiStatus} /> : <span className="muted">—</span>}</td>
                    <td className="cell--actions">
                      <RosterActions name={r.fullName} primary={primary} healthLink={healthLink} />
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
