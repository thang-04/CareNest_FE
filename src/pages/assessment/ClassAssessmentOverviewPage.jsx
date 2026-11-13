import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Unlock } from '@/components/ui/icons';
import { inLeaderEditScope, isLeader } from '@/utils/assessment/assessmentPermissions';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { ClassCommentList } from '@/components/assessment/ClassComments';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { clickableRowProps } from '@/utils/clickableRow';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { ROLES } from '@/models/User';
import { useClassAssessmentDetail, useClassAssessmentOverview, useDailyAssessmentClasses } from '@/hooks/assessment/useAssessment';
import { OVERVIEW_PERIOD, OVERVIEW_PERIOD_LABELS } from '@/models/assessment/assessmentConstants';
import { HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';
import { DateInput } from '@/components/form/DateInput';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import { todayIso } from '@/utils/assessment/assessmentPeriods';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';
import { CampusFilter } from '@/components/ui/CampusFilter';

const PAGE_SIZE = 10;
// Chỉ xem theo ngày và tháng (user chốt 03/11/2026: bỏ "Tuần này" để không nhầm với đánh giá tuần đã bỏ)
const PERIODS = [OVERVIEW_PERIOD.DAY, OVERVIEW_PERIOD.MONTH].map((key) => ({ key, label: OVERVIEW_PERIOD_LABELS[key] }));

const rangeText = (o) => (o.start === o.end ? formatDate(o.start) : `${formatDate(o.start)} – ${formatDate(o.end)}`);
const pct = (n, total) => (total ? `${Math.round((n * 100) / total)}%` : '–');
// Lớp còn trẻ có mặt chưa được đánh giá
const missing = (r) => r.assessed < r.present;
const latestComment = (comments = []) => comments.reduce((a, c) => (!a || c.date > a.date ? c : a), null);
const signsText = (signs) =>
  Object.entries(signs)
    .map(([key, n]) => `${HEALTH_SYMPTOMS[key] || key} (${n})`)
    .join(', ');

/**
 * Kiến thức kỹ năng: số lượt mục tiêu Đạt / Chưa đạt trong kỳ (mỗi MT của mỗi hoạt động là một lượt). Ngày trẻ vắng BE
 * tính mọi MT của giáo án ngày đó là Chưa đạt (OBS-01); trẻ có mặt chưa đánh giá không có lượt nào nên để "–".
 */
function SkillsCell({ dat, chuaDat }) {
  const total = dat + chuaDat;
  if (!total) return <span className="muted">–</span>;
  return (
    <span className="row gap-1 nowrap" title={`${total} lượt mục tiêu: Đạt ${pct(dat, total)}, Chưa đạt ${pct(chuaDat, total)}`}>
      {dat > 0 && <span className="chip chip--green">{dat} Đạt</span>}
      {chuaDat > 0 && <span className="chip chip--red">{chuaDat} Chưa đạt</span>}
    </span>
  );
}

/** Các mục GV ghi ở Đánh giá hằng ngày; số = trẻ cần chú ý ở mục đó (KTKN = số mục Chưa đạt). */
const CRITERIA = [
  { key: 'health', label: 'Sức khỏe', row: 'healthChildren', child: 'healthDays', note: 'Có dấu hiệu' },
  { key: 'eating', label: 'Ăn', row: 'eatingChildren', child: 'eatingDays', note: 'Ăn ít' },
  { key: 'nap', label: 'Ngủ trưa', row: 'napChildren', child: 'napDays', note: 'Ngủ ít' },
  { key: 'emotion', label: 'Cảm xúc', row: 'emotionChildren', child: 'emotionDays', note: 'Buồn, khó chịu' },
  { key: 'behavior', label: 'Hành vi', row: 'behaviorChildren', child: 'behaviorDays', note: 'Cần chú ý' },
  { key: 'participation', label: 'Tham gia', row: 'participationChildren', child: 'participationDays', note: 'Chưa tích cực' },
];

/** Dải số liệu theo các mục đánh giá hằng ngày của một lớp; số khác 0 tô đỏ. */
function CriteriaStrip({ values, notMet, flags }) {
  const items = [
    ...CRITERIA.map((c) => ({ key: c.key, label: c.label, value: values[c.key] || 0, danger: true })),
    { key: 'skills', label: 'Lượt mục tiêu chưa đạt', value: notMet || 0, danger: true },
    { key: 'flags', label: 'Cờ', value: flags || 0 },
  ];
  return (
    <div className="dg-class-summary">
      {items.map((i) => (
        <div key={i.key} className="dg-class-summary__item">
          <div className={`dg-class-summary__value ${i.danger && i.value > 0 ? 'text-danger' : ''}`}>{i.value}</div>
          <div className="text-xs text-2">{i.label}</div>
        </div>
      ))}
    </div>
  );
}

const DETAIL_COLS = 5 + CRITERIA.length;

/** Một mục của một trẻ: vắng thì "–", không có gì thì trống, cần chú ý thì chữ đỏ (kỳ nhiều ngày: số ngày). */
// Trống = đã đánh giá và bình thường; "–" = vắng hoặc chưa được đánh giá ngày nào (Cần yêu cầu 10/11/2026)
function ConcernCell({ days, present, assessed, multiDay, note }) {
  if (!present || !assessed) return <span className="muted">–</span>;
  if (!days) return null;
  return <span className="text-danger">{multiDay ? `${days} ngày` : note}</span>;
}

/** Chi tiết một lớp trong kỳ: từng trẻ, tổng hợp tiêu chí và nhận xét. */
function ClassDetail({ classId, period, date, schoolYear, onBack }) {
  const [page, setPage] = useState(1);
  const { detail, loading, error, reload } = useClassAssessmentDetail({ classId, period, date, schoolYear });
  const rows = detail?.children || [];
  const multiDay = (detail?.schoolDays || 0) > 1;
  return (
    <>
      <div className="filter-bar dg-ov-toolbar">
        <button className="btn" onClick={onBack}>
          <ArrowLeft size={16} /> Tất cả lớp
        </button>
        {detail && (
          <strong>
            {detail.className} · {OVERVIEW_PERIOD_LABELS[period]} ({rangeText(detail)})
          </strong>
        )}
      </div>
      {detail && !loading && !error && (
        <>
          <div className="dg-ov-block">
            <ClassCommentList comments={detail.classComments} />
          </div>
          <CriteriaStrip
            values={Object.fromEntries(CRITERIA.map((c) => [c.key, rows.filter((r) => (r[c.child] || 0) > 0).length]))}
            notMet={rows.reduce((n, r) => n + r.chuaDat, 0)}
            flags={rows.reduce((n, r) => n + r.flags, 0)}
          />
        </>
      )}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap">
          <table className="table table--grid">
            <thead>
              <tr>
                <th>Trẻ</th>
                <th className="num">{multiDay ? 'Ngày có mặt' : 'Có mặt'}</th>
                {CRITERIA.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th title="Số lượt mục tiêu theo từng ngày cô chấm Đạt / Chưa đạt (ngày trẻ vắng tính Chưa đạt). Bảng đánh giá chủ đề xét Đạt theo tỷ lệ cả chủ đề nên số có thể khác.">
                  Kiến thức kỹ năng
                </th>
                <th className="num">Cờ</th>
                <th>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {loading || !detail ? (
                <SkeletonRows rows={5} cols={DETAIL_COLS} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={DETAIL_COLS}>
                    <EmptyState title="Lớp chưa có trẻ" />
                  </td>
                </tr>
              ) : (
                paginate(rows, page, PAGE_SIZE).map((r) => (
                  <tr key={r.childId}>
                    <td>
                      {r.fullName}
                      {r.presentDays > 0 && r.assessedDays < r.presentDays && (
                        <div className="text-xs text-danger">
                          {multiDay ? `Chưa đánh giá ${r.presentDays - r.assessedDays} ngày` : 'Chưa đánh giá'}
                        </div>
                      )}
                    </td>
                    <td className="num">{multiDay ? r.presentDays : r.presentDays ? 'Có' : 'Vắng'}</td>
                    {CRITERIA.map((c) => (
                      <td key={c.key}>
                        <ConcernCell
                          days={r[c.child] || 0}
                          present={r.presentDays}
                          assessed={r.assessedDays}
                          multiDay={multiDay}
                          note={c.key === 'health' && r.healthDays ? signsText(r.signs) : c.note}
                        />
                      </td>
                    ))}
                    <td>
                      <SkillsCell {...r} />
                    </td>
                    <td className="num">{r.flags || ''}</td>
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

// Lớp cần theo dõi: còn trẻ có mặt chưa đánh giá hoặc có trẻ cần chú ý ở một mục đánh giá hằng ngày; xếp lên đầu bảng
const needsWatch = (r) => missing(r) || CRITERIA.some((c) => (r[c.row] || 0) > 0);
const sortRows = (rows) =>
  [...rows].sort((a, b) => Number(needsWatch(b)) - Number(needsWatch(a)) || a.className.localeCompare(b.className, 'vi'));
const timeOf = (iso, multiDay) => {
  if (!iso) return '–';
  const text = formatDateTime(iso);
  return multiDay ? text : text.split(' ').pop();
};

/**
 * Tổng quan đánh giá các lớp cho PHT (điểm trường mình) và Hiệu trưởng (toàn trường): chọn kỳ ngày / tuần / tháng và ngày xem;
 * bảng các lớp kèm nhận xét chung, bấm một lớp để đọc nhận xét, rồi xem từng trẻ. Chỉ xem.
 */
export default function ClassAssessmentOverviewPage() {
  const { schoolYear } = useSchoolYear();
  const { user } = useAuth();
  const isPrincipal = user?.role === ROLES.PRINCIPAL;
  // Lớp mình dạy (GV, tổ trưởng): lớp khác trong ô chọn ghi "(chỉ xem)"; BGH không dạy lớp nên không ghi
  const { classes: ownClasses } = useDailyAssessmentClasses({ enabled: !isLeader(user) });
  const own = new Set(isLeader(user) ? [] : ownClasses.map((c) => String(c.id)));
  const today = todayIso();
  const [period, setPeriod] = useState(OVERVIEW_PERIOD.DAY);
  const [date, setDate] = useState(today);
  const [dateInput, setDateInput] = useState(today);
  const [dateError, setDateError] = useState('');
  const [campusId, setCampusId] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [openClass, setOpenClass] = useState('');
  const [page, setPage] = useState(1);
  const { overview, loading, error, reload } = useClassAssessmentOverview({
    period,
    date,
    schoolYear,
    campusId: campusId || undefined,
    ageGroupId: ageGroupId || undefined,
    classId: classId || undefined,
  });
  const rows = sortRows(overview?.rows || []);
  // Hiệu trưởng luôn lọc được theo điểm trường; PHT chỉ xem điểm trường của mình
  const campusOptions = isPrincipal && overview?.allCampuses?.length ? overview.allCampuses : overview?.campuses || [];
  // Tổ trưởng xem các lớp nhóm tuổi mình: không lọc / không hiện điểm trường
  const multiCampus = isLeader(user) && (isPrincipal || campusOptions.length > 1);
  const multiDay = (overview?.schoolDays || 0) > 1;
  // Mở lại ngày: HT mọi lớp, PHT lớp điểm trường mình (BE leadsCampus); tổ trưởng chỉ xem
  const canUnlock = (campus) => inLeaderEditScope(campus, user);
  const campusName = (id) => campusOptions.find((c) => String(c.id) === String(id))?.name || id;
  const classOptions = (overview?.classes || []).filter(
    (c) => (!campusId || String(c.campusId) === String(campusId)) && (!ageGroupId || String(c.ageGroupId) === String(ageGroupId)),
  );
  const filter = (set) => (value) => {
    set(value);
    setPage(1);
  };
  const changeDate = (value) => {
    setDateInput(value);
    if (!value) return setDateError('Vui lòng chọn ngày');
    if (!isIsoDate(value)) return setDateError('Ngày không hợp lệ');
    if (value > today) return setDateError('Không chọn ngày trong tương lai');
    setDateError('');
    filter(setDate)(value);
  };

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.overview)} />
      <h1 className="page__title">Tổng quan đánh giá lớp</h1>
      <div className="card">
        {openClass ? (
          <ClassDetail classId={openClass} period={period} date={date} schoolYear={schoolYear} onBack={() => setOpenClass('')} />
        ) : (
          <>
            <div className="filter-bar dg-ov-toolbar">
              <Tabs items={PERIODS} value={period} onChange={filter(setPeriod)} ariaLabel="Kỳ tổng hợp" />
              <div className="field">
                <DateInput
                  className={dateError ? 'input--error' : ''}
                  aria-label="Ngày xem"
                  aria-invalid={!!dateError}
                  aria-describedby={dateError ? 'ov-date-error' : undefined}
                  value={dateInput}
                  max={today}
                  onChange={changeDate}
                />
                {dateError && (
                  <p className="field__error" id="ov-date-error">
                    {dateError}
                  </p>
                )}
              </div>
              {multiCampus && (
                <CampusFilter
                  campuses={campusOptions}
                  value={campusId}
                  onChange={(v) => {
                    filter(setCampusId)(v);
                    setClassId('');
                  }}
                  hideLabel
                />
              )}
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
                    {own.size && !own.has(String(c.id)) ? ' (chỉ xem)' : ''}
                  </option>
                ))}
              </select>
              {overview && multiDay && <span className="text-sm text-2">{rangeText(overview)}</span>}
            </div>

            {error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : (
              <div className="table-wrap">
                <table className="table table--grid dg-ov-table">
                  <thead>
                    <tr>
                      <th>Lớp</th>
                      {multiCampus && <th>Điểm trường</th>}
                      <th className="num">Đã đánh giá</th>
                      <th>{multiDay ? 'Nhận xét chung mới nhất' : 'Nhận xét chung hôm nay'}</th>
                      <th className="num">Cập nhật</th>
                      <th className="cell--actions">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading || !overview ? (
                      <SkeletonRows rows={5} cols={multiCampus ? 6 : 5} />
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={multiCampus ? 6 : 5}>
                          <EmptyState title="Không có lớp phù hợp" />
                        </td>
                      </tr>
                    ) : (
                      paginate(rows, page, PAGE_SIZE).map((r) => {
                        const latest = latestComment(r.classComments);
                        return (
                          <tr key={r.classId} className="row-click" {...clickableRowProps(() => setOpenClass(r.classId))}>
                            <td>
                              <strong>{r.className}</strong>
                              {/* Lớp có trẻ mà chưa ai có mặt: thường là chưa điểm danh, không phải "đủ 0/0" */}
                              {!multiDay && r.size > 0 && r.present === 0 && <span className="chip chip--red">Chưa điểm danh</span>}
                              {r.reopenedDays > 0 && (
                                <span className="chip chip--blue">Đã mở lại {multiDay ? `${r.reopenedDays} ngày` : ''}</span>
                              )}
                            </td>
                            {multiCampus && <td>{campusName(r.campusId)}</td>}
                            <td className={`num ${missing(r) ? 'text-danger' : ''}`}>
                              {r.assessed}/{r.present}
                            </td>
                            <td className="dg-ov-comment-cell">
                              {latest ? (
                                <span className="dg-ov-comment-text">{latest.text}</span>
                              ) : (
                                <span className="dg-ov-empty">Chưa có nhận xét</span>
                              )}
                            </td>
                            <td className="num">{timeOf(latest?.updatedAt, multiDay)}</td>
                            <td className="cell--actions">
                              {canUnlock(r.campusId) && !multiDay && r.lockedDays > 0 && r.reopenedDays === 0 && (
                                <Link
                                  className="btn btn--sm"
                                  to={`/assessment/day-unlocks?classId=${r.classId}&date=${date}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Unlock size={14} /> Mở lại ngày
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })
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
