import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import {
  AGE_GROUPS,
  DOMAINS,
  EDU_STATUS,
  SCHOOL_SCOPE,
  domainLabel,
  isStandardDomain,
  prefixOf,
  suggestRequirementCode,
} from '@/models/education-plan/educationPlanConstants';
import { DomainTitle, Group } from '@/components/education-plan/PlanWidgets';
import ImportGoalsModal from '@/components/education-plan/ImportGoalsModal';
import { Card, Field, Modal, Notice, PageHead, SignatureBox, Stepper, fmtDate } from '@/components/education-plan/eduUi';

const suggestTitle = (year, ageGroupId) => {
  const ag = AGE_GROUPS.find((a) => a.id === ageGroupId);
  return ag ? `Mục tiêu giáo dục năm học ${year} nhóm tuổi ${ag.name.split(' (')[0]}` : '';
};

const STEPS = ['Thông tin chung', 'Mục tiêu theo lĩnh vực', 'Xác nhận và ký'];
const uid = () => Math.random().toString(36).slice(2, 9);

const emptyDomain = (name) => ({ id: uid(), name, items: [{ id: uid(), text: '', requirements: [] }] });
// Luôn đủ 5 lĩnh vực chuẩn theo đúng thứ tự; lĩnh vực khác (dữ liệu cũ) xếp cuối để chuyển mục tiêu rồi xóa.
const normalizeDomains = (domains) => [
  ...DOMAINS.map((name) => domains.find((d) => d.name === name) || emptyDomain(name)),
  ...domains.filter((d) => !isStandardDomain(d.name)),
];

// Một dòng dán từ Word có thể là "TC1.1: Trẻ …" hoặc "TC1.1. Trẻ …": tách mã và câu YCCĐ.
const CODE_LINE = /^\s*([A-Za-zĐđ]{1,4}\s?\d+(?:\.\d+)*(?:-[\p{L}\d]+)?)\s*[:.\-–]\s+(.+)$/u;
const pastedLines = (e) =>
  (e.clipboardData?.getData('text') || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-•*+]+/, '').trim())
    .filter(Boolean);

const emptyForm = (schoolYear) => ({
  title: '',
  ageGroupId: '',
  schoolYear,
  description: '',
  domains: DOMAINS.map((name) => ({ id: uid(), name, items: [{ id: uid(), text: '', requirements: [] }] })),
  signature: null,
});

