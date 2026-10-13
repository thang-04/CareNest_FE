import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Download, FileDown, Pencil, Save, Send, Trash2, Upload } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import {
  AGE_GROUPS,
  DOMAINS,
  EDU_STATUS,
  SCHOOL_SCOPE,
  isStandardDomain,
  prefixOf,
  suggestRequirementCode,
} from '@/models/education-plan/educationPlanConstants';
import { DomainTitle } from '@/components/education-plan/PlanWidgets';
import { exportGoalsCsv, parseGoalsCsv } from '@/utils/education-plan/goalCsv';
import ImportGoalsModal from '@/components/education-plan/ImportGoalsModal';
import { Card, Field, Modal, Notice, PageHead, Stepper, fmtDate } from '@/components/education-plan/eduUi';
import { SignaturePicker } from '@/components/signature/SignaturePicker';

const suggestTitle = (year, ageGroupId) => {
  const ag = AGE_GROUPS.find((a) => a.id === ageGroupId);
  return ag ? `Mục tiêu giáo dục năm học ${year} nhóm tuổi ${ag.name.split(' (')[0]}` : '';
};

const STEPS = ['Thông tin chung', 'Mục tiêu theo lĩnh vực', 'Xác nhận và ký'];
const uid = () => Math.random().toString(36).slice(2, 9);

// Lĩnh vực mới chưa có mục tiêu: chỉ hiện nút "Thêm mục tiêu"; mục tiêu có nội dung mới hiện "Thêm YCCĐ".
const emptyDomain = (name) => ({ id: uid(), name, items: [] });
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

// Ô nhập trong bảng tự cao theo nội dung để đọc đủ câu dài, không cần cuộn trong ô.
const fitHeight = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

