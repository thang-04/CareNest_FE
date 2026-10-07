import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronsDownUp, ChevronsUpDown, Download, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, DOMAIN_SHORT, EDU_STATUS, SCHOOL_SCOPE, allGoalItems, prefixOf } from '@/models/education-plan/educationPlanConstants';
import { Card, EmptyState, Field, Modal, Notice, PageHead, SignatureBox, Stepper, fmtDate } from '@/components/education-plan/eduUi';
import { Group, useCollapse } from '@/components/education-plan/PlanWidgets';
import { PickGoalsModal, ImportThemeRowsModal } from '@/components/education-plan/ThemeModals';
import { ThemeTable, BranchList } from '@/components/education-plan/themeShared';

const STEPS = ['Thông tin chung', 'Mục tiêu và nội dung', 'Xác nhận và ký'];
const uid = () => Math.random().toString(36).slice(2, 9);

const toDate = (iso) => new Date(iso + 'T00:00:00Z');
const addDays = (iso, n) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (iso) => addDays(iso, -((toDate(iso).getUTCDay() + 6) % 7));

/** Splits the theme period into Monday–Friday weeks, keeping branch names already typed. */
function buildBranches(start, end, old = []) {
  if (!start || !end || end < start) return [];
  const out = [];
  let s = mondayOf(start);
  let i = 1;
  while (s <= end && i <= 12) {
    out.push({ index: i, start: s, end: addDays(s, 4), name: old[i - 1]?.name || '' });
    s = addDays(s, 7);
    i++;
  }
  return out;
}

/** Requirement code: domain prefix + goal position within the domain + running number (e.g. TC1.2). */
function makeCode(goal, goalCode, rows) {
  const d = goal.domains.find((x) => x.items.some((i) => i.code === goalCode));
  if (!d) return goalCode;
  const idx = d.items.findIndex((i) => i.code === goalCode) + 1;
  const base = `${prefixOf(d.name)}${idx}.`;
  const used = rows.filter((r) => r.code.startsWith(base)).map((r) => Number(r.code.slice(base.length)) || 0);
  return `${base}${(used.length ? Math.max(...used) : 0) + 1}`;
}

