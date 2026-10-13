import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Pencil, Plus, Save, Send, Stamp, Trash2, Undo2 } from '@/components/ui/icons';
import {
  Card,
  EduStatusBadge,
  EmptyState,
  Field,
  History,
  Modal,
  Notice,
  PageHead,
  SignatureBox,
  SignatureView,
  fmtDate,
  fmtDateTime,
} from '@/components/education-plan/eduUi';
import { AiButton, AiDraftPanel, CellText } from '@/components/education-plan/planUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useAsync } from '@/hooks/useAsync';
import { getUsers } from '@/services/masterDataService';
import { ROLES } from '@/models/User';
import { AGE_GROUPS } from '@/models/School';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import {
  ROW_TYPE_LABELS,
  isEditableStatus,
  newId,
  numberedGoals,
  themeGoalLabel,
  themeWeekCount,
  yearWeeks,
} from '@/models/education-plan/yearPlanModel';

const TABS = [
  { key: 'goals', label: 'A. Mục tiêu, nội dung giáo dục' },
  { key: 'themes', label: 'B. Chủ đề, sự kiện trong năm' },
  { key: 'sign', label: 'Ký và lịch sử' },
];

/** Kế hoạch giáo dục năm học của một khối, theo mẫu Trường MN Thái Dương. */
export default function YearPlanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { yearPlans, user, savePlanDoc, actOnPlanDoc, deleteYearPlan, toast } = useEducationPlan();
  const plan = yearPlans.find((p) => p.id === id);
  const usersQ = useAsync(() => getUsers(), []);
  const [draft, setDraft] = useState(plan);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('goals');
  const [modal, setModal] = useState(null);

  // Nạp lại bản lưu khi đổi kế hoạch hoặc khi trạng thái đổi (gửi, ban hành) mà chưa có sửa dở.
  useEffect(() => {
    if (!dirty) setDraft(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, plan?.status, plan?.history?.length]);

  if (!plan || !draft) {
    return (
      <div className="page">
        <PageHead
          crumbs={[{ label: 'Kế hoạch năm học', to: '/education/year-plans' }, { label: 'Không tìm thấy' }]}
          title="Không tìm thấy kế hoạch"
        />
        <EmptyState title="Kế hoạch không tồn tại hoặc bạn không có quyền xem" />
      </div>
    );
  }

  const group = AGE_GROUPS.find((g) => g.id === plan.ageGroupId);
  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  const isLeader = user.role === ROLES.TEAM_LEADER && user.ageGroupId === plan.ageGroupId;
  const editable = isEditableStatus(plan.status) && (isVp || isLeader);
  const users = usersQ.data || [];
  const nameOf = (uid) => users.find((u) => u.id === uid)?.fullName || '—';
  const builders = users.filter(
    (u) => u.role === ROLES.VICE_PRINCIPAL || (u.role === ROLES.TEAM_LEADER && u.ageGroupId === plan.ageGroupId),
  );

  const change = (fn) => {
    setDraft((d) => fn(d));
    setDirty(true);
  };
  const save = async () => {
    const saved = await savePlanDoc('year', draft);
    if (saved) {
      setDirty(false);
      setDraft(saved);
      toast('Đã lưu kế hoạch');
    }
  };
  const act = async (action, body = {}) => {
    const saved = await actOnPlanDoc('year', plan.id, { action, ...body });
    if (saved) {
      setDraft(saved);
      setModal(null);
      toast(action === 'issue' ? 'Đã ký và ban hành kế hoạch' : action === 'submit' ? 'Đã gửi Phó hiệu trưởng' : 'Đã trả lại kế hoạch');
    }
  };

  return (
    <div className="page">
      <div className="ga-sticky-head">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch năm học', to: '/education/year-plans' }, { label: group?.shortName }]}
          title={`Kế hoạch giáo dục năm học ${plan.schoolYear.replace('-', ' – ')}: ${group?.shortName}`}
          desc={group?.name}
          actions={
            <>
              <EduStatusBadge status={plan.status} />
              {editable && (
                <button type="button" className="btn btn--outline-primary" onClick={save} disabled={!dirty}>
                  <Save size={16} /> {dirty ? 'Lưu thay đổi' : 'Đã lưu'}
                </button>
              )}
              {editable && isLeader && (
                <button type="button" className="btn btn--primary" disabled={dirty} onClick={() => setModal('submit')}>
                  <Send size={16} /> Gửi Phó HT ban hành
                </button>
              )}
              {isVp && plan.status === EDU_STATUS.PENDING_VP && (
                <button type="button" className="btn btn--outline-primary" onClick={() => setModal('reject')}>
                  <Undo2 size={16} /> Trả lại
                </button>
              )}
              {isVp && plan.status === EDU_STATUS.PENDING_VP && (
                <button type="button" className="btn btn--primary" disabled={dirty} onClick={() => setModal('issue')}>
                  <Stamp size={16} /> Ký ban hành
                </button>
              )}
              {isVp && isEditableStatus(plan.status) && (
                <button type="button" className="btn btn--ghost" onClick={() => setModal('delete')}>
                  <Trash2 size={16} /> Xóa
                </button>
              )}
            </>
          }
        />
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {plan.status === EDU_STATUS.APPROVED && (
        <Notice tone="ok">
          Kế hoạch đã ban hành. Các lớp trong khối dùng kế hoạch này để lập chủ đề nhánh, kế hoạch chủ đề và giáo án.
        </Notice>
      )}
      {plan.status === EDU_STATUS.PENDING_VP && !isVp && (
        <Notice>Đã gửi Phó hiệu trưởng ban hành. Nội dung bị khóa cho tới khi ban hành hoặc bị trả lại.</Notice>
      )}

      {tab === 'goals' && (
        <GoalsTab draft={draft} change={change} editable={editable} isVp={isVp} user={user} builders={builders} nameOf={nameOf} />
      )}
      {tab === 'themes' && <ThemesTab draft={draft} change={change} editable={editable} />}
      {tab === 'sign' && <SignTab plan={plan} builders={builders} />}

      {modal === 'submit' && (
        <ActionModal title="Gửi Phó hiệu trưởng ban hành" onClose={() => setModal(null)} onConfirm={({ note }) => act('submit', { note })}>
          <p>Phần bạn xây dựng sẽ được khóa lại cho tới khi Phó hiệu trưởng ký ban hành hoặc trả lại.</p>
        </ActionModal>
      )}
      {modal === 'reject' && (
        <ActionModal
          title="Trả lại kế hoạch"
          requireNote
          onClose={() => setModal(null)}
          onConfirm={({ note }) => act('reject', { note })}
        />
      )}
      {modal === 'issue' && (
        <ActionModal
          title="Ký và ban hành kế hoạch năm học"
          requireSignature
          onClose={() => setModal(null)}
          onConfirm={({ note, signature }) => act('issue', { note, signature })}
        >
          <p>
            Kế hoạch có {numberedGoals(plan).length} mục tiêu, {plan.themes.length} chủ đề,{' '}
            {yearWeeks(plan).filter((w) => w.type === 'week').length} tuần học. Sau khi ban hành, các lớp bắt đầu lập kế hoạch theo kế hoạch
            này.
          </p>
        </ActionModal>
      )}
      {modal === 'delete' && (
        <ActionModal
          title="Xóa bản nháp kế hoạch"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            if (await deleteYearPlan(plan.id)) navigate('/education/year-plans');
          }}
        >
          <p>Bản nháp sẽ bị xóa hẳn.</p>
        </ActionModal>
      )}
    </div>
  );
}

