import { useState } from 'react';
import { ArrowLeft, BarChart3, ClipboardCheck, Flag, HeartPulse } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { CampusFilter } from '@/components/ui/CampusFilter';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { ClassCommentList } from '@/components/assessment/ClassComments';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useClassAssessmentDetail, useClassAssessmentOverview } from '@/hooks/assessment/useAssessment';
import { OVERVIEW_PERIOD, OVERVIEW_PERIOD_LABELS } from '@/models/assessment/assessmentConstants';
import { HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';
import { formatDate } from '@/utils/format';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const PAGE_SIZE = 10;
const PERIODS = Object.values(OVERVIEW_PERIOD).map((key) => ({ key, label: OVERVIEW_PERIOD_LABELS[key] }));

const rangeText = (o) => (o.start === o.end ? formatDate(o.start) : `${formatDate(o.start)} – ${formatDate(o.end)}`);
const pct = (n, total) => (total ? `${Math.round((n * 100) / total)}%` : '–');
// Lớp còn trẻ có mặt chưa được đánh giá
const missing = (r) => r.assessed < r.present;
const signsText = (signs) =>
  Object.entries(signs)
    .map(([key, n]) => `${HEALTH_SYMPTOMS[key] || key} (${n})`)
    .join(', ');

function SkillsCell({ dat, canCoGang, chuaDat }) {
  const total = dat + canCoGang + chuaDat;
  if (!total) return <span className="muted">–</span>;
  return (
    <span className="nowrap">
      {dat} ({pct(dat, total)}) · {canCoGang} ({pct(canCoGang, total)}) · {chuaDat} ({pct(chuaDat, total)})
    </span>
  );
}

/** Chi tiết một lớp trong kỳ: từng trẻ, tổng hợp tiêu chí và nhận xét. */
function ClassDetail({ classId, period, schoolYear, onBack }) {
  const [page, setPage] = useState(1);
  const { detail, loading, error, reload } = useClassAssessmentDetail({ classId, period, schoolYear });
  const rows = detail?.children || [];
  const multiDay = (detail?.schoolDays || 0) > 1;
  return (
    <>
      <div className="filter-bar">
        <button className="btn" onClick={onBack}>
          <ArrowLeft size={16} /> Tất cả lớp
        </button>
        {detail && (
          <strong>
            {detail.className} · {OVERVIEW_PERIOD_LABELS[period]} ({rangeText(detail)})
          </strong>
        )}
      </div>
      {detail && !loading && !error && <ClassCommentList comments={detail.classComments} />}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap">
          <table className="table table--grid">
            <thead>
              <tr>
                <th>Trẻ</th>
                <th className="num">{multiDay ? 'Ngày có mặt' : 'Có mặt'}</th>
                <th className="num">{multiDay ? 'Ngày đã đánh giá' : 'Đã đánh giá'}</th>
                <th>Sức khỏe</th>
                <th>Đạt · Cần cố gắng · Chưa đạt</th>
                <th className="num">Cờ</th>
                <th>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {loading || !detail ? (
                <SkeletonRows rows={5} cols={7} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="Lớp chưa có trẻ" />
                  </td>
                </tr>
              ) : (
                paginate(rows, page, PAGE_SIZE).map((r) => (
                  <tr key={r.childId}>
                    <td>{r.fullName}</td>
                    <td className="num">{multiDay ? r.presentDays : r.presentDays ? 'Có' : 'Vắng'}</td>
                    <td className={`num ${r.assessedDays < r.presentDays ? 'text-danger' : ''}`}>
                      {multiDay ? `${r.assessedDays}/${r.presentDays}` : r.presentDays ? (r.assessedDays ? 'Đã đánh giá' : 'Chưa') : '–'}
                    </td>
                    <td>{r.healthDays ? signsText(r.signs) : r.presentDays ? 'Bình thường' : '–'}</td>
                    <td>
                      <SkillsCell {...r} />
                    </td>
                    <td className="num">{r.flags}</td>
                    <td>
                      {r.comments.length === 0 ? (
                        <span className="muted">–</span>
                      ) : (
                        r.comments.map((c) => (
                          <div key={c.date}>
                            {multiDay && <span className="muted">{formatDate(c.date)}: </span>}
                            {c.text}
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > PAGE_SIZE && <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} unit="trẻ" />}
    </>
  );
}

/**
 * Tổng quan đánh giá các lớp cho PHT (điểm trường mình) và Hiệu trưởng (toàn trường, lọc điểm trường): tổng hợp từ đánh giá
 * hằng ngày theo hôm nay / tuần học / tháng; bấm một lớp để xem từng trẻ. Chỉ xem.
 */
export default function ClassAssessmentOverviewPage() {
  const { schoolYear } = useSchoolYear();
  const [period, setPeriod] = useState(OVERVIEW_PERIOD.DAY);
  const [campusId, setCampusId] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [openClass, setOpenClass] = useState('');
  const [page, setPage] = useState(1);
  const { overview, loading, error, reload } = useClassAssessmentOverview({
    period,
    schoolYear,
    campusId: campusId || undefined,
    ageGroupId: ageGroupId || undefined,
    classId: classId || undefined,
  });
  const rows = overview?.rows || [];
  const t = overview?.totals;
  const multiCampus = (overview?.campuses.length || 0) > 1;
  const multiDay = (overview?.schoolDays || 0) > 1;
  const campusName = (id) => overview?.campuses.find((c) => c.id === id)?.name || id;
  const classOptions = (overview?.classes || []).filter(
    (c) => (!campusId || c.campusId === campusId) && (!ageGroupId || c.ageGroupId === ageGroupId),
  );
  const cols = 9 + (multiCampus ? 1 : 0) + (multiDay ? 1 : 0);
  const filter = (set) => (value) => {
    set(value);
    setPage(1);
  };

  const kpis = t
    ? [
        { key: 'done', tone: 'teal', icon: ClipboardCheck, value: `${t.complete}/${t.classes}`, label: 'Lớp đã đánh giá đủ' },
        { key: 'rate', tone: 'green', icon: BarChart3, value: t.datRate == null ? '–' : `${t.datRate}%`, label: 'Tỷ lệ Đạt' },
        { key: 'health', tone: 'orange', icon: HeartPulse, value: t.healthChildren, label: 'Trẻ có dấu hiệu sức khỏe' },
        { key: 'flags', tone: 'blue', icon: Flag, value: t.flags, label: 'Cờ' },
      ]
    : [];

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.overview)} />
      <h1 className="page__title">Tổng quan đánh giá lớp</h1>
      <div className="card">
        {openClass ? (
          <ClassDetail classId={openClass} period={period} schoolYear={schoolYear} onBack={() => setOpenClass('')} />
        ) : (
          <>
            <Tabs items={PERIODS} value={period} onChange={filter(setPeriod)} ariaLabel="Kỳ tổng hợp" />
            {kpis.length > 0 && (
              <div className="stat-grid mt-12">
                {kpis.map((k) => (
                  <div key={k.key} className={`stat-card stat-card--${k.tone}`}>
                    <div className="stat-card__value">{k.value}</div>
                    <div className="stat-card__label">
                      {k.label} · {rangeText(overview)}
                    </div>
                    <StatCardIcon tone={k.tone} icon={k.icon} />
                  </div>
                ))}
              </div>
            )}
            <div className="filter-bar mt-12">
              <CampusFilter
                campuses={overview?.campuses}
                value={campusId}
                onChange={(v) => {
                  filter(setCampusId)(v);
                  setClassId('');
                }}
              />
              <select
                className="select"
                aria-label="Nhóm tuổi"
                value={ageGroupId}
                onChange={(e) => {
                  filter(setAgeGroupId)(e.target.value);
                  setClassId('');
                }}
              >
                <option value="">Tất cả nhóm tuổi</option>
                {(overview?.ageGroups || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select className="select" aria-label="Lớp" value={classId} onChange={(e) => filter(setClassId)(e.target.value)}>
                <option value="">Tất cả lớp</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {multiCampus && !campusId ? ` · ${campusName(c.campusId)}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : (
              <div className="table-wrap">
                <table className="table table--grid">
                  <thead>
                    <tr>
                      <th>Lớp</th>
                      <th>Nhận xét chung</th>
                      {multiCampus && <th>Điểm trường</th>}
                      <th className="num">Sĩ số</th>
                      <th className="num">{multiDay ? 'Lượt có mặt' : 'Có mặt'}</th>
                      <th className="num">Đã đánh giá</th>
                      {multiDay && <th className="num">Ngày đã đánh giá</th>}
                      <th className="num">Trẻ có dấu hiệu sức khỏe</th>
                      <th>Đạt · Cần cố gắng · Chưa đạt</th>
                      <th className="num">Cờ</th>
                      <th className="num">Ngày đã khóa / đang mở lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading || !overview ? (
                      <SkeletonRows rows={5} cols={cols} />
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={cols}>
                          <EmptyState title="Không có lớp phù hợp" />
                        </td>
                      </tr>
                    ) : (
                      paginate(rows, page, PAGE_SIZE).map((r) => (
                        <tr key={r.classId}>
                          <td>
                            <button type="button" className="link-btn" onClick={() => setOpenClass(r.classId)}>
                              {r.className}
                            </button>
                          </td>
                          <td>
                            {r.classComments?.length ? (
                              <button type="button" className="link-btn" onClick={() => setOpenClass(r.classId)}>
                                Xem {r.classComments.length} nhận xét
                              </button>
                            ) : (
                              <span className="text-2">Chưa có</span>
                            )}
                          </td>
                          {multiCampus && <td>{campusName(r.campusId)}</td>}
                          <td className="num">{r.size}</td>
                          <td className="num">{r.present}</td>
                          <td className={`num ${missing(r) ? 'text-danger' : ''}`}>
                            {r.assessed}/{r.present}
                          </td>
                          {multiDay && (
                            <td className={`num ${r.assessedDays < r.schoolDays ? 'text-danger' : ''}`}>
                              {r.assessedDays}/{r.schoolDays}
                            </td>
                          )}
                          <td className="num">{r.healthChildren}</td>
                          <td>
                            <SkillsCell {...r} />
                          </td>
                          <td className="num">{r.flags}</td>
                          <td className="num">
                            {r.lockedDays} / {r.reopenedDays}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length > PAGE_SIZE && <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} unit="lớp" />}
          </>
        )}
      </div>
    </div>
  );
}
