import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFilterParams } from '@/hooks/useFilterParams';
import { useGrowthReport, useHealthChecks } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { GrowthReportDataBadge } from '@/components/children/ChildBadges';
import { CAMPAIGN_STATUS } from '@/models/children/healthCheckConstants';
import { sameId } from '@/services/http/idStrings';
import { canManageHealthCheck, isPrincipal } from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import {
  GROWTH_COLUMN_COUNT,
  GROWTH_GROUPS,
  GROWTH_ITEMS,
  GROWTH_REPORT_TITLE,
  formatPct,
  growthReportNotesOf,
  growthReportRowsOf,
  growthReportSourcesOf,
  monthLabelOf,
  pctOf,
  rowValuesOf,
} from '@/utils/children/growthReport';
import { buildGrowthReportSheet, growthReportFileName } from '@/utils/children/growthReportSheet';
import { downloadXlsx } from '@/utils/exportXlsx';
import '@/styles/modules/children.css';

// Thẻ số liệu: số trẻ và tỉ lệ trên số trẻ được cân đo; tông theo mức BMI (gầy còm, thừa cân cam; béo phì đỏ) như BmiStatusBadge.
const STATS = [
  { key: 'underweight', label: 'SDD nhẹ cân', tone: 'orange' },
  { key: 'stunted', label: 'SDD thấp còi', tone: 'orange' },
  { key: 'wasted', label: 'SDD gầy còm', tone: 'orange' },
  { key: 'overweight', label: 'Thừa cân', tone: 'orange' },
  { key: 'obese', label: 'Béo phì', tone: 'red' },
];
const TOTAL_KINDS = new Set(['subtotal', 'campusTotal', 'grandTotal']);
const pctText = (value) => (value == null ? '–' : `${formatPct(value)}%`);

function StatValue({ main, sub }) {
  return (
    <span className="gr-stat">
      {main}
      {sub && <span className="gr-stat__sub">{sub}</span>}
    </span>
  );
}

function ValueCells({ counts }) {
  const v = rowValuesOf(counts);
  return (
    <>
      <td className="num">{v.enrolled}</td>
      <td className="num">{v.measured}</td>
      <td className="num">{formatPct(v.coverage)}</td>
      {v.items.map((it) => (
        <Fragment key={it.key}>
          <td className={it.warn ? 'num gr-warn' : 'num'}>{it.count}</td>
          <td className="num">{formatPct(it.pct)}</td>
        </Fragment>
      ))}
    </>
  );
}

function ReportRow({ row }) {
  if (row.kind === 'band')
    return (
      <tr className="gr-band">
        <td colSpan={GROWTH_COLUMN_COUNT}>
          <div className="gr-band__inner">
            <span className="gr-band__name">{row.label}</span>
            {row.campaigns.length > 0 && <span className="gr-band__meta">{row.campaigns.map((c) => c.name).join(' · ')}</span>}
            {row.provisional && <GrowthReportDataBadge status="PROVISIONAL" />}
          </div>
        </td>
      </tr>
    );
  if (row.kind === 'empty')
    return (
      <tr className="gr-row--empty">
        <td colSpan={GROWTH_COLUMN_COUNT}>
          <div className="gr-band__inner muted">{row.label}</div>
        </td>
      </tr>
    );
  const total = TOTAL_KINDS.has(row.kind);
  return (
    <tr className={total ? `gr-row--total${row.kind === 'grandTotal' ? ' gr-row--grand' : ''}` : undefined}>
      <td className="center gr-col-tt">{total ? '' : row.tt}</td>
      <td className="gr-col-name">{row.label}</td>
      <ValueCells counts={row.counts} />
    </tr>
  );
}

/**
 * Tổng hợp cân đo theo mẫu 5.1 của trường (coordinator chốt 2026-11-04; plan docs/plans/active/2026-11-04-health-growth-report.md):
 * số trẻ được cân đo, cân nặng, chiều cao, BMI theo tuổi chuẩn WHO từng lớp trong tháng, từ các kỳ cân đo và đợt khám bắt đầu trong
 * tháng. Hiệu trưởng xem mọi điểm trường; PHT điểm trường được giao. Số trẻ do BE đếm, trang chỉ tính tỉ lệ để hiển thị.
 */
