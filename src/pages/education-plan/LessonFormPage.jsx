import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  ListPlus,
  Plus,
  Save,
  Send,
  Trash2,
  Wand2,
} from '@/components/ui/icons';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import {
  CLASSES,
  COMPETENCIES,
  EDU_STATUS,
  QUALITIES,
  STEP_TEMPLATE,
  slotsFor,
  themeCodes,
} from '@/models/education-plan/educationPlanConstants';
import { Card, EmptyState, Field, Modal, Notice, PageHead, SignatureBox, Stepper, fmtDate } from '@/components/education-plan/eduUi';
import { CodePicker, Group, useCollapse } from '@/components/education-plan/PlanWidgets';
import { DayTable, LessonInfo, WeekMatrix, daysOf, typeLabel, weekdayLabel, weeksOf } from '@/components/education-plan/lessonShared';
import ImportLessonModal from '@/components/education-plan/ImportLessonModal';
import {
  CORE_SLOT,
  contentFromCodes,
  daySlotsFor,
  emptyDaySlot,
  fromWeekPlan,
  purposeFromCodes,
} from '@/utils/education-plan/lessonDrafts';

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyWeekSlot = (name = '', allWeek = false) => ({ id: uid(), name, allWeek, cells: {}, all: { text: '', codes: [] } });
const isEmptyText = (s) => !s || !s.trim();