export default function ThemeFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { themes, goals, user, schoolYear, saveTheme, toast, historyEntry } = useEducationPlan();
  const navigate = useNavigate();
  const existing = themes.find((t) => t.id === id);
  const goal = goals.find((g) => g.ageGroupId === user.ageGroupId && g.schoolYear === schoolYear && g.status === EDU_STATUS.SENT);
  const ageName = AGE_GROUPS.find((a) => a.id === user.ageGroupId)?.name;

  const [form, setForm] = useState(() =>
    existing
      ? { ...existing, signature: null, branches: existing.branches || [], rows: existing.rows || [] }
      : { name: '', startDate: '', endDate: '', branches: [], rows: [], note: '', signature: null },
  );
  const [step, setStep] = useState(() => (existing && params.get('buoc') === 'ky' ? 2 : 0));
  const [maxReached, setMaxReached] = useState(existing ? 2 : 0);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removeRow, setRemoveRow] = useState(null);
  const listRef = useRef(null);
  const [justAdded, setJustAdded] = useState(null);
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
    const el = listRef.current.querySelector(`[data-row="${justAdded}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector('textarea')?.focus({ preventScroll: true });
    setJustAdded(null);
  }, [justAdded]);

  if (!goal)
    return (
      <div className="page">
        <PageHead crumbs={[{ label: 'Kế hoạch chủ đề', to: '/education/themes' }, { label: 'Tạo kế hoạch' }]} title="Tạo kế hoạch chủ đề" />
        <Card>
          <EmptyState
            title="Chưa có mục tiêu năm học cho nhóm tuổi"
            desc="Kế hoạch chủ đề được lập từ mục tiêu năm học. Chờ Phó hiệu trưởng gửi mục tiêu năm học cho nhóm tuổi của bạn."
            action={
              <Link className="btn" to="/education/themes">
                Về danh sách
              </Link>
            }
          />
        </Card>
      </div>
    );

  const goalItems = allGoalItems(goal);
  const domainsInGoal = goal.domains.map((d) => d.name);
  const rowsByDomain = domainsInGoal
    .map((d) => ({ domain: d, rows: form.rows.filter((r) => r.domain === d) }))
    .concat([{ domain: 'Khác', rows: form.rows.filter((r) => !domainsInGoal.includes(r.domain)) }])
    .filter((g) => g.rows.length);

  const setDates = (patch) => {
    const startDate = patch.startDate ?? form.startDate;
    const endDate = patch.endDate ?? form.endDate;
    set({ ...patch, branches: buildBranches(startDate, endDate, form.branches) });
  };

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.name.trim()) e.name = 'Nhập tên chủ đề';
      if (!form.startDate) e.startDate = 'Chọn ngày bắt đầu';
      if (!form.endDate) e.endDate = 'Chọn ngày kết thúc';
      if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
      const overlap = themes.find(
        (t) =>
          t.id !== form.id &&
          t.ageGroupId === user.ageGroupId &&
          t.status !== EDU_STATUS.REJECTED &&
          form.startDate &&
          form.endDate &&
          t.startDate <= form.endDate &&
          form.startDate <= t.endDate,
      );
      if (!e.endDate && overlap)
        e.endDate = `Trùng thời gian với chủ đề “${overlap.name}” (${fmtDate(overlap.startDate)} – ${fmtDate(overlap.endDate)})`;
    }
    if (s === 1) {
      if (!form.rows.length) e.rows = 'Thêm ít nhất một mục tiêu cho chủ đề';
      else if (form.rows.some((r) => !r.requirement.trim())) e.rows = 'Có mục tiêu chưa nhập “Yêu cầu cần đạt”.';
    }
    if (s === 2 && !form.signature) e.signature = 'Ký xác nhận trước khi gửi Phó hiệu trưởng';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    const n = step + 1;
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
  };

  const build = (status) => {
    const seq = themes.filter((t) => t.ageGroupId === user.ageGroupId).length + 1;
    return {
      id: form.id || `t-${uid()}`,
      code: form.code || `CD-MGN-${String(seq).padStart(2, '0')}`,
      schoolYear,
      ageGroupId: user.ageGroupId,
      goalId: goal.id,
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      weeks: form.branches.length,
      branches: form.branches.map((b) => ({ ...b, name: b.name.trim() || `Tuần ${b.index}` })),
      rows: form.rows,
      note: form.note,
      signature: form.signature,
      status,
      createdBy: user.name,
      history: form.history || [],
    };
  };

  const saveDraft = () => {
    if (!form.name.trim()) {
      setStep(0);
      validate(0);
      return;
    }
    const item = build(existing?.status === EDU_STATUS.REJECTED ? EDU_STATUS.REJECTED : EDU_STATUS.DRAFT);
    saveTheme(item);
    toast('Đã lưu nháp kế hoạch chủ đề');
    navigate(`/education/themes/${item.id}`);
  };

  const submit = () => {
    const item = build(EDU_STATUS.PENDING_VP);
    item.history = [
      ...item.history,
      historyEntry(existing?.status === EDU_STATUS.REJECTED ? 'Chỉnh sửa và gửi duyệt lại' : 'Tạo và gửi duyệt'),
    ];
    saveTheme(item);
    setConfirm(false);
    toast('Đã gửi kế hoạch chủ đề cho Phó hiệu trưởng');
    navigate(`/education/themes/${item.id}`);
  };

  const addRowsFromGoals = (goalCodes) => {
    const rows = [...form.rows];
    let lastId = null;
    goalCodes.forEach((gc) => {
      const gi = goalItems.find((g) => g.code === gc);
      const r = {
        id: uid(),
        goalCode: gc,
        code: makeCode(goal, gc, rows),
        domain: gi.domain,
        requirement: '',
        content: '',
        method: '',
        form: '',
        environment: '',
        adjust: '',
      };
      rows.push(r);
      lastId = r.id;
    });
    set({ rows });
    setPicking(false);
    if (lastId) setJustAdded(lastId);
  };

  const addSibling = (r) => {
    const n = { ...r, id: uid(), code: makeCode(goal, r.goalCode, form.rows), requirement: '', content: '', adjust: '' };
    const i = form.rows.findIndex((x) => x.id === r.id);
    const rows = [...form.rows];
    rows.splice(i + 1, 0, n);
    set({ rows });
    setJustAdded(n.id);
  };

  const importRows = (srcRows, source) => {
    const rows = [...form.rows];
    let added = 0;
    srcRows.forEach((sr) => {
      if (rows.some((r) => r.requirement.trim() === sr.requirement.trim())) return;
      // Keep the source goal only if it exists in this age group's goals; otherwise attach to the first goal of the same domain.
      const gc = goalItems.some((g) => g.code === sr.goalCode && g.domain === sr.domain)
        ? sr.goalCode
        : goalItems.find((g) => g.domain === sr.domain)?.code;
      if (!gc) return;
      rows.push({ ...sr, id: uid(), goalCode: gc, code: makeCode(goal, gc, rows), adjust: '' });
      added++;
    });
    set({ rows });
    setImporting(false);
    toast(added ? `Đã thêm ${added} mục tiêu từ ${source.code}` : 'Các mục tiêu đã chọn đều đã có, không thêm mới');
  };

  const updateRow = (rid, patch) => set({ rows: form.rows.map((r) => (r.id === rid ? { ...r, ...patch } : r)) });
  const groupIds = rowsByDomain.map((g) => g.domain);
  const allCollapsed = groupIds.length > 0 && groupIds.every((g) => col.isCollapsed(g));
  const lastReject = existing?.status === EDU_STATUS.REJECTED && [...(existing.history || [])].reverse().find((h) => h.tone === 'err');

  return (
    <div className={`page ${step === 1 ? 'ga-page-fill' : ''}`}>
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          { label: 'Kế hoạch chủ đề', to: '/education/themes' },
          { label: existing ? 'Chỉnh sửa' : 'Tạo kế hoạch' },
        ]}
        title={existing ? 'Chỉnh sửa kế hoạch chủ đề' : 'Tạo kế hoạch chủ đề'}
      />
      {lastReject && step !== 1 && (
        <div className="mb-16">
          <Notice tone="err">
            <span className="fw-600">Phó hiệu trưởng đã từ chối:</span> {lastReject.note}
          </Notice>
        </div>
      )}
      <Stepper steps={STEPS} current={step} maxReached={maxReached} onStep={(i) => i <= maxReached && setStep(i)} />

      {step === 0 && (
        <Card title="Thông tin chung" num="1">
          <div className="grid-2">
            <Field label="Năm học" inline>
              <input className="input" value={schoolYear} readOnly />
            </Field>
            <Field label="Phạm vi áp dụng" inline>
              <input className="input" value={SCHOOL_SCOPE} readOnly />
            </Field>
            <Field label="Nhóm tuổi" inline>
              <input className="input" value={ageName} readOnly />
            </Field>
            <Field label="Người lập" inline>
              <input className="input" value={`${user.name} (${user.title})`} readOnly />
            </Field>
            <Field label="Ngày bắt đầu" required inline error={errors.startDate} htmlFor="sd">
              <input
                id="sd"
                type="date"
                className={`input ${errors.startDate ? 'is-invalid' : ''}`}
                value={form.startDate}
                onChange={(e) => setDates({ startDate: e.target.value })}
              />
            </Field>
            <Field label="Ngày kết thúc" required inline error={errors.endDate} htmlFor="ed">
              <input
                id="ed"
                type="date"
                className={`input ${errors.endDate ? 'is-invalid' : ''}`}
                value={form.endDate}
                onChange={(e) => setDates({ endDate: e.target.value })}
              />
            </Field>
          </div>
          <div className="stack mt-16">
            <Field label="Tên chủ đề" required inline error={errors.name} htmlFor="name" counter={`${form.name.length}/100`}>
              <input
                id="name"
                className={`input ${errors.name ? 'is-invalid' : ''}`}
                maxLength={100}
                placeholder="Ví dụ: Bé vui đến trường"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <div className="form-row form-row--top">
              <span className="form-row__label">Chủ đề nhánh</span>
              <div className="form-row__control">
                {form.branches.length === 0 ? (
                  <p className="muted text-xs" style={{ paddingTop: 9 }}>
                    Chọn ngày bắt đầu và kết thúc để chia tuần.
                  </p>
                ) : (
                  <div className="ga-branch-list">
                    {form.branches.map((b, i) => (
                      <div key={b.index} className="ga-branch-row">
                        <span className="fw-600">Tuần {b.index}</span>
                        <span className="muted text-xs">
                          {fmtDate(b.start).slice(0, 5)} – {fmtDate(b.end).slice(0, 5)}
                        </span>
                        <input
                          className="input"
                          aria-label={`Chủ đề nhánh tuần ${b.index}`}
                          placeholder={`Ví dụ: ${['Trường mầm non thân yêu', 'Lớp học của bé', 'Cô giáo và các bạn'][i % 3]}`}
                          value={b.name}
                          onChange={(e) =>
                            set({ branches: form.branches.map((x) => (x.index === b.index ? { ...x, name: e.target.value } : x)) })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Field label="Ghi chú" inline top htmlFor="note" counter={`${(form.note || '').length}/300`}>
              <textarea
                id="note"
                className="textarea"
                maxLength={300}
                placeholder="Sự kiện, ngày lễ trong thời gian thực hiện chủ đề"
                value={form.note || ''}
                onChange={(e) => set({ note: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card
          title="Mục tiêu và nội dung giáo dục"
          num="2"
          className="ga-card-fill"
          bodyClass={null}
          actions={
            <div className="row">
              <span className="muted text-xs" style={{ marginRight: 8 }}>
                {form.rows.length} mục tiêu
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
              <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setImporting(true)}>
                <Download size={16} aria-hidden /> Lấy từ kế hoạch có sẵn
              </button>
              <button type="button" className="btn btn--sm btn--primary" onClick={() => setPicking(true)}>
                <Plus size={16} aria-hidden /> Thêm mục tiêu
              </button>
            </div>
          }
        >
          <div className="card__body ga-card-scroll" ref={listRef}>
            {errors.rows && (
              <div className="mb-16">
                <Notice tone="err">{errors.rows}</Notice>
              </div>
            )}
            {form.rows.length === 0 && (
              <EmptyState
                title="Chưa có mục tiêu nào"
                desc="Chọn mục tiêu từ mục tiêu năm học, mỗi mục tiêu được cấp mã YCCĐ (ví dụ TC1.1) để giáo viên gắn vào kế hoạch tuần và ngày."
                action={
                  <button type="button" className="btn btn--outline-primary" onClick={() => setPicking(true)}>
                    <Plus size={16} aria-hidden /> Thêm mục tiêu
                  </button>
                }
              />
            )}
            {rowsByDomain.map((g) => (
              <Group
                key={g.domain}
                id={g.domain}
                collapsed={col.isCollapsed(g.domain)}
                onToggle={() => col.toggle(g.domain)}
                title={<h3>{DOMAIN_SHORT[g.domain] || g.domain}</h3>}
                meta={`${g.rows.length} mục tiêu`}
              >
                {g.rows.map((r) => {
                  const gi = goalItems.find((x) => x.code === r.goalCode);
                  return (
                    <div key={r.id} className="ga-plan-row" data-row={r.id}>
                      <div className="ga-plan-row__head">
                        <span className="chip chip--blue ga-code-chip">{r.code}</span>
                        <span className="muted text-xs ga-plan-row__goal" title={gi?.text}>
                          Mục tiêu năm học {r.goalCode}: {gi?.text}
                        </span>
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => addSibling(r)}>
                          <Plus size={16} aria-hidden className="text-primary" /> Thêm yêu cầu cùng mục tiêu
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Xóa mục tiêu ${r.code}`}
                          onClick={() => (r.requirement.trim() ? setRemoveRow(r) : set({ rows: form.rows.filter((x) => x.id !== r.id) }))}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                      <div className="ga-plan-grid">
                        <Field label="Yêu cầu cần đạt" required htmlFor={`req-${r.id}`}>
                          <textarea
                            id={`req-${r.id}`}
                            className={`textarea ${errors.rows && !r.requirement.trim() ? 'is-invalid' : ''}`}
                            rows={2}
                            placeholder="Trẻ …"
                            value={r.requirement}
                            onChange={(e) => updateRow(r.id, { requirement: e.target.value })}
                          />
                        </Field>
                        <Field label="Nội dung giáo dục" htmlFor={`ct-${r.id}`}>
                          <textarea
                            id={`ct-${r.id}`}
                            className="textarea"
                            rows={2}
                            placeholder="Nội dung tổ chức cho trẻ"
                            value={r.content}
                            onChange={(e) => updateRow(r.id, { content: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="ga-plan-grid-3">
                        <Field label="Phương pháp" htmlFor={`pp-${r.id}`}>
                          <input
                            id={`pp-${r.id}`}
                            className="input"
                            placeholder="Trực quan, thực hành, trò chơi…"
                            value={r.method}
                            onChange={(e) => updateRow(r.id, { method: e.target.value })}
                          />
                        </Field>
                        <Field label="Hình thức" htmlFor={`ht-${r.id}`}>
                          <input
                            id={`ht-${r.id}`}
                            className="input"
                            placeholder="Cá nhân, nhóm, cả lớp"
                            value={r.form}
                            onChange={(e) => updateRow(r.id, { form: e.target.value })}
                          />
                        </Field>
                        <Field label="Môi trường" htmlFor={`mt-${r.id}`}>
                          <input
                            id={`mt-${r.id}`}
                            className="input"
                            placeholder="Đồ dùng, không gian"
                            value={r.environment}
                            onChange={(e) => updateRow(r.id, { environment: e.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </Group>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="ga-split ga-split--wide">
          <Card title="Duyệt lại nội dung" num="3">
            <dl className="info-list">
              <dt>Tên chủ đề</dt>
              <dd className="fw-600">{form.name}</dd>
              <dt>Nhóm tuổi</dt>
              <dd>{ageName}</dd>
              <dt>Phạm vi</dt>
              <dd>{SCHOOL_SCOPE}</dd>
              <dt>Thời gian</dt>
              <dd>
                {fmtDate(form.startDate)} – {fmtDate(form.endDate)} ({form.branches.length} tuần)
              </dd>
            </dl>
            <div className="ga-divider" />
            <div className="section-title">Chủ đề nhánh</div>
            <BranchList branches={form.branches} />
            <div className="ga-divider" />
            <div className="section-title">Mục tiêu và nội dung ({form.rows.length})</div>
            <ThemeTable rows={form.rows} />
          </Card>
          <div className="stack">
            <Card title="Chữ ký tổ trưởng">
              <SignatureBox value={form.signature} onChange={(signature) => set({ signature })} invalid={!!errors.signature} />
              {errors.signature && <div className="field__error mt-8">{errors.signature}</div>}
            </Card>
            <Notice>
              Kế hoạch được gửi Phó hiệu trưởng phê duyệt. Sau khi duyệt, giáo viên {ageName} ở toàn trường xem được và gắn mã YCCĐ vào kế
              hoạch tuần, ngày.
            </Notice>
          </div>
        </div>
      )}

      <div className="page-actions">
        <button type="button" className="btn" onClick={() => navigate(existing ? `/education/themes/${existing.id}` : '/education/themes')}>
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
              <Send size={16} aria-hidden /> Gửi Phó hiệu trưởng
            </button>
          )}
        </div>
      </div>

      {picking && <PickGoalsModal goal={goal} rows={form.rows} onClose={() => setPicking(false)} onPick={addRowsFromGoals} />}
      {importing && (
        <ImportThemeRowsModal
          themes={themes}
          excludeId={form.id}
          defaultAgeGroupId={user.ageGroupId}
          onClose={() => setImporting(false)}
          onImport={importRows}
        />
      )}

      {removeRow && (
        <Modal
          title={`Xóa mục tiêu ${removeRow.code}?`}
          onClose={() => setRemoveRow(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setRemoveRow(null)}>
                Giữ lại
              </button>
              <button
                type="button"
                className="btn btn--outline-danger"
                onClick={() => {
                  set({ rows: form.rows.filter((x) => x.id !== removeRow.id) });
                  setRemoveRow(null);
                }}
              >
                <Trash2 size={16} aria-hidden /> Xóa mục tiêu
              </button>
            </>
          }
        >
          <p>{removeRow.requirement}</p>
          <p className="muted text-xs">Nội dung, phương pháp đã nhập của mục tiêu này sẽ bị xóa khỏi kế hoạch đang soạn.</p>
        </Modal>
      )}

      {confirm && (
        <Modal
          title="Gửi kế hoạch chủ đề"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setConfirm(false)}>
                Quay lại kiểm tra
              </button>
              <button type="button" className="btn btn--primary" onClick={submit}>
                <Send size={16} aria-hidden /> Gửi Phó hiệu trưởng
              </button>
            </>
          }
        >
          <p>
            Gửi kế hoạch chủ đề <span className="fw-600">{form.name}</span> cho Phó hiệu trưởng phê duyệt? Bạn không chỉnh sửa được khi kế
            hoạch đang chờ duyệt.
          </p>
        </Modal>
      )}
    </div>
  );
}
