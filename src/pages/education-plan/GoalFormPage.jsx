import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, Download, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, DOMAINS, EDU_STATUS, SCHOOL_SCOPE } from '@/models/education-plan/educationPlanConstants';
import ImportGoalsModal from '@/components/education-plan/ImportGoalsModal';
import { Card, Field, Modal, Notice, PageHead, SignatureBox, Stepper, fmtDate } from '@/components/education-plan/eduUi';

const suggestTitle = (year, ageGroupId) => {
  const ag = AGE_GROUPS.find((a) => a.id === ageGroupId);
  return ag ? `Mục tiêu giáo dục năm học ${year} nhóm tuổi ${ag.name.split(' (')[0]}` : '';
};

const STEPS = ['Thông tin chung', 'Mục tiêu theo lĩnh vực', 'Xác nhận và ký'];
const uid = () => Math.random().toString(36).slice(2, 9);

const emptyForm = (schoolYear) => ({
  title: '',
  ageGroupId: '',
  schoolYear,
  description: '',
  domains: DOMAINS.map((name) => ({ id: uid(), name, items: [{ id: uid(), text: '' }] })),
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
          domains: existing.domains.map((d) => ({ ...d, id: d.id || uid() })),
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
      else if (form.domains.some((d) => !d.name.trim() && d.items.some((i) => i.text.trim())))
        e.domains = 'Có lĩnh vực chưa đặt tên. Nhập tên lĩnh vực hoặc xóa lĩnh vực đó.';
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
          items: d.items.filter((i) => i.text.trim()).map(({ id: itemId, code, text }) => ({ id: itemId, code, text: text.trim() })),
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
  const addItem = (di) =>
    set({ domains: form.domains.map((d, i) => (i !== di ? d : { ...d, items: [...d.items, { id: uid(), text: '' }] })) });
  const removeItem = (di, ii) =>
    set({ domains: form.domains.map((d, i) => (i !== di ? d : { ...d, items: d.items.filter((_, j) => j !== ii) })) });
  const renameDomain = (di, name) => set({ domains: form.domains.map((d, i) => (i === di ? { ...d, name } : d)) });
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
  const [justAdded, setJustAdded] = useState(null);
  const addDomain = () => {
    const unused = DOMAINS.find((n) => !form.domains.some((d) => d.name === n)) || '';
    const domainId = uid();
    set({ domains: [...form.domains, { id: domainId, name: unused, items: [{ id: uid(), text: '' }] }] });
    setJustAdded(domainId);
  };
  // New domains go to the end of the list: scroll there and focus the name input
  useEffect(() => {
    if (!justAdded || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-domain="${justAdded}"] input`);
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    el?.focus({ preventScroll: true });
    setJustAdded(null);
  }, [justAdded]);
  const deleteDomain = (di) => {
    set({ domains: form.domains.filter((_, i) => i !== di) });
    setRemoveDomain(null);
  };
  const importGoals = (domains, source) => {
    let merged = form.domains.map((d) => ({ ...d, items: [...d.items] }));
    let added = 0;
    domains.forEach((src) => {
      let target = merged.find((d) => d.name.trim().toLowerCase() === src.name.trim().toLowerCase());
      if (!target) {
        target = { id: uid(), name: src.name, items: [] };
        merged.push(target);
      }
      target.items = target.items.filter((i) => i.text.trim());
      src.items.forEach((text) => {
        if (!target.items.some((i) => i.text.trim() === text.trim())) {
          target.items.push({ id: uid(), text });
          added++;
        }
      });
    });
    merged = merged.map((d) => (d.items.length ? d : { ...d, items: [{ id: uid(), text: '' }] }));
    set({ domains: merged });
    setImporting(false);
    toast(added ? `Đã thêm ${added} mục tiêu từ ${source.code}` : 'Các mục tiêu đã chọn đều đã có, không thêm mới');
  };

  const filledDomains = numbered.filter((d) => d.items.some((i) => i.text.trim()));

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
              <button type="button" className="btn btn--sm btn--primary" onClick={addDomain}>
                <Plus size={16} aria-hidden /> Thêm mục tiêu
              </button>
            </div>
          }
        >
          <div className="card__body ga-card-scroll" ref={listRef}>
            {errors.domains && (
              <div className="mb-16">
                <Notice tone="err">{errors.domains}</Notice>
              </div>
            )}
            {numbered.map((d, di) => (
              <div className={`ga-domain ${collapsed.has(d.id) ? 'ga-domain--collapsed' : ''}`} key={d.id} data-domain={d.id}>
                <div className="ga-domain__head">
                  <div className="row" style={{ gap: 6, flex: 1 }}>
                    <button
                      type="button"
                      className="icon-btn ga-domain__toggle"
                      aria-expanded={!collapsed.has(d.id)}
                      aria-label={`${collapsed.has(d.id) ? 'Mở' : 'Thu gọn'} ${d.name || 'lĩnh vực'}`}
                      onClick={() => toggleDomain(d.id)}
                    >
                      <ChevronDown size={18} aria-hidden />
                    </button>
                    <span className="ga-domain__bar" aria-hidden />
                    <input
                      className="input ga-domain__name"
                      list="domain-suggestions"
                      aria-label={`Tên lĩnh vực ${di + 1}`}
                      placeholder="Nhập tên mục tiêu (lĩnh vực)"
                      value={d.name}
                      onChange={(e) => renameDomain(di, e.target.value)}
                    />
                  </div>
                  <div className="row">
                    <span className="muted text-xs">{d.items.filter((i) => i.text.trim()).length} mục tiêu</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Xóa lĩnh vực ${d.name}`}
                      onClick={() => (d.items.some((i) => i.text.trim()) ? setRemoveDomain(di) : deleteDomain(di))}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                </div>
                {!collapsed.has(d.id) && (
                  <div className="ga-domain__body">
                    {d.items.map((it, ii) => (
                      <div className="ga-goal-row" key={it.id}>
                        <span className="ga-goal-code">{it.code || '—'}</span>
                        <input
                          className="input"
                          aria-label={`Mục tiêu ${ii + 1} lĩnh vực ${d.name}`}
                          placeholder="Nhập nội dung mục tiêu"
                          value={it.text}
                          onChange={(e) => updateItem(di, ii, e.target.value)}
                        />
                        <button type="button" className="icon-btn" onClick={() => removeItem(di, ii)} aria-label="Xóa mục tiêu">
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    ))}
                    <div>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => addItem(di)}>
                        <Plus size={16} className="text-primary" aria-hidden /> Thêm mục tiêu con
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <datalist id="domain-suggestions">
              {DOMAINS.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
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
            {filledDomains.map((d) => (
              <div key={d.name} className="mb-16">
                <div className="section-title">{d.name}</div>
                {d.items
                  .filter((i) => i.text.trim())
                  .map((i) => (
                    <div key={i.id} className="ga-goal-row ga-goal-row--read">
                      <span className="ga-goal-code">{i.code}</span>
                      <span>{i.text}</span>
                    </div>
                  ))}
              </div>
            ))}
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
