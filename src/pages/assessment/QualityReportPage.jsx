import { useState } from 'react';
import { Download } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { ROLES } from '@/models/User';
import { useProgramCompletion, useQualityReport } from '@/hooks/assessment/useAssessment';
import { downloadCsv } from '@/utils/exportCsv';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const VIEWS = [
  { key: 'month', label: 'Theo tháng' },
  { key: 'year', label: 'Cả năm' },
  { key: 'program', label: 'Trẻ 5 tuổi HTCT' },
];
const LEVEL_LABELS = { NHA_TRE: 'Tổng nhà trẻ', MAU_GIAO: 'Tổng mẫu giáo' };

const monthLabel = (m) => (m ? `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}` : '');
const shortMonth = (m) => `T${Number(m.slice(5))}`;
const pct = (v) => (v == null ? '—' : `${v}%`);
const num = (v) => (v == null ? '—' : v);
// Các mục tính theo số trẻ: mỗi mục 2 cột Số trẻ | Tỷ lệ như sổ chỉ đạo chuyên môn
const GROUPS = [
  // Trẻ ra lớp: số = bình quân trẻ có mặt mỗi ngày học; tỷ lệ = lượt có mặt / (sĩ số × ngày học)
  ['Trẻ ra lớp', 'avgPresent', 'attendanceRate'],
  ['Ăn bán trú', 'mealChildren', 'mealRate'],
  ['Bé chăm', 'diligentChildren', 'diligentRate'],
  ['Bé ngoan', 'goodChildren', 'goodRate'],
  ['Bé ngoan toàn diện', 'allRoundChildren', 'allRoundRate'],
];

/**
 * Báo cáo chất lượng tháng theo Biểu sổ chỉ đạo chuyên môn PHT: mục 4.2 (Theo tháng) và 4.1 (Cả năm: trẻ ra lớp bình quân
 * từng tháng). PHT xem điểm trường mình, Hiệu trưởng toàn trường và lọc điểm trường. Chỉ xem, xuất Excel (CSV).
 */