export default function GrowthReportPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const principal = isPrincipal(user);
  const { schoolYear, schoolYears } = useSchoolYear();
  const yearLabel = schoolYears.find((y) => y.id === schoolYear)?.label || schoolYear;

  // Tháng chọn được: tháng bắt đầu của các kỳ cân đo, đợt khám (chưa hủy) trong phạm vi, năm học đang chọn; mặc định tháng gần nhất.
  const { campaigns, loading: monthsLoading, error: monthsError, reload: reloadMonths } = useHealthChecks({ schoolYear });
  const months = useMemo(
    () =>
      [...new Set(campaigns.filter((c) => c.status !== CAMPAIGN_STATUS.CANCELLED).map((c) => String(c.startDate).slice(0, 7)))]
        .sort()
        .reverse(),
    [campaigns],
  );
  const [filters, setFilters] = useFilterParams({ month: '', campusId: '' });
  const month = months.includes(filters.month) ? filters.month : months[0] || '';

  // Hiệu trưởng: tất cả hoặc từng điểm trường; PHT: điểm trường được giao (1 điểm trường ⇒ chỉ hiện tên).
  const campusOptions = principal ? md.campuses : md.campuses.filter((c) => canManageHealthCheck(user, c.id));
  const campusSelectable = principal || campusOptions.length > 1;
  // id /campuses là số khi nối BE, tham số URL là chuỗi
  const campusId = campusSelectable && campusOptions.some((c) => sameId(c.id, filters.campusId)) ? filters.campusId : '';
  const scopeLabel = campusId
    ? campusOptions.find((c) => sameId(c.id, campusId))?.name || ''
    : principal
      ? 'Tất cả điểm trường'
      : campusOptions.length === 1
        ? campusOptions[0].name
        : 'Các điểm trường được giao';

  const { report, loading, error, reload } = useGrowthReport({ month, campusId });
  const shown = report && report.month === month ? report : null;
  const rows = useMemo(() => growthReportRowsOf(shown), [shown]);
  const total = shown?.total;
  const busy = monthsLoading || (!!month && !error && (loading || !shown));
  const monthLabel = monthLabelOf(month);

  const exportExcel = () => downloadXlsx(buildGrowthReportSheet(shown, { scopeLabel }), growthReportFileName(month));

  const head = (
    <>
      <Breadcrumb items={childrenCrumbs('Tổng hợp cân đo')} />
      <div className="page__head">
        <h1 className="page__title">Tổng hợp cân đo</h1>
        {months.length > 0 && (
          <div className="page__actions">
            <button className="btn" onClick={exportExcel} disabled={!shown || busy}>
              <Download size={16} /> Xuất Excel
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (monthsError)
    return (
      <div className="page">
        {head}
        <div className="card">
          <ErrorState error={monthsError} onRetry={reloadMonths} />
        </div>
      </div>
    );

  if (!monthsLoading && months.length === 0)
    return (
      <div className="page">
        {head}
        <div className="card">
          <EmptyState
            title={`Năm học ${yearLabel} chưa có kỳ cân đo, đợt khám`}
            description="Báo cáo tổng hợp từ các kỳ cân đo và đợt khám sức khỏe bắt đầu trong tháng. Tạo kỳ cân đo hoặc đợt khám để có số liệu; chọn năm khác ở thanh trên để xem năm cũ."
            action={
              <Link to="/children/health-checks" className="btn">
                Đợt khám, kỳ cân đo
              </Link>
            }
          />
        </div>
      </div>
    );

  return (
    <div className="page">
      {head}

      <div className="card mb-16">
        <div className="filter-bar">
          <select
            className="select"
            aria-label="Tháng"
            value={month}
            disabled={monthsLoading}
            onChange={(e) => setFilters({ month: e.target.value })}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabelOf(m)}
              </option>
            ))}
          </select>
          {campusSelectable ? (
            <select className="select" aria-label="Điểm trường" value={campusId} onChange={(e) => setFilters({ campusId: e.target.value })}>
              <option value="">{principal ? 'Tất cả điểm trường' : 'Các điểm trường được giao'}</option>
              {campusOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            scopeLabel && (
              <p className="gr-scope m-0">
                Điểm trường: <strong>{scopeLabel}</strong>
              </p>
            )
          )}
        </div>
      </div>

      <div className="stat-grid gr-stats">
        <StatCard
          tone="green"
          icon={false}
          label="Đã cân đo"
          loading={busy}
          value={
            total && <StatValue main={`${total.measured}/${total.enrolled}`} sub={`(${pctText(pctOf(total.measured, total.enrolled))})`} />
          }
        />
        {STATS.map((s) => (
          <StatCard
            key={s.key}
            tone={s.tone}
            icon={false}
            label={s.label}
            loading={busy}
            value={total && <StatValue main={total[s.key]} sub={pctText(pctOf(total[s.key], total.measured))} />}
          />
        ))}
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">{GROWTH_REPORT_TITLE}</h2>
          </div>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap gr-table-wrap">
            <table className="table table--grid gr-table">
              <caption className="sr-only">
                {GROWTH_REPORT_TITLE} {monthLabel.toLowerCase()}, {scopeLabel}
              </caption>
              <thead>
                <tr>
                  <th rowSpan={4} className="center gr-col-tt">
                    TT
                  </th>
                  <th rowSpan={4} className="gr-col-name">
                    Tên lớp
                  </th>
                  <th rowSpan={4} className="num gr-col-wrap">
                    TS trẻ của lớp
                  </th>
                  <th rowSpan={4} className="num gr-col-wrap">
                    TS trẻ được cân đo
                  </th>
                  <th rowSpan={4} className="num gr-col-wrap">
                    Tỉ lệ %
                  </th>
                  <th colSpan={GROWTH_ITEMS.length * 2} className="center">
                    {monthLabel || 'Tháng'}
                  </th>
                </tr>
                <tr>
                  {GROWTH_GROUPS.map((g) => (
                    <th key={g.key} colSpan={g.items.length * 2} className="center">
                      {g.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {GROWTH_ITEMS.map((it) => (
                    <th key={it.key} colSpan={2} className="center">
                      {it.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {GROWTH_ITEMS.map((it) => (
                    <Fragment key={it.key}>
                      <th className="num">Tổng số</th>
                      <th className="num">Tỷ lệ %</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {busy ? <SkeletonRows rows={6} cols={GROWTH_COLUMN_COUNT} /> : rows.map((row) => <ReportRow key={row.key} row={row} />)}
              </tbody>
            </table>
          </div>
        )}
        {shown && !busy && (
          <div className="gr-notes">
            {/* Màn hình bỏ ghi chú giải thích (vẫn có trong file Excel); chỉ giữ dòng số trẻ chưa xếp nhóm — luôn là ghi chú cuối. */}
            {shown.total?.unclassified > 0 && <p className="muted text-xs m-0">{growthReportNotesOf(shown).at(-1)}</p>}
            <p className="muted text-xs m-0">Kỳ/đợt dùng cho báo cáo:</p>
            <ul className="gr-notes__sources muted text-xs">
              {growthReportSourcesOf(shown).map((s) => (
                <li key={s.campusId}>
                  <strong>{s.campus}:</strong> {s.lines.join('; ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
