import { Fragment, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, FileDown, Plus, Printer, Send, Undo2 } from '@/components/ui/icons';
import { Card, EduStatusBadge, Field, Modal, Notice, PageHead, fmtDate, fmtDateTime } from '@/components/education-plan/eduUi';
import { isMyReviewTurn, useClassPlanContext } from '@/components/education-plan/planUi';
import { ThemePlanBody, themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { DayTab, WeekTab } from '@/components/education-plan/WeekPlanBody';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { numberGoals } from '@/models/education-plan/goalTable';
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
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { exportThemeFile } from '@/utils/education-plan/classPlanDoc';

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';
const AUTOSAVE_MS = 1200;
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
 * (kế hoạch tuần + 5 kế hoạch ngày). Thanh nhảy nhanh tới chủ đề / tuần / ngày; giáo viên sửa ngay trong tập (tự lưu).
 * Gửi một lần; Tổ trưởng rồi Phó HT duyệt hoặc trả lại cả hồ sơ ở cuối trang; đã duyệt thì in ra ký tay.
 */
export default function ThemeDossierPage() {
  const { classId, themeId } = useParams();
  return <DossierInner key={`${classId}/${themeId}`} classId={classId} themeId={themeId} />;
}

function DossierInner({ classId, themeId }) {
  const [params] = useSearchParams();
  const { user, classThemePlans, branchPlans, weekPlans, saveClassDoc, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, isClassTeacher } = ctx;
  // Bản đang sửa trong tập: key 'theme' hoặc ngày đầu tuần → tài liệu; chỉ giữ phần chưa lưu xong
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const latest = useRef({});

  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  const themeDoc = classThemePlans.find((t) => t.classId === classId && t.themeId === themeId) || null;
  const blocks = yearPlan && theme ? themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId) : [];
  const goals = blocks.flatMap((b) => b.goals);

  // Tự lưu các phần vừa sửa sau khi ngừng gõ (một lần cho mỗi tài liệu đã đổi)
  latest.current = { edits, goals };
  const flush = async () => {
    const { edits: pending, goals: gs } = latest.current;
    const keys = Object.keys(pending);
    if (!keys.length) return;
    setSaving(true);
    for (const key of keys) {
      const doc = pending[key];
      const res =
        key === 'theme'
          ? await saveClassDoc('theme', { ...doc, rows: Object.fromEntries(gs.map((g) => [g.id, themeRowOf(doc, g)])) })
          : await saveClassDoc('week', { ...doc, dayGoals: dayGoalsOf(doc) });
      // Bỏ bản sửa khi đã lưu và không bị sửa thêm trong lúc lưu
      if (res) setEdits((e) => (e[key] === doc ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
    }
    setSaving(false);
  };
  useEffect(() => {
    if (!Object.keys(edits).length) return undefined;
    const t = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits]);

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
  const editable = isClassTeacher && isEditableStatus(status);
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
      weekPlans.find((x) => x.classId === classId && x.weekStart === prev.start) ||
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
    saveClassDoc('week', emptyWeekPlan({ classId, yearPlanId: yearPlan.id, weekStart: w.start, weekNo: w.no, themeId }));
  const unsaved = saving || Object.keys(edits).length > 0;
  const themeTitle = (
    <>
      <span className="chip chip--blue">CĐ {themeNo}</span>
      {'Mục tiêu, nội dung, hoạt động và môi trường giáo dục'}
    </>
  );
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
            {editable && <span className="muted text-sm">{unsaved ? 'Đang lưu…' : 'Tự lưu khi bạn sửa'}</span>}
            <button type="button" className="btn btn--ghost" onClick={() => exportThemeFile(exportArgs, 'doc')}>
              <FileDown size={16} aria-hidden /> Xuất Word
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => exportThemeFile(exportArgs, 'print') || toast(POPUP_BLOCKED, 'warn')}
            >
              <Printer size={16} aria-hidden /> In / Lưu PDF
            </button>
          </>
        }
      />

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
          {coverage.missingGoals.map((g) => `MT ${g.no}`).join(', ')} chưa có trong tuần nào của chủ đề (đã phủ {coverage.covered}/
          {coverage.goals} MT). Vẫn gửi duyệt được.
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
                  MT {a.goalNo}: {a.text}
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
                      </span>
                      <DayTab
                        draft={w.doc}
                        index={i}
                        editable={editable}
                        update={edit(w.week.start, w.doc)}
                        goals={goals}
                        reuse={lessonReuseFor(weekPlans, w.doc, i)}
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

      {/* Dải nút dính đáy màn: giáo viên gửi duyệt; người đến lượt duyệt thì Trả lại / Duyệt */}
      {themeDoc && <DossierActions doc={themeDoc} ctx={ctx} user={user} dirty={unsaved} />}
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

/**
 * Dải nút cuối trang kế hoạch chủ đề (dính đáy màn hình): chỉ còn nút cần bấm. Giáo viên "Gửi duyệt kế hoạch chủ đề";
 * Tổ trưởng / Phó HT đến lượt thì "Trả lại" (hỏi lý do) hoặc "Duyệt". Chưa đủ điều kiện gửi thì nhắc ở góc màn hình.
 */
function DossierActions({ doc, ctx, user, dirty }) {
  const { branchPlans, weekPlans, classThemePlans, actOnClassDoc, toast } = useEducationPlan();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = doc.status === EDU_STATUS.DRAFT || doc.status === EDU_STATUS.REJECTED;
  const canSend = ctx.isClassTeacher && open;
  const canReview = isMyReviewTurn(doc, ctx, user);
  const lastReject = [...(doc.history || [])].reverse().find((h) => h.tone === 'err');
  const run = async (action, body = {}) => {
    setBusy(true);
    const res = await actOnClassDoc('theme', doc.id, { action, ...body });
    setBusy(false);
    return res;
  };
  const send = () => {
    const block = submitBlocker('theme', doc, { branchPlans, weekPlans, classThemePlans, yearPlan: ctx.yearPlan });
    if (block) return toast(block, 'warn');
    return run('submit');
  };
  const reject = async () => {
    setTried(true);
    if (!note.trim()) return;
    if (await run('reject', { note: note.trim() })) {
      setRejecting(false);
      setNote('');
      setTried(false);
    }
  };
  return (
    <>
      {doc.status === EDU_STATUS.REJECTED && lastReject?.note && (
        <Notice tone="err">
          Bị trả lại bởi {lastReject.by} ({fmtDateTime(lastReject.at)}): {lastReject.note}
        </Notice>
      )}
      {(canSend || canReview) && (
        <div className="page-actions">
          <span />
          <div className="row gap-2">
            {canSend && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || dirty}
                title={dirty ? 'Chờ lưu xong rồi gửi' : undefined}
                onClick={send}
              >
                <Send size={16} aria-hidden /> Gửi duyệt kế hoạch chủ đề
              </button>
            )}
            {canReview && (
              <>
                <button type="button" className="btn btn--outline-danger" disabled={busy} onClick={() => setRejecting(true)}>
                  <Undo2 size={16} aria-hidden /> Trả lại
                </button>
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => run('approve')}>
                  <Check size={16} aria-hidden /> Duyệt
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {rejecting && (
        <Modal
          title="Trả lại kế hoạch chủ đề"
          onClose={() => setRejecting(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setRejecting(false)}>
                Hủy
              </button>
              <button type="button" className="btn btn--outline-danger" disabled={busy} onClick={reject}>
                <Undo2 size={16} aria-hidden /> Trả lại
              </button>
            </>
          }
        >
          <Field label="Lý do trả lại" required error={tried && !note.trim() ? 'Vui lòng ghi lý do trả lại' : undefined}>
            <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Modal>
      )}
    </>
  );
}