function ActionModal({ title, children, requireNote, requireSignature, onClose, onConfirm }) {
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState(null);
  const [tried, setTried] = useState(false);
  const confirm = () => {
    setTried(true);
    if ((requireNote && !note.trim()) || (requireSignature && !signature)) return;
    onConfirm({ note: note.trim() || undefined, signature });
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" onClick={confirm}>
            Xác nhận
          </button>
        </>
      }
    >
      {children}
      <Field
        label={requireNote ? 'Lý do' : 'Ghi chú'}
        required={requireNote}
        error={tried && requireNote && !note.trim() ? 'Vui lòng ghi lý do' : undefined}
      >
        <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {requireSignature && (
        <Field label="Chữ ký" required>
          <SignatureBox value={signature} onChange={setSignature} invalid={tried && !signature} />
        </Field>
      )}
    </Modal>
  );
}

/* ---------- A. Mục tiêu, nội dung (bảng mục tiêu × chủ đề) ---------- */

function GoalsTab({ draft, change, editable, isVp, user, builders, nameOf }) {
  const [domainFilter, setDomainFilter] = useState('all');
  const [themeFilter, setThemeFilter] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [ai, setAi] = useState(null);
  const numbers = useMemo(() => Object.fromEntries(numberedGoals(draft).map((g) => [g.id, g.no])), [draft]);
  const themes = draft.themes;
  const cols = 3 + themes.length + (editable ? 1 : 0);
  const q = query.trim().toLowerCase();

  const domainEditable = (d) => editable && (isVp || !draft.domainOwners?.[d.id] || draft.domainOwners[d.id] === user.id);

  const updateRows = (domainId, fn) =>
    change((p) => ({ ...p, domains: p.domains.map((d) => (d.id === domainId ? { ...d, rows: fn(d.rows) } : d)) }));
  const patchRow = (domainId, rowId, patch) => updateRows(domainId, (rows) => rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  const patchContent = (domainId, goal, contentId, patch) =>
    patchRow(domainId, goal.id, { contents: goal.contents.map((c) => (c.id === contentId ? { ...c, ...patch } : c)) });
  const toggleTick = (domainId, goal, content, themeId) =>
    patchContent(domainId, goal, content.id, {
      themes: content.themes.includes(themeId) ? content.themes.filter((t) => t !== themeId) : [...content.themes, themeId],
    });
  const addRow = (domainId, type) => {
    const rid = newId(draft.id);
    const row =
      type === 'goal' ? { id: rid, type, text: '', contents: [{ id: `${rid}-c1`, text: '', themes: [] }] } : { id: rid, type, text: '' };
    updateRows(domainId, (rows) => [...rows, row]);
    if (type === 'goal') setEditingId(rid);
  };
  const applyAiGoals = (domainId, items) =>
    updateRows(domainId, (rows) => [
      ...rows,
      ...items.map((it) => {
        const rid = newId(draft.id);
        return {
          id: rid,
          type: 'goal',
          text: it.value.text,
          contents: it.value.contents.map((t, k) => ({ id: `${rid}-c${k + 1}`, text: t, themes: [] })),
        };
      }),
    ]);

  const matches = (g) =>
    (!q || g.text.toLowerCase().includes(q) || g.contents.some((c) => c.text.toLowerCase().includes(q))) &&
    (!themeFilter || g.contents.some((c) => c.themes.includes(themeFilter)));
  const filtering = !!q || !!themeFilter;

  return (
    <Card bodyClass={null}>
      <div className="card__body stack">
        <div className="row row--wrap">
          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={domainFilter === 'all'}
              className={`tab ${domainFilter === 'all' ? 'tab--active' : ''}`}
              onClick={() => setDomainFilter('all')}
            >
              Tất cả
            </button>
            {draft.domains.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={domainFilter === d.id}
                className={`tab ${domainFilter === d.id ? 'tab--active' : ''}`}
                onClick={() => setDomainFilter(d.id)}
              >
                {d.roman}. {d.name.replace('Giáo dục phát triển ', '')}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-bar row row--wrap">
          <input
            className="input"
            placeholder="Tìm mục tiêu, nội dung…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Tìm mục tiêu"
          />
          <select className="select" value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)} aria-label="Lọc theo chủ đề">
            <option value="">Mọi chủ đề</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.abbr}: {t.name}
              </option>
            ))}
          </select>
          {editable && <span className="muted text-sm">Bấm ô chủ đề để tích nội dung sẽ dạy trong chủ đề đó. Bấm bút để sửa chữ.</span>}
        </div>
        {themes.length === 0 && (
          <Notice tone="warn">Chưa có chủ đề. Thêm chủ đề ở thẻ "B. Chủ đề, sự kiện" để tích nội dung vào chủ đề.</Notice>
        )}
      </div>
      <div className="table-wrap">
        <table className="table ga-plan-table table--compact">
          <thead>
            <tr>
              <th rowSpan={2}>STT</th>
              <th rowSpan={2}>Mục tiêu giáo dục năm</th>
              <th rowSpan={2}>Nội dung giáo dục năm</th>
              {themes.length > 0 && <th colSpan={themes.length}>Chủ đề thực hiện</th>}
              {editable && <th rowSpan={2} aria-label="Thao tác" />}
            </tr>
            <tr>
              {themes.map((t) => (
                <th key={t.id} title={t.name}>
                  {t.abbr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.domains
              .filter((d) => domainFilter === 'all' || d.id === domainFilter)
              .map((d) => {
                const canEditDomain = domainEditable(d);
                const goals = d.rows.filter((r) => r.type === 'goal');
                return (
                  <Fragment key={d.id}>
                    <tr>
                      <td colSpan={cols}>
                        <div className="row row--wrap">
                          <span className="fw-600">
                            {d.roman}. {d.name.toUpperCase()}
                          </span>
                          <span className="chip chip--gray">{goals.length} mục tiêu</span>
                          {isVp && editable ? (
                            <select
                              className="select"
                              aria-label={`Người phụ trách lĩnh vực ${d.roman}`}
                              value={draft.domainOwners?.[d.id] || ''}
                              onChange={(e) =>
                                change((p) => ({ ...p, domainOwners: { ...p.domainOwners, [d.id]: e.target.value || undefined } }))
                              }
                            >
                              <option value="">Phụ trách: chưa phân công</option>
                              {builders.map((u) => (
                                <option key={u.id} value={u.id}>
                                  Phụ trách: {u.fullName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="muted text-sm">
                              Phụ trách: {draft.domainOwners?.[d.id] ? nameOf(draft.domainOwners[d.id]) : 'chưa phân công'}
                            </span>
                          )}
                          {canEditDomain && (
                            <>
                              <button type="button" className="btn btn--ghost btn--sm" onClick={() => addRow(d.id, 'sub')}>
                                <Plus size={16} /> Lĩnh vực con
                              </button>
                              <button type="button" className="btn btn--ghost btn--sm" onClick={() => addRow(d.id, 'group')}>
                                <Plus size={16} /> Nhóm kết quả
                              </button>
                              <button type="button" className="btn btn--ghost btn--sm" onClick={() => addRow(d.id, 'goal')}>
                                <Plus size={16} /> Mục tiêu
                              </button>
                              <AiButton onClick={() => setAi(d)}>Gợi ý mục tiêu bằng AI</AiButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {d.rows.map((r) => {
                      if (r.type !== 'goal') {
                        if (filtering) return null;
                        return (
                          <tr key={r.id}>
                            <td colSpan={3 + themes.length}>
                              {canEditDomain ? (
                                <input
                                  className="input"
                                  value={r.text}
                                  placeholder={ROW_TYPE_LABELS[r.type]}
                                  aria-label={ROW_TYPE_LABELS[r.type]}
                                  onChange={(e) => patchRow(d.id, r.id, { text: e.target.value })}
                                />
                              ) : (
                                <span className={r.type === 'sub' ? 'fw-600' : undefined}>
                                  {r.type === 'sub' ? '* ' : '- '}
                                  {r.text}
                                </span>
                              )}
                            </td>
                            {editable && (
                              <td>
                                {canEditDomain && (
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label="Xóa dòng"
                                    onClick={() => updateRows(d.id, (rows) => rows.filter((x) => x.id !== r.id))}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      }
                      if (!matches(r)) return null;
                      const editing = editingId === r.id && canEditDomain;
                      const span = r.contents.length + (editing ? 1 : 0);
                      return (
                        <Fragment key={r.id}>
                          {r.contents.map((c, k) => (
                            <tr key={c.id}>
                              {k === 0 && (
                                <>
                                  <td rowSpan={span} className="fw-600">
                                    {numbers[r.id]}
                                  </td>
                                  <td rowSpan={span}>
                                    {editing ? (
                                      <textarea
                                        className="textarea"
                                        rows={3}
                                        value={r.text}
                                        aria-label={`Mục tiêu ${numbers[r.id]}`}
                                        onChange={(e) => patchRow(d.id, r.id, { text: e.target.value })}
                                      />
                                    ) : (
                                      <CellText text={r.text} empty="Chưa nhập mục tiêu" />
                                    )}
                                  </td>
                                </>
                              )}
                              <td>
                                {editing ? (
                                  <div className="row">
                                    <textarea
                                      className="textarea"
                                      rows={2}
                                      value={c.text}
                                      aria-label={`Nội dung ${k + 1} của mục tiêu ${numbers[r.id]}`}
                                      onChange={(e) => patchContent(d.id, r, c.id, { text: e.target.value })}
                                    />
                                    {r.contents.length > 1 && (
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        aria-label="Xóa nội dung"
                                        onClick={() => patchRow(d.id, r.id, { contents: r.contents.filter((x) => x.id !== c.id) })}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <CellText text={c.text} empty="Chưa nhập nội dung" />
                                )}
                              </td>
                              {themes.map((t) => {
                                const on = c.themes.includes(t.id);
                                return (
                                  <td key={t.id} className="ga-text-right">
                                    {canEditDomain ? (
                                      <label className="checkbox">
                                        <input
                                          type="checkbox"
                                          checked={on}
                                          aria-label={`Dạy nội dung trong chủ đề ${t.name}`}
                                          onChange={() => toggleTick(d.id, r, c, t.id)}
                                        />
                                      </label>
                                    ) : (
                                      on && <Check size={16} aria-label={t.name} />
                                    )}
                                  </td>
                                );
                              })}
                              {editable && k === 0 && (
                                <td rowSpan={span}>
                                  {canEditDomain && (
                                    <div className="row">
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        aria-label={editing ? 'Xong' : 'Sửa mục tiêu'}
                                        onClick={() => setEditingId(editing ? null : r.id)}
                                      >
                                        {editing ? <Check size={16} /> : <Pencil size={16} />}
                                      </button>
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        aria-label="Xóa mục tiêu"
                                        onClick={() => updateRows(d.id, (rows) => rows.filter((x) => x.id !== r.id))}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                          {editing && (
                            <tr>
                              <td colSpan={1 + themes.length}>
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={() =>
                                    patchRow(d.id, r.id, { contents: [...r.contents, { id: newId(r.id), text: '', themes: [] }] })
                                  }
                                >
                                  <Plus size={16} /> Thêm nội dung
                                </button>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {d.rows.length === 0 && (
                      <tr>
                        <td colSpan={cols} className="muted">
                          Chưa có mục tiêu nào trong lĩnh vực này.
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
      <AiDraftPanel
        open={!!ai}
        title={`Gợi ý mục tiêu: ${ai?.name || ''}`}
        type="year-goals"
        context={{ domainKey: ai?.key, ageGroupId: draft.ageGroupId }}
        onClose={() => setAi(null)}
        onApply={(items) => applyAiGoals(ai.id, items)}
        renderValue={(v) => (
          <div className="mt-8">
            <div>{v.text}</div>
            <ul className="muted text-sm">
              {v.contents.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      />
    </Card>
  );
}

/* ---------- B. Chủ đề, sự kiện ---------- */

function ThemesTab({ draft, change, editable }) {
  const totalWeeks = yearWeeks(draft).filter((w) => w.type === 'week').length;
  const patchTheme = (id, patch) => change((p) => ({ ...p, themes: p.themes.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const patchBreak = (i, patch) => change((p) => ({ ...p, breaks: p.breaks.map((b, k) => (k === i ? { ...b, ...patch } : b)) }));
  const removeTheme = (id) =>
    change((p) => ({
      ...p,
      themes: p.themes.filter((t) => t.id !== id),
      domains: p.domains.map((d) => ({
        ...d,
        rows: d.rows.map((r) =>
          r.type === 'goal' ? { ...r, contents: r.contents.map((c) => ({ ...c, themes: c.themes.filter((t) => t !== id) })) } : r,
        ),
      })),
    }));
  const input = (value, onChange, label, type = 'text') =>
    editable ? (
      <input className="input" type={type} value={value || ''} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    ) : type === 'date' ? (
      fmtDate(value)
    ) : (
      value || '—'
    );

  return (
    <div className="stack">
      <Card
        title="Dự kiến kế hoạch chủ đề, sự kiện năm học"
        actions={
          editable && (
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              onClick={() =>
                change((p) => ({
                  ...p,
                  themes: [...p.themes, { id: newId(p.id), abbr: '', name: '', festivals: '', startDate: '', endDate: '', note: '' }],
                }))
              }
            >
              <Plus size={16} /> Thêm chủ đề
            </button>
          )
        }
        bodyClass={null}
      >
        <div className="table-wrap">
          <table className="table ga-plan-table table--compact">
            <thead>
              <tr>
                <th>STT</th>
                <th>Ký hiệu</th>
                <th>Tên chủ đề</th>
                <th>Mục tiêu giáo dục (theo dấu tích ở phần A)</th>
                <th>Ngày lễ hội</th>
                <th>Số tuần</th>
                <th>Từ ngày</th>
                <th>Đến ngày</th>
                <th>Ghi chú</th>
                {editable && <th aria-label="Thao tác" />}
              </tr>
            </thead>
            <tbody>
              {draft.themes.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td>
                  <td>{input(t.abbr, (v) => patchTheme(t.id, { abbr: v }), 'Ký hiệu chủ đề')}</td>
                  <td>{input(t.name, (v) => patchTheme(t.id, { name: v }), 'Tên chủ đề')}</td>
                  <td>{themeGoalLabel(draft, t.id)}</td>
                  <td>{input(t.festivals, (v) => patchTheme(t.id, { festivals: v }), 'Ngày lễ hội')}</td>
                  <td>{themeWeekCount(draft, t)}</td>
                  <td>{input(t.startDate, (v) => patchTheme(t.id, { startDate: v }), 'Từ ngày', 'date')}</td>
                  <td>{input(t.endDate, (v) => patchTheme(t.id, { endDate: v }), 'Đến ngày', 'date')}</td>
                  <td>{input(t.note, (v) => patchTheme(t.id, { note: v }), 'Ghi chú')}</td>
                  {editable && (
                    <td>
                      <button type="button" className="icon-btn" aria-label="Xóa chủ đề" onClick={() => removeTheme(t.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="fw-600">
                  Tổng số tuần học
                </td>
                <td className="fw-600">{totalWeeks}</td>
                <td colSpan={editable ? 4 : 3} />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card
        title="Tuần nghỉ (không tính tuần học)"
        actions={
          editable && (
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              onClick={() => change((p) => ({ ...p, breaks: [...(p.breaks || []), { start: '', end: '', label: '' }] }))}
            >
              <Plus size={16} /> Thêm tuần nghỉ
            </button>
          )
        }
        bodyClass={null}
      >
        <div className="table-wrap">
          <table className="table ga-plan-table table--compact">
            <thead>
              <tr>
                <th>Từ ngày</th>
                <th>Đến ngày</th>
                <th>Nội dung</th>
                {editable && <th aria-label="Thao tác" />}
              </tr>
            </thead>
            <tbody>
              {(draft.breaks || []).map((b, i) => (
                <tr key={i}>
                  <td>{input(b.start, (v) => patchBreak(i, { start: v }), 'Từ ngày', 'date')}</td>
                  <td>{input(b.end, (v) => patchBreak(i, { end: v }), 'Đến ngày', 'date')}</td>
                  <td>{input(b.label, (v) => patchBreak(i, { label: v }), 'Nội dung')}</td>
                  {editable && (
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Xóa tuần nghỉ"
                        onClick={() => change((p) => ({ ...p, breaks: p.breaks.filter((_, k) => k !== i) }))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!draft.breaks?.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    Chưa có tuần nghỉ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Ký và lịch sử ---------- */

function SignTab({ plan, builders }) {
  const signedBy = (uid) => (plan.builders || []).find((b) => b.userId === uid);
  return (
    <div className="ga-split">
      <Card title="Người xây dựng kế hoạch">
        <div className="stack">
          {builders.map((u) => {
            const s = signedBy(u.id);
            return (
              <div key={u.id} className="row row--wrap">
                <div>
                  <div className="fw-600">{u.fullName}</div>
                  <div className="muted text-sm">{u.role === ROLES.VICE_PRINCIPAL ? 'Phó hiệu trưởng' : 'Tổ trưởng'}</div>
                </div>
                {s ? <SignatureView sig={s.sig} name={s.name} /> : <span className="muted">Chưa ký</span>}
                {s && <span className="muted text-sm">{fmtDateTime(s.at)}</span>}
              </div>
            );
          })}
          <div className="ga-divider" />
          <div className="fw-600">Ban hành</div>
          {plan.issued ? (
            <div className="row row--wrap">
              <SignatureView sig={plan.issued.sig} name={plan.issued.name} />
              <span className="muted text-sm">
                {plan.issued.name} · {fmtDateTime(plan.issued.at)}
              </span>
            </div>
          ) : (
            <span className="muted">Chưa ban hành</span>
          )}
        </div>
      </Card>
      <Card title="Lịch sử xử lý">
        <History items={plan.history} />
      </Card>
    </div>
  );
}
