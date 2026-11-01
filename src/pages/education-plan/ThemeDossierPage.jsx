import { Fragment, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FileDown, Plus, Save } from '@/components/ui/icons';
import { Card, EduStatusBadge, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { RejectedNotice, ReviewActions, ReviewHistory } from '@/components/education-plan/reviewUi';
import { docReview, useClassPlanContext } from '@/components/education-plan/planUi';
import { ThemePlanBody, themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { DayTab, WeekTab } from '@/components/education-plan/WeekPlanBody';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { mtList, numberGoals } from '@/models/education-plan/goalTable';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import {
  WEEKDAY_LABELS,
  dayGoalsOf,
  ddmm,
  dossierWeekDocs,
  dueState,
  emptyThemePlan,
  emptyWeekPlan,
  isEditableStatus,
  lessonReuseFor,
  placedInOtherWeeks,
  themeCoverage,
  submitBlocker,
  themeActivities,
  themeGoalBlocks,
  themeNumber,
  todayIso,
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { leaderNameOf, themeFile } from '@/utils/education-plan/classPlanDoc';
import { SupersededNote } from '@/components/education-plan/VersionWidgets';
import { useDocVersion } from '@/hooks/education-plan/useDocVersion';
import { danglingRows, unresolvedFlags, versionFlags } from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';

const anchor = (key) => `dossier-${key}`;
// Cuộn tới phần cần xem, chừa chỗ cho thanh nhảy nhanh đang dính đầu trang
const scrollToPart = (key, behavior = 'smooth') => {
  const el = document.getElementById(anchor(key));
  if (!el) return;
  // Chiều cao thanh tab khi đã dính (vị trí dính + chiều cao), không phụ thuộc trang đang cuộn tới đâu
  const bar = document.querySelector('.ga-sticky-head');
  const stuck = bar ? (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight : 0;
  el.style.scrollMarginTop = `${Math.ceil(stuck) + 8}px`;
  el.scrollIntoView({ behavior, block: 'start' });
};

/**
 * Hồ sơ chủ đề theo file MN Thái Dương, hiện liền một tập như file Word: kế hoạch giáo dục chủ đề → từng chủ đề nhánh
 * (kế hoạch tuần + 5 kế hoạch ngày). Thanh nhảy nhanh tới chủ đề / tuần / ngày; giáo viên sửa ngay trong tập, bấm Lưu hoặc Ctrl+S.
 * Gửi một lần; Tổ trưởng rồi Phó HT duyệt hoặc trả lại cả hồ sơ ở cuối trang; đã duyệt thì in ra ký tay.
 */
export default function ThemeDossierPage() {
  const { classId, themeId } = useParams();
  return <DossierInner key={`${classId}/${themeId}`} classId={classId} themeId={themeId} />;
}

function DossierInner({ classId, themeId }) {
  const [params] = useSearchParams();
  const { user, classThemePlans, branchPlans, weekPlans, saveClassDoc, actOnClassDoc, toast, eduConfig, staff } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, isClassTeacher } = ctx;
  // Bản đang sửa trong tập: key 'theme' hoặc ngày đầu tuần → tài liệu; chỉ giữ phần chưa lưu xong
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const latest = useRef({});

  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  const themeDoc = classThemePlans.find((t) => t.classId === classId && t.themeId === themeId) || null;
  const version = useDocVersion('theme', themeDoc, ctx, classThemePlans, { themeId });
  const blocks = yearPlan && theme ? themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId) : [];
  const goals = blocks.flatMap((b) => b.goals);

  // Lưu các phần vừa sửa khi bấm Lưu / Ctrl+S (một lần cho mỗi tài liệu đã đổi); trả true khi lưu hết
  latest.current = { edits, goals, yearPlan };
  const flush = async () => {
    const { edits: pending, goals: gs, yearPlan: plan } = latest.current;
    const keys = Object.keys(pending);
    if (!keys.length) return true;
    setSaving(true);
    let ok = true;
    for (const key of keys) {
      const doc = pending[key];
      const res =
        key === 'theme'
          ? await saveClassDoc('theme', {
              ...doc,
              rows: { ...danglingRows(doc, plan), ...Object.fromEntries(gs.map((g) => [g.id, themeRowOf(doc, g)])) },
            })
          : await saveClassDoc('week', { ...doc, dayGoals: dayGoalsOf(doc) });
      // Bỏ bản sửa khi đã lưu và không bị sửa thêm trong lúc lưu
      if (res) setEdits((e) => (e[key] === doc ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
      else ok = false;
    }
    setSaving(false);
    return ok;
  };
  const hasEdits = Object.keys(edits).length > 0;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flush();
      }
    };
    const warn = (e) => {
      if (Object.keys(latest.current.edits).length) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', warn);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', warn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const guard = useLeaveGuard({ when: hasEdits, onSave: flush });

  // Mở bằng ?week=… thì nhảy tới tuần đó
  useEffect(() => {
    const week = params.get('week');
    if (week && !ctx.loading) requestAnimationFrame(() => scrollToPart(week, 'auto'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.loading]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !theme) return <StatusPage kind="404" title="Không tìm thấy chủ đề trong kế hoạch năm đã ban hành của lớp" />;

  const base = `/education/class/${classId}`;
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const themeNo = themeNumber(yearPlan, themeId);
  const weeks = dossierWeekDocs(themeDoc || { classId, yearPlanId: yearPlan.id, themeId }, yearPlan, weekPlans).map((x, i) => ({
    ...x,
    doc: edits[x.week.start] || x.doc,
    branchNo: i + 1,
    branchName: branch?.names?.[x.week.start] || '',
  }));
  const themeDraft = edits.theme || themeDoc;
  const status = themeDoc?.status || EDU_STATUS.DRAFT;
  // Cả hồ sơ cùng một trạng thái: còn nháp / bị trả lại thì giáo viên sửa thẳng trong tập
  const editable = isClassTeacher && !ctx.superseded && isEditableStatus(status);
  const sent = status !== EDU_STATUS.DRAFT;
  const activities = themeActivities(blocks, (g) => themeRowOf(themeDraft, g));
  const used = new Set(
    weeks.flatMap((w) =>
      Object.values(w.doc?.picks || {})
        .flat()
        .map((p) => p.id),
    ),
  );
  const unused = activities.filter((a) => !used.has(a.id));
  const coverage = themeCoverage(
    goals,
    activities,
    weeks.map((w) => w.doc),
  );
  // Tuần liền trước trong năm (tuần nhánh trước, hoặc tuần cuối chủ đề trước) để chép các dòng cả tuần
  const allWeeks = yearWeeks(yearPlan).filter((x) => x.type === 'week');
  const prevDocOf = (start) => {
    const prev = allWeeks[allWeeks.findIndex((x) => x.start === start) - 1];
    if (!prev) return null;
    return (
      weeks.find((w) => w.week.start === prev.start)?.doc ||
      weekPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === prev.start) ||
      null
    );
  };
  const exportArgs = {
    themeDoc: themeDraft,
    theme,
    themeNo,
    cls,
    weeks: weeks.map((w) => w.week),
    blocks,
    rowOf: (g) => themeRowOf(themeDraft, g),
    weekDocs: weeks.filter((w) => w.doc),
  };
  const due = !sent ? dueState(themeDoc, theme.start) : null;

  const edit = (key, current) => (fn) => setEdits((e) => ({ ...e, [key]: fn(structuredClone(e[key] || current)) }));
  const themeEdit = edit('theme', themeDraft);
  const setRow = (g, field, value) => themeEdit((d) => ({ ...d, rows: { ...d.rows, [g.id]: { ...themeRowOf(d, g), [field]: value } } }));
  const setField = (field, value) => themeEdit((d) => ({ ...d, [field]: value }));
  const createTheme = () => saveClassDoc('theme', emptyThemePlan({ classId, yearPlanId: yearPlan.id, themeId }));
  const createWeek = (w) =>
    saveClassDoc(
      'week',
      emptyWeekPlan({ classId, yearPlanId: yearPlan.id, weekStart: w.start, weekNo: w.no, themeId, versionNo: yearPlan.versionNo }),
    );
  const unsaved = saving || Object.keys(edits).length > 0;
  const themeTitle = (
    <>
      <span className="chip chip--blue">CĐ {themeNo}</span>
      {'Mục tiêu, nội dung, hoạt động và môi trường giáo dục'}
    </>
  );
  // Gửi / duyệt cả hồ sơ (kế hoạch chủ đề + giáo án tuần, ngày) theo mẫu chung; chưa đủ điều kiện thì chỉ nhắc
  const review = docReview('theme', themeDoc, ctx, user, eduConfig);
  const checkBeforeOpen = (action) => {
    if (action !== 'submit') return true;
    const block = submitBlocker('theme', themeDoc, { branchPlans, weekPlans, classThemePlans, yearPlan });
    if (block) toast(block, 'warn');
    if (block) return false;
    // BE:EDU-26 — bản chép còn ô đỏ (kế hoạch chủ đề và các tuần) thì chưa gửi; BE cũng kiểm lại
    const today = todayIso();
    const red =
      version.unresolved.length +
      weeks
        .filter((w) => w.doc?.sourceDocKey && version.changes)
        .reduce((n, w) => n + unresolvedFlags(versionFlags('week', w.doc, version.changes, yearPlan, today), w.doc).length, 0);
    if (red) toast(`Còn ${red} mục đổi theo kế hoạch năm mới chưa sửa (ô đỏ). Sửa ở kế hoạch chủ đề / giáo án tuần rồi gửi.`, 'warn');
    return !red;
  };
  const act = (action, note) => actOnClassDoc('theme', themeDoc.id, { action, note });
  const parts = [
    { key: 'theme', label: 'I, II. Mục tiêu, môi trường' },
    ...weeks.map((w) => ({ key: w.week.start, label: `Tuần ${w.week.no} · Nhánh ${w.branchNo}` })),
  ];

  return (
    <div className="page ga-page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: `Kế hoạch ${cls.name}`, to: base }, { label: `Chủ đề ${themeNo}` }]}
        title={`Kế hoạch giáo dục chủ đề ${themeNo}: ${theme.name}`}
        desc={<EduStatusBadge status={status} size="lg" />}
        actions={
          <>
            {editable && (
              <>
                <span className="muted text-sm">{saving ? 'Đang lưu…' : hasEdits ? 'Có thay đổi chưa lưu' : ''}</span>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={flush}
                  disabled={saving || !hasEdits}
                  title="Lưu (Ctrl+S)"
                >
                  <Save size={16} aria-hidden /> Lưu
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setPreview(themeFile({ ...exportArgs, leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear) }))
              }
            >
              <FileDown size={16} aria-hidden /> Xuất
            </button>
            {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
            <ReviewActions
              name="kế hoạch chủ đề"
              sendTo={review.sendTo}
              can={review.can}
              sendBlocked={unsaved ? 'Lưu trước khi gửi' : null}
              beforeOpen={checkBeforeOpen}
              notes={{
                submit: `Gửi cả kế hoạch chủ đề và giáo án ${weeks.length} tuần nhánh. Hồ sơ bị khóa cho tới khi được duyệt hoặc bị trả lại.`,
                approve: 'Duyệt cả kế hoạch chủ đề và giáo án các tuần nhánh.',
                reject: 'Trả lại cả hồ sơ để giáo viên sửa rồi gửi lại.',
              }}
              onAct={act}
            />
          </>
        }
      />
      <SupersededNote doc={themeDoc} />
      {status === EDU_STATUS.REJECTED && <RejectedNotice status={status} history={themeDoc?.history} />}

      {/* Tab dính đầu trang: tách riêng để khi cuộn chỉ thanh tab vẽ lại, không vẽ lại cả tập */}
      <DossierNav parts={parts} />

      {!sent && (
        <Notice tone={due === 'late' ? 'err' : due === 'soon' ? 'warn' : undefined}>
          Hạn gửi hồ sơ: trước {fmtDate(theme.start)}
          {due === 'late' ? ' (quá hạn)' : due === 'soon' ? ' (sắp đến hạn)' : ''}.
        </Notice>
      )}
      {coverage.missingGoals.length > 0 && (
        <Notice tone="warn">
          {mtList(coverage.missingGoals.map((g) => g.no))} chưa có trong tuần nào của chủ đề (đã phủ {coverage.covered}/{coverage.goals}{' '}
          MT). Vẫn gửi duyệt được.
        </Notice>
      )}
      {unused.length > 0 && (
        <Notice tone="warn">
          Còn {unused.length} hoạt động trong kế hoạch chủ đề chưa xếp vào tuần nào.
          <details>
            <summary className="text-sm">Xem danh sách</summary>
            <ul>
              {unused.map((a) => (
                <li key={a.id} className="text-sm">
                  MT{a.goalNo}: {a.text}
                </li>
              ))}
            </ul>
          </details>
        </Notice>
      )}

      {/* Mốc cuộn đặt ngay trước thẻ để các thẻ vẫn giữ khoảng cách chung của trang */}
      <div id={anchor('theme')} />
      {themeDraft ? (
        <>
          {/* Nhãn theo cấp: chủ đề xanh dương, tuần xanh lá, ngày xám */}
          <Card title={themeTitle} bodyClass={null} className="ga-card--heading" />
          <ThemePlanBody yearPlan={yearPlan} themeId={themeId} draft={themeDraft} editable={editable} setRow={setRow} setField={setField} />
        </>
      ) : (
        <Card title={themeTitle}>
          <div className="row row--wrap gap-2">
            <span className="muted">Chưa lập kế hoạch chủ đề.</span>
            {editable && (
              <button type="button" className="btn btn--primary btn--sm" onClick={createTheme}>
                <Plus size={16} aria-hidden /> Lập kế hoạch chủ đề
              </button>
            )}
          </div>
        </Card>
      )}

      {weeks.map((w) => (
        <Fragment key={w.week.start}>
          <div id={anchor(w.week.start)} />
          <Card
            title={
              <>
                <span className="chip chip--teal">Tuần {w.week.no}</span>
                {`Chủ đề nhánh ${w.branchNo}: ${w.branchName || '…'} (${ddmm(w.week.start)} → ${ddmm(w.week.end)})`}
              </>
            }
            bodyClass={null}
          >
            <div className="card__body stack">
              {w.doc ? (
                <>
                  <div className="section-title">KẾ HOẠCH TUẦN</div>
                  <WeekTab
                    draft={w.doc}
                    week={w.week}
                    editable={editable}
                    update={edit(w.week.start, w.doc)}
                    activities={activities}
                    placedElsewhere={placedInOtherWeeks(
                      weeks.map((x) => x.doc),
                      w.week.start,
                    )}
                    prevWeek={prevDocOf(w.week.start)}
                    coverage={coverage}
                    goals={goals}
                  />
                  <div className="section-title">KẾ HOẠCH NGÀY</div>
                  {w.doc.days.map((d, i) => (
                    <div key={d.date} id={anchor(`${w.week.start}-d${i}`)} className="ga-dossier-day">
                      {/* Nhãn ngày (xám); tiêu đề "Thứ …, ngày …" đã có sẵn trong kế hoạch ngày */}
                      <span className="chip chip--gray">
                        Tuần {w.week.no} · {WEEKDAY_LABELS[i]}
                        {w.week.offDays?.[i] ? ' · Nghỉ' : ''}
                      </span>
                      <DayTab
                        draft={w.doc}
                        index={i}
                        editable={editable}
                        update={edit(w.week.start, w.doc)}
                        goals={goals}
                        reuse={lessonReuseFor(weekPlans, w.doc, i)}
                        offLabel={w.week.offDays?.[i] || null}
                        assessTo={
                          w.doc.status === EDU_STATUS.APPROVED ? `/assessment/daily/skills?classId=${classId}&date=${d.date}` : null
                        }
                      />
                    </div>
                  ))}
                </>
              ) : (
                <div className="row row--wrap gap-2">
                  <span className="muted">Chưa soạn giáo án tuần này.</span>
                  {editable && themeDoc && (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => createWeek(w.week)}>
                      <Plus size={16} aria-hidden /> Soạn giáo án tuần {w.week.no}
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </Fragment>
      ))}

      {themeDoc && <ReviewHistory items={themeDoc.history} />}
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}

/**
 * Thanh tab dính đầu trang của kế hoạch chủ đề: bấm tab thì cuộn tới phần đó; cuộn trang thì tab đổi theo
 * mốc cuối cùng đã cuộn qua thanh tab. Chỉ thanh tab vẽ lại khi cuộn, phần nội dung dài không bị vẽ lại.
 */
function DossierNav({ parts }) {
  const [active, setActive] = useState('theme');
  useEffect(() => {
    let timer = 0;
    const measure = () => {
      timer = 0;
      const bar = document.querySelector('.ga-sticky-head')?.getBoundingClientRect().bottom || 0;
      let current = null;
      document.querySelectorAll('[id^="dossier-"]').forEach((m) => {
        if (!current || m.getBoundingClientRect().top <= bar + 24) current = m.id;
      });
      if (current) setActive(current.replace('dossier-', ''));
    };
    // Gom các lần cuộn: đo lại tối đa mỗi 100 ms
    const onScroll = () => {
      if (!timer) timer = setTimeout(measure, 100);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(timer);
    };
  }, []);
  // Mốc ngày có dạng '<ngày đầu tuần>-d<i>': tab sáng theo tuần chứa ngày đó
  const [activeTab] = active.split('-d');
  return (
    <div className="ga-sticky-head">
      <Card bodyClass={null}>
        <div className="tabs" role="tablist">
          {parts.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={activeTab === p.key}
              className={`tab ${activeTab === p.key ? 'tab--active' : ''}`}
              onClick={() => {
                setActive(p.key);
                scrollToPart(p.key);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