export default function QualityReportPage() {
  const { schoolYear } = useSchoolYear();
  const { user } = useAuth();
  const isPrincipal = user?.role === ROLES.PRINCIPAL;
  const [view, setView] = useState('month');
  // Tháng đã chọn gắn với năm học: đổi năm ở header thì về tháng gần nhất của năm mới
  const [picked, setPicked] = useState({ year: schoolYear, month: '' });
  const month = picked.year === schoolYear ? picked.month : '';
  const setMonth = (value) => setPicked({ year: schoolYear, month: value });
  const [campusId, setCampusId] = useState('');
  const { report, loading, error, reload } = useQualityReport({
    schoolYear,
    month: month || undefined,
    campusId: campusId || undefined,
  });
  const monthError = error?.details?.month;
  const rows = report?.rows || [];
  const totals = report?.totals || [];
  const months = report?.months || [];
  const campusOptions = isPrincipal && report?.allCampuses?.length ? report.allCampuses : report?.campuses || [];
  const multiCampus = isPrincipal || campusOptions.length > 1;
  const showCampus = multiCampus && !campusId && (report?.campuses?.length || 0) > 1;
  const campusName = (id) => campusOptions.find((c) => String(c.id) === String(id))?.name || id;
  const totalLabel = (t) => LEVEL_LABELS[t.level] || (isPrincipal && !campusId ? 'Toàn trường' : 'Tổng cộng');

  // Mục 8 sổ chỉ đạo chuyên môn: trẻ lớp 5–6 tuổi hoàn thành chương trình (đánh giá cuối năm đã xác nhận)
  const program = view === 'program';
  const {
    report: programReport,
    loading: programLoading,
    error: programError,
    reload: programReload,
  } = useProgramCompletion({ schoolYear, campusId: campusId || undefined }, { enabled: program });
  const programRows = programReport?.rows || [];

  const exportCsv = () => {
    const campusText = campusId ? ` – ${campusName(campusId)}` : '';
    if (program) {
      const line = (label, campus, x) => [
        label,
        ...(showCampus ? [campus] : []),
        x.children,
        x.completed,
        pct(x.completedRate),
        x.notCompleted,
        x.unmarked,
      ];
      downloadCsv(
        [
          [`Trẻ 5 tuổi hoàn thành chương trình GDMN${campusText}`],
          ['Lớp', ...(showCampus ? ['Điểm trường'] : []), 'Số trẻ', 'Hoàn thành', 'Tỷ lệ', 'Chưa hoàn thành', 'Chưa đánh giá'],
          ...programRows.map((r) => line(r.className, campusName(r.campusId), r)),
          ...(programReport ? [line(totalLabel({}), '', programReport.totals)] : []),
        ],
        'tre-5-tuoi-hoan-thanh-chuong-trinh.csv',
      );
      return;
    }
    if (view === 'year') {
      downloadCsv(
        [
          [`Trẻ đến lớp hằng tháng${campusText}`],
          ['Lớp', ...(showCampus ? ['Điểm trường'] : []), ...months.map(monthLabel)],
          ...rows.map((r) => [
            r.className,
            ...(showCampus ? [campusName(r.campusId)] : []),
            ...months.map((m) => num(r.avgPresentByMonth?.[m])),
          ]),
          ...totals.map((t) => [totalLabel(t), ...(showCampus ? [''] : []), ...months.map((m) => num(t.avgPresentByMonth?.[m]))]),
        ],
        `tre-den-lop-hang-thang.csv`,
      );
      return;
    }
    const line = (label, campus, x) => [
      label,
      ...(showCampus ? [campus] : []),
      x.children,
      num(x.avgPresent),
      pct(x.attendanceRate),
      x.mealChildren,
      pct(x.mealRate),
      x.diligentChildren,
      pct(x.diligentRate),
      x.goodChildren,
      pct(x.goodRate),
      x.allRoundChildren,
      pct(x.allRoundRate),
    ];
    downloadCsv(
      [
        [`Theo dõi chất lượng ${monthLabel(report?.month).toLowerCase()}${campusText}`],
        [
          'Lớp',
          ...(showCampus ? ['Điểm trường'] : []),
          'Sĩ số',
          'Trẻ ra lớp (bình quân)',
          'Tỷ lệ ra lớp',
          'Ăn bán trú',
          'Tỷ lệ bán trú',
          'Bé chăm',
          'Tỷ lệ bé chăm',
          'Bé ngoan',
          'Tỷ lệ bé ngoan',
          'Bé ngoan toàn diện',
          'Tỷ lệ BNTD',
        ],
        ...rows.map((r) => line(r.className, campusName(r.campusId), r)),
        ...totals.map((t) => line(totalLabel(t), '', t)),
      ],
      `chat-luong-thang-${report?.month || ''}.csv`,
    );
  };

  const monthCols = view === 'year' ? months.length : 1 + GROUPS.length * 2;
  const cols = 1 + (showCampus ? 1 : 0) + monthCols;

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.quality)} />
      <h1 className="page__title">Chất lượng tháng</h1>
      <div className="card">
        <div className="filter-bar dg-ov-toolbar">
          <Tabs items={VIEWS} value={view} onChange={setView} ariaLabel="Kiểu xem" />
          {view === 'month' && (
            <div className="field">
              <select
                className={`select ${monthError ? 'input--error' : ''}`}
                aria-label="Tháng"
                aria-invalid={!!monthError}
                aria-describedby={monthError ? 'qr-month-error' : undefined}
                value={month || report?.month || ''}
                onChange={(e) => setMonth(e.target.value)}
              >
                {months.length === 0 && report?.month && <option value={report.month}>{monthLabel(report.month)}</option>}
                {[...months].reverse().map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
              {monthError && (
                <p className="field__error" id="qr-month-error">
                  {monthError}
                </p>
              )}
            </div>
          )}
          {multiCampus && (
            <select className="select" aria-label="Điểm trường" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
              <option value="">Tất cả điểm trường</option>
              {campusOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="spacer" />
          {(program ? programRows : rows).length > 0 && (
            <button className="btn" onClick={exportCsv}>
              <Download size={16} /> Xuất Excel
            </button>
          )}
        </div>
        {program ? (
          <ProgramTable
            report={programReport}
            loading={programLoading}
            error={programError}
            reload={programReload}
            showCampus={showCampus}
            campusName={campusName}
            totalText={totalLabel({})}
          />
        ) : error && !monthError ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !loading && rows.length === 0 ? (
          <EmptyState title="Chưa có lớp" description="Năm học này chưa có lớp trong phạm vi bạn xem." />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid dg-qr-table">
              <thead>
                <tr>
                  <th rowSpan={view === 'year' ? 1 : 2}>Lớp</th>
                  {showCampus && <th rowSpan={view === 'year' ? 1 : 2}>Điểm trường</th>}
                  {view === 'year' ? (
                    months.map((m) => (
                      <th key={m} className="num" title={monthLabel(m)}>
                        {shortMonth(m)}
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="num" rowSpan={2}>
                        Sĩ số
                      </th>
                      {GROUPS.map(([label]) => (
                        <th key={label} className="center" colSpan={2}>
                          {label}
                        </th>
                      ))}
                    </>
                  )}
                </tr>
                {view !== 'year' && (
                  <tr>
                    {GROUPS.map(([label]) => [
                      <th key={`${label}-n`} className="num">
                        Số trẻ
                      </th>,
                      <th key={`${label}-p`} className="num">
                        Tỷ lệ
                      </th>,
                    ])}
                  </tr>
                )}
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={6} cols={cols} />
                ) : (
                  <>
                    {rows.map((r) => (
                      <tr key={r.classId}>
                        <td className="fw-600">{r.className}</td>
                        {showCampus && <td>{campusName(r.campusId)}</td>}
                        <Cells view={view} months={months} x={r} />
                      </tr>
                    ))}
                    {totals.map((t) => (
                      <tr key={t.level} className="dg-qr-total">
                        <td>{totalLabel(t)}</td>
                        {showCampus && <td />}
                        <Cells view={view} months={months} x={t} />
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgramTable({ report, loading, error, reload, showCampus, campusName, totalText }) {
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const rows = report?.rows || [];
  if (!loading && report && rows.length === 0)
    return <EmptyState title="Chưa có lớp 5–6 tuổi" description="Năm học này chưa có lớp 5–6 tuổi trong phạm vi bạn xem." />;
  const cells = (x) => (
    <>
      <td className="num">{x.children}</td>
      <td className="num">{x.completed}</td>
      <td className="num">{pct(x.completedRate)}</td>
      <td className="num">{x.notCompleted}</td>
      <td className="num">{x.unmarked}</td>
    </>
  );
  return (
    <div className="table-wrap">
      <table className="table table--grid dg-qr-table">
        <thead>
          <tr>
            <th>Lớp</th>
            {showCampus && <th>Điểm trường</th>}
            <th className="num">Số trẻ</th>
            <th className="num">Hoàn thành</th>
            <th className="num">Tỷ lệ</th>
            <th className="num">Chưa hoàn thành</th>
            <th className="num">Chưa đánh giá</th>
          </tr>
        </thead>
        <tbody>
          {loading || !report ? (
            <SkeletonRows rows={4} cols={showCampus ? 7 : 6} />
          ) : (
            <>
              {rows.map((r) => (
                <tr key={r.classId}>
                  <td>{r.className}</td>
                  {showCampus && <td>{campusName(r.campusId)}</td>}
                  {cells(r)}
                </tr>
              ))}
              <tr className="dg-qr-total">
                <td>{totalText}</td>
                {showCampus && <td />}
                {cells(report.totals)}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Cells({ view, months, x }) {
  if (view === 'year')
    return months.map((m) => (
      <td key={m} className="num">
        {num(x.avgPresentByMonth?.[m])}
      </td>
    ));
  return (
    <>
      <td className="num">{x.children}</td>
      {GROUPS.map(([label, count, rate]) => [
        <td key={`${label}-n`} className="num">
          {num(x[count])}
        </td>,
        <td key={`${label}-p`} className="num">
          {pct(x[rate])}
        </td>,
      ])}
    </>
  );
}