const emptyForm = (schoolYear) => ({
  title: '',
  ageGroupId: '',
  schoolYear,
  description: '',
  domains: DOMAINS.map((name) => emptyDomain(name)),
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
    items: d.items.map((it) => ({ ...it, code: `MT${++counter}` })),
  }));
  const totalGoals = form.domains.reduce((n, d) => n + d.items.filter((i) => i.text.trim()).length, 0);

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.title.trim()) e.title = 'Nhập tên bộ mục tiêu';
      if (!form.ageGroupId) e.ageGroupId = 'Chọn nhóm tuổi áp dụng';
      const dup = goals.find((g) => g.id !== form.id && g.schoolYear === form.schoolYear && g.ageGroupId === form.ageGroupId);
      if (form.ageGroupId && dup) e.ageGroupId = 'Nhóm tuổi này đã có mục tiêu năm học. Mở bộ mục tiêu đã có để chỉnh sửa.';
    }
    if (s === 1) {
      const blankWithReqs = numbered.flatMap((d) => d.items).find((i) => !i.text.trim() && i.requirements.some((r) => r.text.trim()));
      if (totalGoals === 0) e.domains = 'Nhập ít nhất một mục tiêu';
      else if (blankWithReqs)
        e.domains = `${blankWithReqs.code} chưa có nội dung mục tiêu nhưng đã có YCCĐ. Nhập mục tiêu hoặc xóa hàng bằng nút thùng rác.`;
      else if (form.domains.some((d) => !isStandardDomain(d.name) && d.items.some((i) => i.text.trim())))
        e.domains = 'Có lĩnh vực không thuộc 5 lĩnh vực của chương trình. Chuyển mục tiêu sang lĩnh vực phù hợp rồi xóa lĩnh vực đó.';
      else {
        const reqs = form.domains.flatMap((d) => d.items.filter((i) => i.text.trim()).flatMap((i) => i.requirements));
        const codes = reqs.filter((r) => r.text.trim()).map((r) => r.code.trim());
        const dup = codes.find((c, i) => c && codes.indexOf(c) !== i);
        const wrongPrefix = form.domains
          .filter((d) => isStandardDomain(d.name))
          .flatMap((d) =>
            d.items.flatMap((i) => i.requirements).filter((r) => r.text.trim() && !r.code.trim().startsWith(prefixOf(d.name))),
          );
        if (reqs.some((r) => r.text.trim() && !r.code.trim())) e.domains = 'Có YCCĐ chưa nhập mã.';
        else if (wrongPrefix.length) e.domains = `Mã YCCĐ “${wrongPrefix[0].code}” phải bắt đầu bằng mã lĩnh vực của nó.`;
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
    let saved = 0;
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
      // Mục tiêu trống không được lưu; đánh lại số MT liên tục cho các mục tiêu còn lại.
      domains: numbered
        .map((d) => ({
          name: d.name,
          items: d.items
            .filter((i) => i.text.trim())
            .map(({ id: itemId, text, requirements }) => ({
              id: itemId,
              code: `MT${++saved}`,
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
  const updateRequirement = (di, ii, rid, patch) =>
    setRequirements(di, ii, (list) => list.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  const removeRequirement = (di, ii, rid) => setRequirements(di, ii, (list) => list.filter((r) => r.id !== rid));

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
  // Enter ở ô YCCĐ (hoặc dán nhiều dòng): thêm YCCĐ ngay sau. Mã do hệ thống tự cấp (mã lĩnh vực + số mục tiêu + số tăng dần),
  // không sửa tay và không đánh lại khi xoá để chủ đề, giáo án đã dùng mã vẫn khớp.
  // replaceAfter: dòng đầu ghi vào chính YCCĐ afterId (đang trống).
  const insertRequirementsAfter = (di, ii, afterId, lines = [''], replaceAfter = false) => {
    const all = form.domains.flatMap((d) => d.items.flatMap((x) => x.requirements));
    const parsed = [];
    lines.forEach((line) => {
      const m = line.match(CODE_LINE);
      const code = suggestRequirementCode(form.domains[di].name, ii, [...all, ...parsed]);
      parsed.push({ id: uid(), code, text: m ? m[2].trim() : line });
    });
    const [head, ...tail] = parsed;
    const fresh = replaceAfter ? tail : parsed;
    setRequirements(di, ii, (list) => {
      const base = replaceAfter ? list.map((x) => (x.id !== afterId ? x : { ...x, text: head.text })) : list;
      const at = afterId ? base.findIndex((x) => x.id === afterId) + 1 : base.length;
      const next = [...base];
      next.splice(at, 0, ...fresh);
      return next;
    });
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
    const el = document.querySelector(`[data-focus="${focusId}"]`);
    el?.focus();
    // Đặt con trỏ cuối ô để gõ tiếp khi dòng mới vừa được tạo từ ô trống.
    el?.setSelectionRange?.(el.value.length, el.value.length);
    setFocusId(null);
  }, [focusId]);
  // Ô nhập trong bảng đo lại chiều cao sau mỗi lần vẽ và khi đổi cỡ cửa sổ (cột co giãn làm câu xuống dòng khác).
  useEffect(() => {
    const fitAll = () => document.querySelectorAll('.ga-cell-input').forEach(fitHeight);
    fitAll();
    window.addEventListener('resize', fitAll);
    return () => window.removeEventListener('resize', fitAll);
  });

  const removeItem = (di, ii) =>
    set({ domains: form.domains.map((d, i) => (i !== di ? d : { ...d, items: d.items.filter((_, j) => j !== ii) })) });
  const deleteDomain = (di) => {
    set({ domains: form.domains.filter((_, i) => i !== di) });
    setRemoveDomain(null);
  };
  // Nhập file CSV (mẫu giống file xuất): thêm mục tiêu và YCCĐ chưa có, mã do hệ thống tự cấp.
  const fileRef = useRef(null);
  const importCsv = async (file) => {
    if (!file) return;
    const { domains: parsed, skipped } = parseGoalsCsv(await file.text());
    let addedGoals = 0;
    let addedReqs = 0;
    const all = form.domains.flatMap((d) => d.items.flatMap((x) => x.requirements));
    const next = form.domains.map((d) => {
      const src = parsed.find((p) => p.domain === d.name);
      if (!src) return d;
      const items = [...d.items];
      src.goals.forEach((g) => {
        let ii = items.findIndex((it) => it.text.trim().toLowerCase() === g.text.toLowerCase());
        if (ii === -1) {
          items.push({ id: uid(), text: g.text, requirements: [] });
          ii = items.length - 1;
          addedGoals++;
        }
        const reqs = [...items[ii].requirements];
        g.requirements.forEach((text) => {
          if (reqs.some((x) => x.text.trim().toLowerCase() === text.toLowerCase())) return;
          const req = { id: uid(), code: suggestRequirementCode(d.name, ii, [...all, ...reqs]), text };
          reqs.push(req);
          all.push(req);
          addedReqs++;
        });
        items[ii] = { ...items[ii], requirements: reqs };
      });
      return { ...d, items };
    });
    set({ domains: next });
    if (fileRef.current) fileRef.current.value = '';
    toast(
      addedGoals || addedReqs
        ? `Đã nhập ${addedGoals} mục tiêu, ${addedReqs} YCCĐ từ file${skipped ? `. Bỏ qua ${skipped} dòng không hợp lệ` : ''}`
        : 'File không có mục tiêu hoặc YCCĐ mới để thêm',
      skipped ? 'warn' : 'ok',
    );
  };

  const importGoals = (domains, source) => {
    const merged = form.domains.map((d) => ({ ...d, items: [...d.items] }));
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
    set({ domains: merged });
    setImporting(false);
    const skipNote = skipped ? `. Bỏ qua ${skipped} mục tiêu thuộc lĩnh vực ngoài chương trình` : '';
    toast(
      added ? `Đã thêm ${added} mục tiêu từ ${source.code}${skipNote}` : `Không có mục tiêu mới được thêm${skipNote}`,
      skipped ? 'warn' : 'ok',
    );
  };

  const allCodes = form.domains.flatMap((d) =>
    d.items.flatMap((i) => i.requirements.filter((r) => r.text.trim()).map((r) => r.code.trim())),
  );
  // Lĩnh vực có YCCĐ thiếu mã hoặc trùng mã: đánh dấu trên dòng lĩnh vực để biết cần sửa ở đâu.
  const domainHasProblem = (d) =>
    !isStandardDomain(d.name)
      ? d.items.some((i) => i.text.trim())
      : d.items.some((i) =>
          i.requirements.some((r) => r.text.trim() && (!r.code.trim() || allCodes.filter((c) => c === r.code.trim()).length > 1)),
        );
  // Từ bước duyệt lại: về bảng và cuộn tới dòng của lĩnh vực cần sửa.
  const editDomain = (domainId) => {
    setStep(1);
    setTimeout(() => document.getElementById(`goal-domain-${domainId}`)?.scrollIntoView({ block: 'center' }));
  };
  // Bảng mục tiêu kiểu Word: ô mục tiêu gộp theo số YCCĐ, mỗi YCCĐ một hàng (mã tự cấp). Chỉ nút thùng rác mới xóa hàng.
  // readOnly dùng cho bước duyệt lại.
  const enterKey = (e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing;
  const addFirstGoal = (di, lines) => {
    const fresh = lines.map((text) => ({ id: uid(), text, requirements: [] }));
    set({ domains: form.domains.map((d, i) => (i !== di ? d : { ...d, items: fresh })) });
    setFocusId(fresh.at(-1).id);
  };
  const cellInput = (props) => (
    <textarea className="ga-cell-input" rows={1} ref={(el) => fitHeight(el)} onInput={(e) => fitHeight(e.target)} {...props} />
  );

  const renderTable = (list, readOnly = false) => (
    <div className="table-wrap">
      <table className="table ga-plan-table ga-goal-table">
        <colgroup>
          <col className="ga-goal-table__code" />
          <col className="ga-goal-table__goal" />
          <col className="ga-goal-table__code" />
          <col />
          {!readOnly && <col className="ga-goal-table__del" />}
        </colgroup>
        <thead>
          <tr>
            <th>Mã MT</th>
            <th>Mục tiêu</th>
            <th>Mã YCCĐ</th>
            <th>Yêu cầu cần đạt</th>
            {!readOnly && <th className="center">Xóa</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((d) => {
            const di = numbered.indexOf(d);
            const cols = readOnly ? 4 : 5;
            const items = readOnly ? d.items.filter((i) => i.text.trim()) : d.items;
            return (
              <Fragment key={d.id}>
                <tr id={readOnly ? undefined : `goal-domain-${d.id}`}>
                  <td colSpan={cols} className="ga-goal-table__domain">
                    <div className="ga-goal-table__pad row row--between">
                      <div className="row gap-2">
                        <DomainTitle name={d.name} />
                        {domainHasProblem(d) && <AlertTriangle size={16} className="text-danger" aria-label="Có lỗi cần sửa" />}
                      </div>
                      {readOnly ? (
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => editDomain(d.id)}>
                          <Pencil size={16} className="text-primary" aria-hidden /> Sửa lĩnh vực này
                        </button>
                      ) : (
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
                      )}
                    </div>
                    {!readOnly && !isStandardDomain(d.name) && (
                      <div className="ga-goal-table__pad">
                        <Notice tone="warn">
                          Lĩnh vực này không thuộc 5 lĩnh vực của Chương trình GDMN. Chuyển các mục tiêu sang lĩnh vực phù hợp rồi xóa lĩnh
                          vực này.
                        </Notice>
                      </div>
                    )}
                  </td>
                </tr>
                {items.length === 0 && (
                  <tr>
                    <td>
                      <div className="ga-goal-table__pad muted">—</div>
                    </td>
                    <td>
                      {readOnly ? (
                        <div className="ga-goal-table__pad muted">Chưa có mục tiêu.</div>
                      ) : (
                        cellInput({
                          'aria-label': `Mục tiêu đầu tiên lĩnh vực ${d.name}`,
                          placeholder: 'Nhập mục tiêu',
                          value: '',
                          onChange: (e) => addFirstGoal(di, [e.target.value]),
                          onKeyDown: (e) => enterKey(e) && e.preventDefault(),
                          onPaste: (e) => {
                            const lines = pastedLines(e);
                            if (!lines.length) return;
                            e.preventDefault();
                            addFirstGoal(di, lines);
                          },
                        })
                      )}
                    </td>
                    <td />
                    <td />
                    {!readOnly && <td />}
                  </tr>
                )}
                {items.map((it) => {
                  const ii = d.items.indexOf(it);
                  const reqs = readOnly ? it.requirements.filter((r) => r.text.trim()) : it.requirements;
                  const span = Math.max(reqs.length, 1);
                  const goalCode = (
                    <td rowSpan={span}>
                      <div className="ga-goal-table__pad">
                        <span className="ga-goal-code">{it.code}</span>
                      </div>
                    </td>
                  );
                  const goalText = (
                    <td rowSpan={span}>
                      {readOnly ? (
                        <div className="ga-goal-table__pad">{it.text}</div>
                      ) : (
                        cellInput({
                          'data-focus': it.id,
                          'aria-label': `Mục tiêu ${it.code} lĩnh vực ${d.name}`,
                          placeholder: 'Nhập mục tiêu',
                          value: it.text,
                          onChange: (e) => updateItem(di, ii, e.target.value),
                          onPaste: (e) => onItemPaste(di, ii, e),
                          onKeyDown: (e) => {
                            if (!enterKey(e)) return;
                            e.preventDefault();
                            // Chỉ tạo mục tiêu mới khi mục tiêu hiện tại đã có nội dung.
                            if (it.text.trim()) insertItemAfter(di, ii);
                          },
                        })
                      )}
                    </td>
                  );
                  const goalDelete = !readOnly && (
                    <td rowSpan={span} className="center">
                      <div className="ga-goal-table__pad">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removeItem(di, ii)}
                          aria-label={`Xóa mục tiêu ${it.code}`}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    </td>
                  );
                  if (reqs.length === 0)
                    return (
                      <tr key={it.id}>
                        {goalCode}
                        {goalText}
                        <td>
                          <div className="ga-goal-table__pad muted">—</div>
                        </td>
                        <td>
                          {readOnly ? (
                            <div className="ga-goal-table__pad muted text-sm">Chưa có YCCĐ</div>
                          ) : (
                            it.text.trim() &&
                            cellInput({
                              'aria-label': `Yêu cầu cần đạt đầu tiên của ${it.code}`,
                              placeholder: 'Nhập YCCĐ, Enter để xuống dòng YCCĐ mới (dán được nhiều dòng)',
                              value: '',
                              onChange: (e) => insertRequirementsAfter(di, ii, null, [e.target.value]),
                              onKeyDown: (e) => enterKey(e) && e.preventDefault(),
                              onPaste: (e) => {
                                const lines = pastedLines(e);
                                if (!lines.length) return;
                                e.preventDefault();
                                insertRequirementsAfter(di, ii, null, lines);
                              },
                            })
                          )}
                        </td>
                        {goalDelete}
                      </tr>
                    );
                  return reqs.map((r, ri) => (
                    <tr key={r.id}>
                      {ri === 0 && goalCode}
                      {ri === 0 && goalText}
                      <td>
                        <div className="ga-goal-table__pad">
                          <span className="ga-goal-code">{r.code}</span>
                        </div>
                      </td>
                      <td>
                        {readOnly ? (
                          <div className="ga-goal-table__pad">{r.text}</div>
                        ) : (
                          <div className="ga-goal-line__text">
                            {cellInput({
                              'data-focus': r.id,
                              'aria-label': `Yêu cầu cần đạt ${r.code}`,
                              placeholder: 'Nhập YCCĐ',
                              value: r.text,
                              onChange: (e) => updateRequirement(di, ii, r.id, { text: e.target.value }),
                              onPaste: (e) => onRequirementPaste(di, ii, r, e),
                              onKeyDown: (e) => {
                                if (!enterKey(e)) return;
                                e.preventDefault();
                                // Chỉ xuống dòng YCCĐ mới khi YCCĐ hiện tại đã có nội dung.
                                if (r.text.trim()) insertRequirementsAfter(di, ii, r.id);
                              },
                            })}
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => removeRequirement(di, ii, r.id)}
                              aria-label={`Xóa YCCĐ ${r.code}`}
                            >
                              <Trash2 size={16} aria-hidden />
                            </button>
                          </div>
                        )}
                      </td>
                      {ri === 0 && goalDelete}
                    </tr>
                  ));
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="page">
      <div className="ga-sticky-head">
        <PageHead
          crumbs={[
            { label: 'Kế hoạch giáo dục' },
            { label: 'Mục tiêu năm học', to: '/education/goals' },
            { label: existing ? 'Chỉnh sửa' : 'Tạo mục tiêu' },
          ]}
          title={existing ? 'Chỉnh sửa mục tiêu năm học' : 'Tạo mục tiêu năm học'}
        />
        <Stepper steps={STEPS} current={step} maxReached={maxReached} onStep={(i) => i <= maxReached && setStep(i)} />
        {step === 1 && (
          <Card
            title="Mục tiêu theo lĩnh vực phát triển"
            num="2"
            bodyClass={null}
            actions={
              <div className="row">
                <span className="muted text-xs nowrap" style={{ marginRight: 8 }}>
                  {totalGoals} mục tiêu
                </span>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => exportGoalsCsv(numbered, `muc-tieu-nam-hoc-${form.schoolYear.replace(/\s/g, '')}.csv`)}
                >
                  <FileDown size={16} aria-hidden /> Xuất file
                </button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} aria-hidden /> Nhập file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  aria-label="Chọn file CSV mục tiêu năm học"
                  onChange={(e) => importCsv(e.target.files?.[0])}
                />
                <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setImporting(true)}>
                  <Download size={16} aria-hidden /> Lấy từ bộ mục tiêu có sẵn
                </button>
              </div>
            }
            className="ga-sticky-bar"
          />
        )}
      </div>

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
        <Card bodyClass={null}>
          <div className="card__body">
            {errors.domains && (
              <div className="mb-16">
                <Notice tone="err">{errors.domains}</Notice>
              </div>
            )}
            {renderTable(numbered)}
          </div>
        </Card>
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
        <>
          <Card title="Duyệt lại nội dung" num="3">
            <dl className="info-list">
              <dt>Tên bộ mục tiêu</dt>
              <dd className="fw-600">{form.title}</dd>
              <dt>Năm học</dt>
              <dd>{form.schoolYear}</dd>
              <dt>Nhóm tuổi áp dụng</dt>
              <dd>{ageName}</dd>
              <dt>Ngày lập</dt>
              <dd>{fmtDate(new Date().toISOString())}</dd>
            </dl>
            <div className="ga-divider" />
            {renderTable(numbered, true)}
          </Card>
          <div className="mt-16">
            <Card title="Ký xác nhận">
              <div className="review-sign">
                <div style={{ flex: 1 }}>
                  <div className="subsection-title">Chữ ký người lập (Phó hiệu trưởng)</div>
                  <SignaturePicker
                    value={form.signature?.data || null}
                    onChange={({ url }) => set({ signature: url ? { type: 'saved', data: url } : null })}
                    error={errors.signature}
                  />
                </div>
              </div>
            </Card>
          </div>
        </>
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