export default function LessonFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { lessons, themes, user, schoolYear, saveLesson, toast, historyEntry } = useEducationPlan();
  const navigate = useNavigate();
  const existing = lessons.find((l) => l.id === id);
  const cls = CLASSES.find((c) => c.id === user.classId);

  const approvedThemes = themes
    .filter((t) => t.ageGroupId === user.ageGroupId && t.schoolYear === schoolYear && t.status === EDU_STATUS.APPROVED)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const [form, setForm] = useState(() => {
    if (existing) return { ...existing, signature: null };
    const themeId = approvedThemes.find((t) => t.id === params.get('chu-de'))?.id || approvedThemes.at(-1)?.id || '';
    return {
      type: params.get('loai') === 'ngay' ? 'day' : 'week',
      themeId,
      weekIndex: '',
      weekStart: '',
      weekEnd: '',
      branch: '',
      date: '',
      slots: [],
      dayNotes: {},
      weekReview: '',
      dayReview: '',
      adjust: '',
      signature: null,
    };
  });
  const [step, setStep] = useState(() => (existing && params.get('buoc') === 'ky' ? 2 : 0));
  const [maxReached, setMaxReached] = useState(existing ? 2 : 0);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removeSlot, setRemoveSlot] = useState(null);
  const [justAdded, setJustAdded] = useState(null);
  const listRef = useRef(null);
  const col = useCollapse();

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  useEffect(() => {
    if (!justAdded || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-group="${justAdded}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector('input')?.focus({ preventScroll: true });
    setJustAdded(null);
  }, [justAdded]);

  if (!approvedThemes.length && !existing)
    return (
      <div className="page">
        <PageHead crumbs={[{ label: 'Giáo án của lớp', to: '/education/lessons' }, { label: 'Lập giáo án' }]} title="Lập giáo án" />
        <Card>
          <EmptyState
            title="Chưa có kế hoạch chủ đề được duyệt"
            desc="Kế hoạch tuần và kế hoạch ngày phải gắn với một kế hoạch chủ đề đã được Phó hiệu trưởng duyệt."
            action={
              <Link className="btn" to="/education/lessons">
                Về danh sách
              </Link>
            }
          />
        </Card>
      </div>
    );

  const isWeek = form.type === 'week';
  const STEPS = ['Thông tin chung', isWeek ? 'Lịch hoạt động tuần' : 'Nội dung theo thời điểm', 'Xác nhận và ký'];
  const theme = themes.find((t) => t.id === form.themeId);
  const codeOptions = themeCodes(theme);
  const weeks = weeksOf(theme);
  const days = form.weekStart ? daysOf(form.weekStart) : [];
  // The class's weekly plan for the same week, so the daily plan can reuse its content.
  const weekPlan =
    !isWeek && form.weekStart
      ? lessons.find(
          (l) => l.type === 'week' && l.classId === user.classId && l.weekStart === form.weekStart && l.status !== EDU_STATUS.REJECTED,
        )
      : null;

  const pickWeek = (start) => {
    const w = weeks.find((x) => x.start === start);
    set({ weekStart: start, weekEnd: w?.end || '', weekIndex: w?.index || '', branch: w?.name || '', date: '' });
  };

  const initSlots = () => {
    if (form.slots.length) return form.slots;
    const base = slotsFor(user.ageGroupId);
    if (isWeek) return base.map((s) => emptyWeekSlot(s.name, !!s.allWeek));
    let slots = daySlotsFor(user.ageGroupId);
    if (weekPlan) slots = fromWeekPlan(slots, weekPlan, form.date, theme);
    return slots;
  };

  const filledWeek = form.slots.some((s) =>
    s.allWeek ? !isEmptyText(s.all?.text) : Object.values(s.cells || {}).some((c) => !isEmptyText(c.text)),
  );
  const filledDay = form.slots.some((s) => !isEmptyText(s.topic));

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.themeId) e.themeId = 'Chọn kế hoạch chủ đề';
      if (!form.weekStart) e.weekStart = 'Chọn tuần';
      if (!isWeek && !form.date) e.date = 'Chọn ngày';
      const dup = lessons.find(
        (l) =>
          l.id !== form.id &&
          l.classId === user.classId &&
          l.type === form.type &&
          l.status !== EDU_STATUS.REJECTED &&
          (isWeek ? l.weekStart === form.weekStart : l.date === form.date),
      );
      if (!e.weekStart && !e.date && dup)
        e[isWeek ? 'weekStart' : 'date'] = `Lớp đã có ${typeLabel(form.type).toLowerCase()} cho thời gian này (${dup.code})`;
    }
    if (s === 1) {
      if (!form.slots.length) e.slots = 'Thêm ít nhất một giờ sinh hoạt';
      else if (isWeek && !filledWeek) e.slots = 'Nhập nội dung cho ít nhất một ô trong tuần';
      else if (!isWeek && !filledDay) e.slots = 'Nhập đề tài cho ít nhất một thời điểm';
      else if (form.slots.some((x) => isEmptyText(x.name))) e.slots = 'Có giờ sinh hoạt chưa đặt tên';
    }
    if (s === 2 && !form.signature) e.signature = 'Ký xác nhận trước khi gửi tổ trưởng';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    const n = step + 1;
    if (n === 1 && !form.slots.length) {
      const slots = initSlots();
      set({ slots });
      if (!isWeek && weekPlan) toast(`Đã lấy đề tài và mã YCCĐ từ kế hoạch tuần ${weekPlan.code}`);
    }
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
  };

  const build = (status) => {
    const prefix = isWeek ? 'KHT' : 'KHN';
    const mmdd = (isWeek ? form.weekStart : form.date).slice(5).replace('-', '');
    return {
      ...form,
      id: form.id || `l-${uid()}`,
      code: form.code || `${prefix}-${user.classId.replace('c-', '').toUpperCase()}-${mmdd}`,
      classId: user.classId,
      ageGroupId: user.ageGroupId,
      date: isWeek ? null : form.date,
      branch: form.branch.trim(),
      status,
      createdBy: user.name,
      history: form.history || [],
    };
  };

  const saveDraft = () => {
    if (!form.themeId || !form.weekStart || (!isWeek && !form.date)) {
      setStep(0);
      validate(0);
      return;
    }
    const item = build(existing?.status === EDU_STATUS.REJECTED ? EDU_STATUS.REJECTED : EDU_STATUS.DRAFT);
    if (!item.slots.length) item.slots = initSlots();
    saveLesson(item);
    toast('Đã lưu nháp giáo án');
    navigate(`/education/lessons/${item.id}`);
  };

  const submit = () => {
    const item = build(EDU_STATUS.PENDING_TL);
    item.history = [
      ...item.history,
      historyEntry(existing?.status === EDU_STATUS.REJECTED ? 'Chỉnh sửa và gửi lại tổ trưởng' : 'Gửi tổ trưởng', {
        role: ROLE_LABELS[ROLES.TEACHER],
      }),
    ];
    saveLesson(item);
    setConfirm(false);
    toast('Đã gửi giáo án cho tổ trưởng xem xét');
    navigate(`/education/lessons/${item.id}`);
  };

  /* ---- slot operations ---- */
  const updateSlot = (sid, patch) => set({ slots: form.slots.map((s) => (s.id === sid ? { ...s, ...patch } : s)) });
  const updateCell = (s, date, patch) =>
    updateSlot(s.id, { cells: { ...s.cells, [date]: { text: '', codes: [], ...s.cells?.[date], ...patch } } });
  // Ô tuần còn trống thì gợi ý hoạt động từ "Nội dung giáo dục" của chủ đề theo mã vừa chọn.
  const withSuggestion = (cell, codes) => {
    const text = cell?.text || '';
    return { ...cell, codes, text: isEmptyText(text) ? contentFromCodes(codes, theme) : text };
  };
  const addSlot = () => {
    const ns = isWeek ? emptyWeekSlot('') : emptyDaySlot('');
    set({ slots: [...form.slots, ns] });
    setJustAdded(ns.id);
  };
  const deleteSlot = (sid) => {
    set({ slots: form.slots.filter((s) => s.id !== sid) });
    setRemoveSlot(null);
  };
  const slotHasContent = (s) =>
    isWeek
      ? !isEmptyText(s.all?.text) || Object.values(s.cells || {}).some((c) => !isEmptyText(c.text))
      : !isEmptyText(s.topic) || !isEmptyText(s.purpose) || s.steps.some((x) => !isEmptyText(x.teacher));

  const importFrom = (src) => {
    const slots = form.slots.map((s) => ({ ...s }));
    let changed = 0;
    if (isWeek) {
      const srcDays = daysOf(src.weekStart).map((d) => d.date);
      src.slots.forEach((ss) => {
        let t = slots.find((x) => x.name.trim().toLowerCase() === ss.name.trim().toLowerCase());
        if (!t) {
          t = emptyWeekSlot(ss.name, ss.allWeek);
          slots.push(t);
        }
        if (ss.allWeek) {
          if (isEmptyText(t.all?.text) && !isEmptyText(ss.all?.text)) {
            t.allWeek = true;
            t.all = { ...ss.all };
            changed++;
          }
        } else {
          const cells = { ...t.cells };
          srcDays.forEach((sd, i) => {
            const c = ss.cells?.[sd];
            const td = days[i]?.date;
            if (td && c && !isEmptyText(c.text) && isEmptyText(cells[td]?.text)) {
              cells[td] = { text: c.text, codes: [...(c.codes || [])] };
              changed++;
            }
          });
          t.cells = cells;
        }
      });
    } else {
      src.slots.forEach((ss) => {
        const t = slots.find((x) => x.name.trim().toLowerCase() === ss.name.trim().toLowerCase());
        if (!t) {
          slots.push({ ...ss, id: uid(), steps: ss.steps.map((x) => ({ ...x, id: uid() })) });
          changed++;
          return;
        }
        ['topic', 'purpose', 'skills', 'prepTeacher', 'prepChild', 'duration'].forEach((k) => {
          if (isEmptyText(t[k]) && !isEmptyText(ss[k])) {
            t[k] = ss[k];
            changed++;
          }
        });
        if (!t.codes.length && ss.codes?.length) t.codes = [...ss.codes];
        if (!t.qualities.length) t.qualities = [...(ss.qualities || [])];
        if (!t.competencies.length) t.competencies = [...(ss.competencies || [])];
        if (!t.steps.some((x) => !isEmptyText(x.teacher)) && ss.steps?.length) t.steps = ss.steps.map((x) => ({ ...x, id: uid() }));
      });
    }
    set({ slots });
    setImporting(false);
    toast(changed ? `Đã lấy nội dung từ ${src.code} vào các ô còn trống` : 'Các ô đã có nội dung, không thay đổi');
  };

  const groupIds = form.slots.map((s) => s.id);
  const allCollapsed = groupIds.length > 0 && groupIds.every((g) => col.isCollapsed(g));
  const lastReject = existing?.status === EDU_STATUS.REJECTED && [...(existing.history || [])].reverse().find((h) => h.tone === 'err');
  const preview = { ...build(form.status || EDU_STATUS.DRAFT), weekIndex: form.weekIndex };

  return (
    <div className={step === 1 ? 'page ga-page-fill' : 'page'}>
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          { label: 'Giáo án của lớp', to: '/education/lessons' },
          { label: existing ? 'Chỉnh sửa' : 'Lập giáo án' },
        ]}
        title={existing ? `Chỉnh sửa ${typeLabel(form.type).toLowerCase()}` : 'Lập giáo án'}
      />
      {lastReject && step !== 1 && (
        <div className="mb-16">
          <Notice tone="err">
            <span className="fw-600">{lastReject.by} đã từ chối:</span> {lastReject.note}
          </Notice>
        </div>
      )}
      <Stepper steps={STEPS} current={step} maxReached={maxReached} onStep={(i) => i <= maxReached && setStep(i)} />

      {step === 0 && (
        <Card title="Thông tin chung" num="1">
          <div className="field mb-16">
            <span className="field__label">
              Loại kế hoạch<span className="req">*</span>
            </span>
            <div className="ga-choice-grid" role="radiogroup" aria-label="Loại kế hoạch">
              {[
                {
                  key: 'week',
                  icon: CalendarRange,
                  title: 'Kế hoạch tuần',
                  desc: 'Lịch hoạt động theo giờ sinh hoạt, từ thứ 2 đến thứ 6.',
                },
                {
                  key: 'day',
                  icon: CalendarDays,
                  title: 'Kế hoạch ngày',
                  desc: 'Giáo án chi tiết từng thời điểm: mục đích, chuẩn bị, hoạt động của cô và trẻ.',
                },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={form.type === c.key}
                  disabled={!!existing}
                  className={`ga-choice ${form.type === c.key ? 'ga-choice--selected' : ''}`}
                  onClick={() => set({ type: c.key, date: '', slots: [] })}
                >
                  <c.icon aria-hidden />
                  <span>
                    <div className="ga-choice__title">{c.title}</div>
                    <div className="ga-choice__desc">{c.desc}</div>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <Field label="Lớp" inline>
              <input className="input" value={`${cls?.name} (${cls?.room})`} readOnly />
            </Field>
            <Field label="Giáo viên" inline>
              <input className="input" value={user.name} readOnly />
            </Field>
            <Field label="Kế hoạch chủ đề" required inline error={errors.themeId} htmlFor="theme">
              <select
                id="theme"
                className={`select ${errors.themeId ? 'is-invalid' : ''}`}
                value={form.themeId}
                disabled={!!existing}
                onChange={(e) =>
                  set({ themeId: e.target.value, weekStart: '', weekEnd: '', weekIndex: '', branch: '', date: '', slots: [] })
                }
              >
                <option value="">Chọn chủ đề đã duyệt</option>
                {approvedThemes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({fmtDate(t.startDate)} – {fmtDate(t.endDate)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tuần" required inline error={errors.weekStart} htmlFor="week">
              <select
                id="week"
                className={`select ${errors.weekStart ? 'is-invalid' : ''}`}
                value={form.weekStart}
                disabled={!theme}
                onChange={(e) => pickWeek(e.target.value)}
              >
                <option value="">{theme ? 'Chọn tuần' : 'Chọn chủ đề trước'}</option>
                {weeks.map((w) => (
                  <option key={w.start} value={w.start}>
                    Tuần {w.index}: {fmtDate(w.start).slice(0, 5)} – {fmtDate(w.end).slice(0, 5)}
                    {w.name ? ` · ${w.name}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Chủ đề nhánh" inline htmlFor="branch">
              <input
                id="branch"
                className="input"
                placeholder="Lấy theo kế hoạch chủ đề"
                value={form.branch}
                onChange={(e) => set({ branch: e.target.value })}
              />
            </Field>
            {!isWeek && (
              <Field label="Ngày" required inline error={errors.date} htmlFor="date">
                <select
                  id="date"
                  className={`select ${errors.date ? 'is-invalid' : ''}`}
                  value={form.date}
                  disabled={!form.weekStart}
                  onChange={(e) => set({ date: e.target.value, slots: [] })}
                >
                  <option value="">{form.weekStart ? 'Chọn ngày' : 'Chọn tuần trước'}</option>
                  {days.map((d) => (
                    <option key={d.date} value={d.date}>
                      {d.label}, {fmtDate(d.date)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          {!isWeek && form.date && (
            <div className="mt-16">
              {weekPlan ? (
                <Notice>
                  Lớp đã có kế hoạch tuần {weekPlan.code}. Ở bước sau, đề tài và mã YCCĐ của ngày {fmtDate(form.date)} được điền sẵn từ kế
                  hoạch tuần.
                </Notice>
              ) : (
                <Notice tone="warn">Lớp chưa có kế hoạch tuần cho tuần này. Bạn vẫn lập kế hoạch ngày được, nội dung nhập tay.</Notice>
              )}
            </div>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card
          title={STEPS[1]}
          num="2"
          className="ga-card-fill"
          bodyClass={null}
          actions={
            <div className="row row--wrap">
              <span className="muted text-xs" style={{ marginRight: 8 }}>
                {form.slots.length} giờ sinh hoạt
              </span>
              {groupIds.length > 0 && (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => (allCollapsed ? col.clear() : col.setAll(groupIds))}
                >
                  {allCollapsed ? <ChevronsUpDown size={16} aria-hidden /> : <ChevronsDownUp size={16} aria-hidden />}
                  {allCollapsed ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
                </button>
              )}
              {!isWeek && weekPlan && (
                <button
                  type="button"
                  className="btn btn--sm btn--outline-primary"
                  onClick={() => {
                    set({ slots: fromWeekPlan(form.slots, weekPlan, form.date, theme) });
                    toast(`Đã điền các ô trống từ kế hoạch tuần ${weekPlan.code}`);
                  }}
                >
                  <Wand2 size={16} aria-hidden /> Lấy từ kế hoạch tuần
                </button>
              )}
              <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setImporting(true)}>
                <Download size={16} aria-hidden /> Lấy từ kế hoạch có sẵn
              </button>
              <button type="button" className="btn btn--sm btn--primary" onClick={addSlot}>
                <Plus size={16} aria-hidden /> {isWeek ? 'Thêm giờ sinh hoạt' : 'Thêm thời điểm'}
              </button>
            </div>
          }
        >
          <div className="card__body ga-card-scroll" ref={listRef}>
            {errors.slots && (
              <div className="mb-16">
                <Notice tone="err">{errors.slots}</Notice>
              </div>
            )}
            {form.slots.map((s, si) => (
              <Group
                key={s.id}
                id={s.id}
                collapsed={col.isCollapsed(s.id)}
                onToggle={() => col.toggle(s.id)}
                title={
                  <div className="row" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                    <input
                      className="input ga-domain__name"
                      aria-label={`Tên giờ sinh hoạt ${si + 1}`}
                      placeholder="Tên giờ sinh hoạt"
                      value={s.name}
                      onChange={(e) => updateSlot(s.id, { name: e.target.value })}
                    />
                    {!isWeek && (
                      <input
                        className="input ga-domain__name ga-slot-duration"
                        aria-label={`Thời lượng ${si + 1}`}
                        placeholder="Thời lượng"
                        value={s.duration}
                        onChange={(e) => updateSlot(s.id, { duration: e.target.value })}
                      />
                    )}
                  </div>
                }
                actions={
                  <>
                    {isWeek && (
                      <label className="checkbox text-xs">
                        <input type="checkbox" checked={s.allWeek} onChange={(e) => updateSlot(s.id, { allWeek: e.target.checked })} />
                        Áp dụng cả tuần
                      </label>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Xóa ${s.name || 'giờ sinh hoạt'}`}
                      onClick={() => (slotHasContent(s) ? setRemoveSlot(s) : deleteSlot(s.id))}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </>
                }
              >
                {isWeek ? (
                  s.allWeek ? (
                    <div className="ga-week-cell">
                      <textarea
                        className="textarea"
                        rows={2}
                        aria-label={`${s.name} – cả tuần`}
                        placeholder="Nội dung áp dụng cho cả tuần"
                        value={s.all?.text || ''}
                        onChange={(e) => updateSlot(s.id, { all: { ...s.all, text: e.target.value } })}
                      />
                      <CodePicker
                        options={codeOptions}
                        value={s.all?.codes || []}
                        onChange={(codes) => updateSlot(s.id, { all: withSuggestion(s.all, codes) })}
                      />
                    </div>
                  ) : (
                    <div className="ga-week-cells">
                      {days.map((d) => (
                        <div key={d.date} className="ga-week-cell">
                          <div className="text-xs fw-600">
                            {d.label} · {fmtDate(d.date).slice(0, 5)}
                          </div>
                          <textarea
                            className="textarea"
                            rows={3}
                            aria-label={`${s.name} – ${d.label}`}
                            placeholder="Nội dung"
                            value={s.cells?.[d.date]?.text || ''}
                            onChange={(e) => updateCell(s, d.date, { text: e.target.value })}
                          />
                          <CodePicker
                            options={codeOptions}
                            value={s.cells?.[d.date]?.codes || []}
                            onChange={(codes) => updateCell(s, d.date, withSuggestion(s.cells?.[d.date], codes))}
                          />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <DaySlotEditor s={s} theme={theme} codeOptions={codeOptions} onChange={(patch) => updateSlot(s.id, patch)} />
                )}
              </Group>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="ga-split ga-split--wide">
          <Card title="Duyệt lại nội dung" num="3">
            <LessonInfo l={preview} theme={theme} />
            <div className="ga-divider" />
            {isWeek ? <WeekMatrix weekStart={form.weekStart} slots={form.slots} /> : <DayTable slots={form.slots} />}
          </Card>
          <div className="stack">
            <Card title="Chữ ký giáo viên">
              <SignatureBox value={form.signature} onChange={(signature) => set({ signature })} invalid={!!errors.signature} />
              {errors.signature && <div className="field__error mt-8">{errors.signature}</div>}
            </Card>
            <Notice>
              Giáo án được gửi tổ trưởng nhóm tuổi xem xét chuyên môn, sau đó Phó hiệu trưởng phê duyệt. Chỉ giáo án đã duyệt mới dùng được
              để đánh giá trẻ hằng ngày.
            </Notice>
          </div>
        </div>
      )}

      <div className="page-actions">
        <button
          type="button"
          className="btn"
          onClick={() => navigate(existing ? `/education/lessons/${existing.id}` : '/education/lessons')}
        >
          Hủy
        </button>
        <div className="row">
          <button type="button" className="btn" onClick={saveDraft}>
            <Save size={16} aria-hidden /> Lưu nháp
          </button>
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} aria-hidden /> Quay lại
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn--primary" onClick={next}>
              Tiếp theo <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => validate(2) && setConfirm(true)}>
              <Send size={16} aria-hidden /> Gửi tổ trưởng
            </button>
          )}
        </div>
      </div>

      {importing && (
        <ImportLessonModal
          lessons={lessons}
          type={form.type}
          excludeId={form.id}
          classId={user.classId}
          ageGroupId={user.ageGroupId}
          themes={themes}
          onClose={() => setImporting(false)}
          onImport={importFrom}
        />
      )}

      {removeSlot && (
        <Modal
          title={`Xóa “${removeSlot.name || 'giờ sinh hoạt'}”?`}
          onClose={() => setRemoveSlot(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setRemoveSlot(null)}>
                Giữ lại
              </button>
              <button type="button" className="btn btn--outline-danger" onClick={() => deleteSlot(removeSlot.id)}>
                <Trash2 size={16} aria-hidden /> Xóa
              </button>
            </>
          }
        >
          <p>Nội dung đã nhập trong giờ sinh hoạt này sẽ bị xóa khỏi giáo án đang soạn.</p>
        </Modal>
      )}

      {confirm && (
        <Modal
          title="Gửi giáo án"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setConfirm(false)}>
                Quay lại kiểm tra
              </button>
              <button type="button" className="btn btn--primary" onClick={submit}>
                <Send size={16} aria-hidden /> Gửi tổ trưởng
              </button>
            </>
          }
        >
          <p>
            Gửi {typeLabel(form.type).toLowerCase()} lớp {cls?.name} (
            {isWeek ? `tuần ${form.weekIndex}` : `${weekdayLabel(form.date)} ${fmtDate(form.date)}`}) cho tổ trưởng nhóm tuổi xem xét? Bạn
            không chỉnh sửa được khi giáo án đang chờ duyệt.
          </p>
        </Modal>
      )}
    </div>
  );
}

/** One time slot of the daily plan, following the 5 columns of the real template. */
function DaySlotEditor({ s, theme, codeOptions, onChange }) {
  // Chỉ Hoạt động học bắt buộc soạn chi tiết; giờ khác mở chi tiết khi cô cần hoặc đã có nội dung.
  const hasDetail =
    s.name === CORE_SLOT ||
    s.detailed ||
    [s.purpose, s.skills, s.prepTeacher, s.prepChild].some((t) => !isEmptyText(t)) ||
    s.steps.some((x) => !isEmptyText(x.teacher) || !isEmptyText(x.child));
  const pickCodes = (codes) =>
    onChange(isEmptyText(s.purpose) && hasDetail ? { codes, purpose: purposeFromCodes(codes, theme) } : { codes });
  const toggleIn = (key, v) => onChange({ [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] });
  const updateStep = (stid, patch) => onChange({ steps: s.steps.map((x) => (x.id === stid ? { ...x, ...patch } : x)) });
  return (
    <div className="ga-day-slot">
      <div className="ga-plan-grid">
        <Field label="Đề tài / hoạt động" htmlFor={`tp-${s.id}`}>
          <input
            id={`tp-${s.id}`}
            className="input"
            placeholder="Ví dụ: Toán – Ôn nhận biết các hình"
            value={s.topic}
            onChange={(e) => onChange({ topic: e.target.value })}
          />
        </Field>
        <div className="field">
          <span className="field__label">Mã YCCĐ</span>
          <CodePicker options={codeOptions} value={s.codes} onChange={pickCodes} />
        </div>
      </div>

      {!hasDetail ? (
        <button type="button" className="btn btn--sm btn--ghost mt-8" onClick={() => onChange({ detailed: true })}>
          <Plus size={16} className="text-primary" aria-hidden /> Thêm mục đích, chuẩn bị, các bước
        </button>
      ) : (
        <>
          <div className="ga-day-section-title">Mục đích – Yêu cầu</div>
          <div className="ga-plan-grid">
            <Field label="Năng lực theo lĩnh vực" htmlFor={`pu-${s.id}`}>
              <textarea
                id={`pu-${s.id}`}
                className="textarea"
                rows={2}
                placeholder="Trẻ nhận biết, thực hiện được…"
                value={s.purpose}
                onChange={(e) => onChange({ purpose: e.target.value })}
              />
            </Field>
            <Field label="Kỹ năng hỗ trợ" htmlFor={`sk-${s.id}`}>
              <textarea
                id={`sk-${s.id}`}
                className="textarea"
                rows={2}
                placeholder="Quan sát, so sánh, diễn đạt…"
                value={s.skills}
                onChange={(e) => onChange({ skills: e.target.value })}
              />
            </Field>
          </div>
          <div className="ga-plan-grid">
            <div className="field">
              <span className="field__label">Phẩm chất</span>
              <div className="ga-check-row">
                {QUALITIES.map((q) => (
                  <label key={q} className="checkbox">
                    <input type="checkbox" checked={s.qualities.includes(q)} onChange={() => toggleIn('qualities', q)} /> {q}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field__label">Năng lực nền tảng</span>
              <div className="ga-check-row">
                {COMPETENCIES.map((c) => (
                  <label key={c} className="checkbox">
                    <input type="checkbox" checked={s.competencies.includes(c)} onChange={() => toggleIn('competencies', c)} /> {c}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="ga-day-section-title">Chuẩn bị</div>
          <div className="ga-plan-grid">
            <Field label="Của cô" htmlFor={`pt-${s.id}`}>
              <textarea
                id={`pt-${s.id}`}
                className="textarea"
                rows={2}
                placeholder="Đồ dùng, học liệu, không gian"
                value={s.prepTeacher}
                onChange={(e) => onChange({ prepTeacher: e.target.value })}
              />
            </Field>
            <Field label="Của trẻ" htmlFor={`pc-${s.id}`}>
              <textarea
                id={`pc-${s.id}`}
                className="textarea"
                rows={2}
                placeholder="Đồ dùng, tâm thế của trẻ"
                value={s.prepChild}
                onChange={(e) => onChange({ prepChild: e.target.value })}
              />
            </Field>
          </div>

          <div className="ga-day-section-title row row--between">
            <span>Các bước tổ chức</span>
            <div className="row">
              {s.steps.length === 0 && (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => onChange({ steps: STEP_TEMPLATE.map((title) => ({ id: uid(), title, teacher: '', child: '' })) })}
                >
                  <ListPlus size={16} className="text-primary" aria-hidden /> Dùng 5 bước gợi ý
                </button>
              )}
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => onChange({ steps: [...s.steps, { id: uid(), title: '', teacher: '', child: '' }] })}
              >
                <Plus size={16} className="text-primary" aria-hidden /> Thêm bước
              </button>
            </div>
          </div>
          {s.steps.length > 0 && (
            <div className="ga-steps-table">
              <div className="ga-steps-head">
                <span>Bước</span>
                <span>Hoạt động của cô</span>
                <span>Hoạt động của trẻ</span>
                <span />
              </div>
              {s.steps.map((st, i) => (
                <div key={st.id} className="ga-steps-row">
                  <div>
                    <div className="fw-600 text-xs">Bước {i + 1}</div>
                    <input
                      className="input"
                      aria-label={`Tên bước ${i + 1}`}
                      placeholder="Tên bước"
                      value={st.title}
                      onChange={(e) => updateStep(st.id, { title: e.target.value })}
                    />
                  </div>
                  <textarea
                    className="textarea"
                    rows={2}
                    aria-label={`Hoạt động của cô bước ${i + 1}`}
                    value={st.teacher}
                    onChange={(e) => updateStep(st.id, { teacher: e.target.value })}
                  />
                  <textarea
                    className="textarea"
                    rows={2}
                    aria-label={`Hoạt động của trẻ bước ${i + 1}`}
                    value={st.child}
                    onChange={(e) => updateStep(st.id, { child: e.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Xóa bước ${i + 1}`}
                    onClick={() => onChange({ steps: s.steps.filter((x) => x.id !== st.id) })}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