export default function GoalFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { goals, schoolYear, saveGoal, toast, user } = useEducationPlan();
  const navigate = useNavigate();
  const existing = goals.find((g) => g.id === id);

  const [form, setForm] = useState(() =>
    existing
      ? {
          ...existing,
          domains: normalizeDomains(
            existing.domains.map((d) => ({
              ...d,
              id: d.id || uid(),
              items: d.items.map((it) => ({ ...it, requirements: it.requirements || [] })),
            })),
          ),
          signature: existing.signature || null,
        }
      : emptyForm(schoolYear),
  );
  const [step, setStep] = useState(() => (params.get('buoc') === 'ky' ? 2 : 0));
  const [maxReached, setMaxReached] = useState(existing ? 2 : 0);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removeDomain, setRemoveDomain] = useState(null);
  // Bước 2 xem theo tab: 'all' hoặc id của một lĩnh vực.
  const [tab, setTab] = useState(null);
  // Tab cuối "Tất cả": mở cửa sổ lớn chứa mọi lĩnh vực, sửa được như trong từng tab.
  const [showAll, setShowAll] = useState(false);
  // Mục tiêu đang mở danh sách YCCĐ; mặc định thu gọn để nhìn được nhiều mục tiêu.
  const [openReqs, setOpenReqs] = useState(() => new Set());
  const [focusId, setFocusId] = useState(null);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const ageName = AGE_GROUPS.find((a) => a.id === form.ageGroupId)?.name;

  let counter = 0;
  const numbered = form.domains.map((d) => ({
    ...d,
    items: d.items.map((it) => ({ ...it, code: it.text.trim() ? `MT${++counter}` : '' })),
  }));
  const totalGoals = counter;

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.title.trim()) e.title = 'Nhập tên bộ mục tiêu';
      if (!form.ageGroupId) e.ageGroupId = 'Chọn nhóm tuổi áp dụng';
      const dup = goals.find((g) => g.id !== form.id && g.schoolYear === form.schoolYear && g.ageGroupId === form.ageGroupId);
      if (form.ageGroupId && dup) e.ageGroupId = 'Nhóm tuổi này đã có mục tiêu năm học. Mở bộ mục tiêu đã có để chỉnh sửa.';
    }
    if (s === 1) {
      if (totalGoals === 0) e.domains = 'Nhập ít nhất một mục tiêu';
      else if (form.domains.some((d) => !isStandardDomain(d.name) && d.items.some((i) => i.text.trim())))
        e.domains = 'Có lĩnh vực không thuộc 5 lĩnh vực của chương trình. Chuyển mục tiêu sang lĩnh vực phù hợp rồi xóa lĩnh vực đó.';
      else {
        const reqs = form.domains.flatMap((d) => d.items.filter((i) => i.text.trim()).flatMap((i) => i.requirements));
        const codes = reqs.filter((r) => r.text.trim()).map((r) => r.code.trim());
        const dup = codes.find((c, i) => c && codes.indexOf(c) !== i);
        if (reqs.some((r) => r.text.trim() && !r.code.trim())) e.domains = 'Có YCCĐ chưa nhập mã.';
        else if (dup) e.domains = `Mã YCCĐ “${dup}” bị trùng. Mỗi YCCĐ cần một mã riêng.`;
      }
    }
    if (s === 2) {
      if (!form.signature) e.signature = 'Ký xác nhận trước khi gửi tổ trưởng';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    const n = Math.min(step + 1, STEPS.length - 1);
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
  };

  const build = (status) => {
    const today = new Date().toISOString().slice(0, 10);
    const ag = AGE_GROUPS.find((a) => a.id === form.ageGroupId);
    const agCode = (ag?.name || 'X')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
    return {
      id: form.id || `g-${uid()}`,
      code: form.code || `MTNH-${form.schoolYear.slice(2, 4)}${form.schoolYear.slice(-2)}-${agCode}`,
      schoolYear: form.schoolYear,
      ageGroupId: form.ageGroupId,
      title: form.title.trim(),
      description: form.description.trim(),
      status,
      createdAt: form.createdAt || today,
      sentAt: status === EDU_STATUS.SENT ? today : null,
      createdBy: user.name,
      file: form.file || null,
      signature: form.signature,
      domains: numbered
        .map((d) => ({
          name: d.name,
          items: d.items
            .filter((i) => i.text.trim())
            .map(({ id: itemId, code, text, requirements }) => ({
              id: itemId,
              code,
              text: text.trim(),
              requirements: requirements.filter((r) => r.text.trim()).map((r) => ({ id: r.id, code: r.code.trim(), text: r.text.trim() })),
            })),
        }))
        .filter((d) => d.items.length),
    };
  };

  const saveDraft = () => {
    if (!form.title.trim() || !form.ageGroupId) {
      setStep(0);
      validate(0);
      return;
    }
    const item = build(EDU_STATUS.DRAFT);
    saveGoal(item);
    toast('Đã lưu nháp mục tiêu năm học');
    navigate(`/education/goals/${item.id}`);
  };

  const submit = () => {
    const item = build(EDU_STATUS.SENT);
    saveGoal(item);
    setConfirm(false);
    toast(`Đã gửi mục tiêu năm học cho tổ trưởng ${ageName}`);
    navigate(`/education/goals/${item.id}`);
  };

  const updateItem = (di, ii, text) =>
    set({
      domains: form.domains.map((d, i) => (i !== di ? d : { ...d, items: d.items.map((it, j) => (j === ii ? { ...it, text } : it)) })),
    });
  const setRequirements = (di, ii, fn) =>
    set({
      domains: form.domains.map((d, i) =>
        i !== di ? d : { ...d, items: d.items.map((it, j) => (j === ii ? { ...it, requirements: fn(it.requirements) } : it)) },
      ),
    });
  const addRequirement = (di, ii) => insertRequirementsAfter(di, ii, null);
  const updateRequirement = (di, ii, rid, patch) =>
    setRequirements(di, ii, (list) => list.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  const removeRequirement = (di, ii, rid) => setRequirements(di, ii, (list) => list.filter((r) => r.id !== rid));
  const toggleReqs = (itemId) =>
    setOpenReqs((s0) => {
      const n = new Set(s0);
      if (n.has(itemId)) n.delete(itemId);
      else n.add(itemId);
      return n;
    });
  const openReq = (itemId) => setOpenReqs((s0) => new Set(s0).add(itemId));

  // Enter ở ô mục tiêu: thêm mục tiêu mới ngay bên dưới.
  // replaceCurrent: dòng đầu ghi vào chính mục tiêu đang trống, các dòng sau chèn tiếp (một lần cập nhật).
  const insertItemAfter = (di, ii, texts = [''], replaceCurrent = false) => {
    const rest = replaceCurrent ? texts.slice(1) : texts;
    const fresh = rest.map((text) => ({ id: uid(), text, requirements: [] }));
    set({
      domains: form.domains.map((d, i) => {
        if (i !== di) return d;
        const items = [...d.items];
        if (replaceCurrent) items[ii] = { ...items[ii], text: texts[0] };
        items.splice(ii + 1, 0, ...fresh);
        return { ...d, items };
      }),
    });
    if (fresh.length) setFocusId(fresh[fresh.length - 1].id);
  };
  // Enter ở ô YCCĐ (hoặc dán nhiều dòng): thêm YCCĐ ngay sau, mã gợi ý nếu dòng không có mã.
  // replaceAfter: dòng đầu ghi vào chính YCCĐ afterId (đang trống).
  const insertRequirementsAfter = (di, ii, afterId, lines = [''], replaceAfter = false) => {
    const all = form.domains.flatMap((d) => d.items.flatMap((x) => x.requirements));
    const parsed = [];
    lines.forEach((line) => {
      const m = line.match(CODE_LINE);
      const code = m ? m[1].replace(/\s/g, '') : suggestRequirementCode(form.domains[di].name, ii, [...all, ...parsed]);
      parsed.push({ id: uid(), code, text: m ? m[2].trim() : line, hasCode: !!m });
    });
    const strip = ({ hasCode: _h, ...x }) => x;
    const [head, ...tail] = parsed;
    const fresh = (replaceAfter ? tail : parsed).map(strip);
    setRequirements(di, ii, (list) => {
      const base = replaceAfter
        ? list.map((x) => (x.id !== afterId ? x : { ...x, text: head.text, code: head.hasCode ? head.code : x.code }))
        : list;
      const at = afterId ? base.findIndex((x) => x.id === afterId) + 1 : base.length;
      const next = [...base];
      next.splice(at, 0, ...fresh);
      return next;
    });
    openReq(form.domains[di].items[ii].id);
    if (fresh.length) setFocusId(fresh[fresh.length - 1].id);
  };
  const onItemPaste = (di, ii, e) => {
    const lines = pastedLines(e);
    if (lines.length < 2) return;
    e.preventDefault();
    insertItemAfter(di, ii, lines, !form.domains[di].items[ii].text.trim());
  };
  const onRequirementPaste = (di, ii, r, e) => {
    const lines = pastedLines(e);
    if (lines.length < 2) return;
    e.preventDefault();
    insertRequirementsAfter(di, ii, r.id, lines, !r.text.trim());
  };
  useEffect(() => {
    if (!focusId) return;
    document.querySelector(`[data-focus="${focusId}"]`)?.focus();
    setFocusId(null);
  }, [focusId]);

  const removeItem = (di, ii) =>
    set({ domains: form.domains.map((d, i) => (i !== di ? d : { ...d, items: d.items.filter((_, j) => j !== ii) })) });
  const listRef = useRef(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleDomain = (domainId) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(domainId)) n.delete(domainId);
      else n.add(domainId);
      return n;
    });
  const allCollapsed = form.domains.length > 0 && form.domains.every((d) => collapsed.has(d.id));
  const deleteDomain = (di) => {
    set({ domains: form.domains.filter((_, i) => i !== di) });
    setRemoveDomain(null);
  };
  const importGoals = (domains, source) => {
    let merged = form.domains.map((d) => ({ ...d, items: [...d.items] }));
    let added = 0;
    let skipped = 0;
    domains.forEach((src) => {
      const target = merged.find((d) => d.name.trim().toLowerCase() === src.name.trim().toLowerCase());
      // Lĩnh vực ngoài 5 lĩnh vực chuẩn không được thêm vào bộ mới.
      if (!target || !isStandardDomain(target.name)) {
        skipped += src.items.length;
        return;
      }
      target.items = target.items.filter((i) => i.text.trim());
      src.items.forEach((text) => {
        if (!target.items.some((i) => i.text.trim() === text.trim())) {
          target.items.push({ id: uid(), text, requirements: [] });
          added++;
        }
      });
    });
    merged = merged.map((d) => (d.items.length ? d : { ...d, items: [{ id: uid(), text: '', requirements: [] }] }));
    set({ domains: merged });
    setImporting(false);
    const skipNote = skipped ? `. Bỏ qua ${skipped} mục tiêu thuộc lĩnh vực ngoài chương trình` : '';
    toast(
      added ? `Đã thêm ${added} mục tiêu từ ${source.code}${skipNote}` : `Không có mục tiêu mới được thêm${skipNote}`,
      skipped ? 'warn' : 'ok',
    );
  };

  const filledDomains = numbered.filter((d) => d.items.some((i) => i.text.trim()));
  const allCodes = form.domains.flatMap((d) =>
    d.items.flatMap((i) => i.requirements.filter((r) => r.text.trim()).map((r) => r.code.trim())),
  );
  // Lĩnh vực có YCCĐ thiếu mã hoặc trùng mã: đánh dấu trên tab để biết cần sửa ở đâu.
  const domainHasProblem = (d) =>
    !isStandardDomain(d.name)
      ? d.items.some((i) => i.text.trim())
      : d.items.some((i) =>
          i.requirements.some((r) => r.text.trim() && (!r.code.trim() || allCodes.filter((c) => c === r.code.trim()).length > 1)),
        );
  const filledCount = (d) => d.items.filter((i) => i.text.trim()).length;
  const activeTab = numbered.some((d) => d.id === tab) ? tab : numbered[0]?.id;
  const shownDomains = numbered.filter((d) => d.id === activeTab);
  const editDomain = (domainId) => {
    setTab(domainId);
    setCollapsed(new Set());
    setStep(1);
    window.scrollTo({ top: 0 });
  };
  const renderGroups = (list) =>
    list.map((d) => {
      const di = numbered.indexOf(d);
      return (
        <Group
          key={d.id}
          id={d.id}
          collapsed={collapsed.has(d.id)}
          onToggle={() => toggleDomain(d.id)}
          title={<DomainTitle name={d.name} />}
          meta={`${filledCount(d)} mục tiêu`}
          actions={
            !isStandardDomain(d.name) && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Xóa lĩnh vực ${d.name}`}
                onClick={() => (d.items.some((i) => i.text.trim()) ? setRemoveDomain(di) : deleteDomain(di))}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            )
          }
        >
          {!isStandardDomain(d.name) && (
            <Notice tone="warn">
              Lĩnh vực này không thuộc 5 lĩnh vực của Chương trình GDMN. Chuyển các mục tiêu sang lĩnh vực phù hợp rồi xóa lĩnh vực này.
            </Notice>
          )}
          {d.items.map((it, ii) => {
            const open = openReqs.has(it.id);
            const reqCount = it.requirements.filter((r) => r.text.trim()).length;
            return (
              <div key={it.id} className="stack gap-2">
                <div className="ga-goal-row">
                  <span className="ga-goal-code">{it.code || '—'}</span>
                  <input
                    className="input"
                    data-focus={it.id}
                    aria-label={`Mục tiêu ${ii + 1} lĩnh vực ${d.name}`}
                    placeholder="Nhập nội dung mục tiêu (Enter để thêm dòng, dán nhiều dòng để thêm nhiều mục tiêu)"
                    value={it.text}
                    onChange={(e) => updateItem(di, ii, e.target.value)}
                    onPaste={(e) => onItemPaste(di, ii, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        insertItemAfter(di, ii);
                      }
                    }}
                  />
                  <button type="button" className="icon-btn" onClick={() => removeItem(di, ii)} aria-label="Xóa mục tiêu">
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
                <div className="ga-goal-check--child stack gap-2">
                  <div>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      aria-expanded={open}
                      onClick={() => (reqCount || it.requirements.length ? toggleReqs(it.id) : addRequirement(di, ii))}
                    >
                      {open ? (
                        <ChevronDown size={16} className="text-primary" aria-hidden />
                      ) : (
                        <ChevronRight size={16} className="text-primary" aria-hidden />
                      )}
                      {reqCount ? `${reqCount} YCCĐ` : 'Chưa có YCCĐ – thêm'}
                      {!open && reqCount > 0 && (
                        <span className="muted text-xs">
                          {' '}
                          ·{' '}
                          {it.requirements
                            .filter((r) => r.text.trim())
                            .map((r) => r.code)
                            .join(', ')}
                        </span>
                      )}
                    </button>
                  </div>
                  {open &&
                    it.requirements.map((r, ri) => (
                      <div className="ga-goal-row" key={r.id}>
                        <input
                          className="input"
                          aria-label={`Mã YCCĐ ${ri + 1} của ${it.code || 'mục tiêu'}`}
                          placeholder="Mã"
                          value={r.code}
                          onChange={(e) => updateRequirement(di, ii, r.id, { code: e.target.value })}
                        />
                        <input
                          className="input"
                          data-focus={r.id}
                          aria-label={`Yêu cầu cần đạt ${ri + 1} của ${it.code || 'mục tiêu'}`}
                          placeholder="Yêu cầu cần đạt (Enter để thêm YCCĐ, dán nhiều dòng dạng “TC1.1: Trẻ …”)"
                          value={r.text}
                          onChange={(e) => updateRequirement(di, ii, r.id, { text: e.target.value })}
                          onPaste={(e) => onRequirementPaste(di, ii, r, e)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              insertRequirementsAfter(di, ii, r.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removeRequirement(di, ii, r.id)}
                          aria-label={`Xóa YCCĐ ${r.code}`}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    ))}
                  {open && (
                    <div>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => addRequirement(di, ii)}>
                        <Plus size={16} className="text-primary" aria-hidden /> Thêm YCCĐ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isStandardDomain(d.name) && (
            <div>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => insertItemAfter(di, d.items.length - 1)}>
                <Plus size={16} className="text-primary" aria-hidden /> Thêm mục tiêu
              </button>
            </div>
          )}
        </Group>
      );
    });
  // Toàn bộ lĩnh vực ở dạng xem cho bước duyệt lại.
  const overviewBlocks = numbered.map((d) => (
    <div key={d.id} className="mb-16">
      <div className="row row--between">
        <div className="row gap-2">
          <span className="section-title">{domainLabel(d.name)}</span>
          {isStandardDomain(d.name) && <span className="chip chip--blue">Mã: {prefixOf(d.name)}</span>}
          {domainHasProblem(d) && <AlertTriangle size={16} className="text-danger" aria-label="Có lỗi cần sửa" />}
        </div>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => editDomain(d.id)}>
          <Pencil size={16} className="text-primary" aria-hidden /> Sửa lĩnh vực này
        </button>
      </div>
      {filledCount(d) === 0 && <p className="muted text-sm">Chưa có mục tiêu.</p>}
      {d.items
        .filter((i) => i.text.trim())
        .map((i) => (
          <div key={i.id}>
            <div className="ga-goal-row ga-goal-row--read">
              <span className="ga-goal-code">{i.code}</span>
              <span>{i.text}</span>
            </div>
            {i.requirements.filter((r) => r.text.trim()).length === 0 && (
              <p className="muted text-xs ga-goal-check--child">Chưa có YCCĐ – tổ trưởng chưa chọn được mục tiêu này khi lập chủ đề.</p>
            )}
            {i.requirements
              .filter((r) => r.text.trim())
              .map((r) => (
                <div key={r.id} className="ga-goal-row ga-goal-row--read ga-goal-check--child">
                  <span className="ga-goal-code">{r.code}</span>
                  <span className="text-sm">{r.text}</span>
                </div>
              ))}
          </div>
        ))}
    </div>
  ));

  return (
    <div className={step === 1 ? 'page ga-page-fill' : 'page'}>
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          { label: 'Mục tiêu năm học', to: '/education/goals' },
          { label: existing ? 'Chỉnh sửa' : 'Tạo mục tiêu' },
        ]}
        title={existing ? 'Chỉnh sửa mục tiêu năm học' : 'Tạo mục tiêu năm học'}
      />
      <Stepper steps={STEPS} current={step} maxReached={maxReached} onStep={(i) => i <= maxReached && setStep(i)} />

      {step === 0 && (
        <Card title="Thông tin chung" num="1">
          <div className="grid-2">
            <Field label="Năm học" required inline>
              <input className="input" value={form.schoolYear} readOnly />
            </Field>
            <Field label="Phạm vi áp dụng" inline>
              <input className="input" value={SCHOOL_SCOPE} readOnly />
            </Field>
            <Field label="Nhóm tuổi áp dụng" required inline error={errors.ageGroupId} htmlFor="ag">
              <select
                id="ag"
                className={`select ${errors.ageGroupId ? 'is-invalid' : ''}`}
                value={form.ageGroupId}
                onChange={(e) => {
                  const ageGroupId = e.target.value;
                  // Suggest a title only while the user has not typed their own
                  const keep = form.title.trim() && form.title !== suggestTitle(form.schoolYear, form.ageGroupId);
                  set(keep ? { ageGroupId } : { ageGroupId, title: suggestTitle(form.schoolYear, ageGroupId) });
                }}
              >
                <option value="">Chọn nhóm tuổi</option>
                {AGE_GROUPS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Người lập" inline>
              <input className="input" value={`${user.name} (${user.title})`} readOnly />
            </Field>
          </div>
          <div className="stack mt-16">
            <Field label="Tên bộ mục tiêu" required inline error={errors.title} htmlFor="title" counter={`${form.title.length}/150`}>
              <input
                id="title"
                className={`input ${errors.title ? 'is-invalid' : ''}`}
                maxLength={150}
                placeholder="Chọn nhóm tuổi áp dụng để hệ thống đề xuất tên"
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                onBlur={() => form.title && setErrors((x) => ({ ...x, title: undefined }))}
              />
            </Field>
            <Field label="Mô tả" inline top htmlFor="desc" counter={`${form.description.length}/500`}>
              <textarea
                id="desc"
                className="textarea"
                maxLength={500}
                placeholder="Căn cứ xây dựng, phạm vi áp dụng"
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card
          title="Mục tiêu theo lĩnh vực phát triển"
          num="2"
          className="ga-card-fill"
          bodyClass={null}
          actions={
            <div className="row">
              <span className="muted text-xs" style={{ marginRight: 8 }}>
                {totalGoals} mục tiêu
              </span>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(form.domains.map((d) => d.id)))}
              >
                {allCollapsed ? <ChevronsUpDown size={16} aria-hidden /> : <ChevronsDownUp size={16} aria-hidden />}
                {allCollapsed ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
              </button>
              <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setImporting(true)}>
                <Download size={16} aria-hidden /> Lấy từ bộ mục tiêu có sẵn
              </button>
            </div>
          }
        >
          <div className="tabs" role="tablist" aria-label="Lĩnh vực">
            {numbered.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={activeTab === d.id}
                title={domainLabel(d.name)}
                className={`tab ${activeTab === d.id ? 'tab--active' : ''}`}
                onClick={() => {
                  setTab(d.id);
                  setCollapsed((c) => {
                    const n = new Set(c);
                    n.delete(d.id);
                    return n;
                  });
                }}
              >
                {domainHasProblem(d) && <AlertTriangle size={14} className="text-danger" aria-label="Có lỗi cần sửa" />}
                {isStandardDomain(d.name) ? prefixOf(d.name) : d.name} <span className="tab__count">{filledCount(d)}</span>
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={showAll}
              className={`tab ${showAll ? 'tab--active' : ''}`}
              onClick={() => setShowAll(true)}
            >
              {numbered.some(domainHasProblem) && <AlertTriangle size={14} className="text-danger" aria-label="Có lỗi cần sửa" />}
              Tất cả <span className="tab__count">{totalGoals}</span>
            </button>
          </div>
          <div className="card__body ga-card-scroll" ref={listRef}>
            {errors.domains && (
              <div className="mb-16">
                <Notice tone="err">{errors.domains}</Notice>
              </div>
            )}
            {renderGroups(shownDomains)}
          </div>
        </Card>
      )}

      {showAll && (
        <Modal
          title={`Tất cả mục tiêu · ${totalGoals} mục tiêu`}
          width={1100}
          onClose={() => setShowAll(false)}
          footer={
            <button type="button" className="btn btn--primary" onClick={() => setShowAll(false)}>
              Xong
            </button>
          }
        >
          {errors.domains && <Notice tone="err">{errors.domains}</Notice>}
          {renderGroups(numbered)}
        </Modal>
      )}

      {importing && (
        <ImportGoalsModal
          goals={goals}
          excludeId={form.id}
          defaultAgeGroupId={form.ageGroupId}
          onClose={() => setImporting(false)}
          onImport={importGoals}
        />
      )}

      {removeDomain !== null && (
        <Modal
          title={`Xóa lĩnh vực “${form.domains[removeDomain]?.name || 'chưa đặt tên'}”?`}
          onClose={() => setRemoveDomain(null)}
          footer={
            <>
              <button className="btn" onClick={() => setRemoveDomain(null)}>
                Giữ lại
              </button>
              <button className="btn btn--outline-danger" onClick={() => deleteDomain(removeDomain)}>
                <Trash2 size={16} aria-hidden /> Xóa lĩnh vực
              </button>
            </>
          }
        >
          <p>
            Lĩnh vực này có {form.domains[removeDomain]?.items.filter((i) => i.text.trim()).length} mục tiêu. Tất cả mục tiêu bên trong sẽ
            bị xóa khỏi bộ đang soạn.
          </p>
        </Modal>
      )}

      {step === 2 && (
        <div className="ga-split">
          <Card title="Duyệt lại nội dung" num="3">
            <dl className="info-list">
              <dt>Tên bộ mục tiêu</dt>
              <dd className="fw-600">{form.title}</dd>
              <dt>Năm học</dt>
              <dd>{form.schoolYear}</dd>
              <dt>Nhóm tuổi áp dụng</dt>
              <dd>{ageName}</dd>
              <dt>Phạm vi</dt>
              <dd>{SCHOOL_SCOPE}</dd>
              <dt>Số mục tiêu</dt>
              <dd>
                {totalGoals} mục tiêu trong {filledDomains.length} lĩnh vực
              </dd>
              <dt>Ngày lập</dt>
              <dd>{fmtDate(new Date().toISOString())}</dd>
            </dl>
            <div className="ga-divider" />
            {overviewBlocks}
          </Card>
          <div className="stack">
            <Card title="Chữ ký người lập">
              <SignatureBox value={form.signature} onChange={(signature) => set({ signature })} invalid={!!errors.signature} />
              {errors.signature && <div className="field__error mt-8">{errors.signature}</div>}
            </Card>
            <Notice>Sau khi gửi, tổ trưởng {ageName} của toàn trường nhận thông báo và dùng mục tiêu này để lập kế hoạch chủ đề.</Notice>
          </div>
        </div>
      )}

      <div className="page-actions">
        <button type="button" className="btn" onClick={() => navigate(existing ? `/education/goals/${existing.id}` : '/education/goals')}>
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

      {confirm && (
        <Modal
          title="Gửi mục tiêu năm học"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>
                Quay lại kiểm tra
              </button>
              <button className="btn btn--primary" onClick={submit}>
                <Send size={16} aria-hidden /> Gửi tổ trưởng
              </button>
            </>
          }
        >
          <p>
            Gửi <span className="fw-600">{form.title}</span> cho tổ trưởng {ageName}? Tổ trưởng sẽ nhận thông báo và xem được bộ mục tiêu
            này.
          </p>
        </Modal>
      )}
    </div>
  );
}
