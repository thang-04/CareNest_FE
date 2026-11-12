import { useEffect, useLayoutEffect, useState } from 'react';
import { Check, Pencil, Save, Trash2, X } from '@/components/ui/icons';
import { Card, Notice, PageHead } from '@/components/education-plan/eduUi';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { STANDARD_DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { DOMAIN_ROMAN } from '@/models/education-plan/goalTable';
import { DEFAULT_WORKFLOW_POLICY, WORKFLOW_ROLES, CREATOR_ROLES, REVIEWER_ROLES, SIGN_DOCS } from '@/models/education-plan/eduConfig';
import { moveItem } from '@/hooks/useSortableList';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { RenumberButton, SortButtons, SortHandle, SortIndex, SortableList, SortableRow } from '@/components/ui/Sortable';

/**
 * Cấu hình người tạo và người duyệt của từng loại tài liệu (FR-001, FR-002, AC-01).
 * Chỉ Hiệu trưởng mới có quyền thay đổi. Phân tách rõ Người tạo và Người duyệt, cấm trùng lặp vai trò.
 */
function WorkflowPolicyConfig({ docLabel, policy, onChange, editing, canEdit, askDelete, toast, mode }) {
  const creators = policy?.creators || [];
  const reviewers = policy?.reviewers || [];
  const addRole = (role, kind) => {
    if (!role) return;
    if (kind === 'creator') {
      onChange({ creators: [role], reviewers: reviewers.filter((r) => r !== role) });
      return;
    }
    if (creators.includes(role) || reviewers.includes(role)) return;
    onChange({ creators, reviewers: [...reviewers, role] });
  };
  const removeRole = (role, kind) => {
    const current = kind === 'creator' ? creators : reviewers;
    if (current.length <= 1) {
      toast(`Mỗi loại hồ sơ phải có ít nhất một người ${kind === 'creator' ? 'soạn' : 'duyệt'}.`, 'warn');
      return;
    }
    askDelete({
      title: `Bỏ ${WORKFLOW_ROLES[role] || role} khỏi danh sách?`,
      message: `Thay đổi cấu hình ${docLabel} có hiệu lực khi bấm Lưu.`,
      confirmLabel: 'Bỏ vai trò',
      run: () =>
        onChange(
          kind === 'creator'
            ? { creators: creators.filter((r) => r !== role), reviewers }
            : { creators, reviewers: reviewers.filter((r) => r !== role) },
        ),
    });
  };
  const availableCreators = CREATOR_ROLES.filter((role) => !creators.includes(role) && !reviewers.includes(role));
  const availableReviewers = REVIEWER_ROLES.filter((role) => !reviewers.includes(role) && !creators.includes(role));
  const editable = editing && canEdit;

  return (
    <div className="ga-goal-table__pad ga-workflow-cell">
      {mode === 'creator' && (
        <div className="ga-workflow-roles" aria-label={`Người tạo hồ sơ ${docLabel}`}>
          {!editable ? (
            <div className="ga-workflow-role-row">
              <span>{WORKFLOW_ROLES[creators[0]] || creators[0] || 'Chưa cấu hình'}</span>
            </div>
          ) : (
            <label className="ga-workflow-add">
              <span className="sr-only">Chọn người tạo cho {docLabel}</span>
              <select className="select" value={creators[0] || ''} onChange={(event) => addRole(event.target.value, 'creator')}>
                <option value="" disabled>
                  -- Chọn đúng 1 vai trò tạo --
                </option>
                {CREATOR_ROLES.filter((r) => !reviewers.includes(r)).map((role) => (
                  <option key={role} value={role}>
                    {WORKFLOW_ROLES[role]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {mode === 'reviewer' && (
        <div className="ga-workflow-roles ga-workflow-roles--reviewers" aria-label={`Người duyệt hồ sơ ${docLabel}`}>
          <SortableList
            overlayClassName="ga-sortable-overlay"
            ids={reviewers}
            onMove={(from, to) => onChange({ creators, reviewers: moveItem(reviewers, from, to) })}
            labelOf={(index) => WORKFLOW_ROLES[reviewers[index]]}
            disabled={!editable}
          >
            {reviewers.map((role, index) => (
              <SortableRow key={role} id={role} as="div" className="ga-workflow-role-row">
                <span className="ga-workflow-reviewer-order">{index + 1}.</span>
                {editable && <SortHandle label={WORKFLOW_ROLES[role]} />}
                <span className="ga-workflow-role-name">{WORKFLOW_ROLES[role] || role}</span>
                {editable && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Bỏ ${WORKFLOW_ROLES[role]} khỏi người duyệt`}
                    onClick={() => removeRole(role, 'reviewer')}
                  >
                    <X size={16} aria-hidden />
                  </button>
                )}
              </SortableRow>
            ))}
          </SortableList>
          {editable && availableReviewers.length > 0 && (
            <label className="ga-workflow-add">
              <span className="sr-only">Thêm người duyệt cho {docLabel}</span>
              <select className="select" value="" onChange={(event) => addRole(event.target.value, 'reviewer')}>
                <option value="">+ Thêm người duyệt</option>
                {availableReviewers.map((role) => (
                  <option key={role} value={role}>
                    {WORKFLOW_ROLES[role]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Cấu hình kế hoạch giáo dục của trường (Phó HT, Hiệu trưởng): tên hiển thị 5 lĩnh vực, người ký theo từng loại tài liệu,
 * các dòng hoạt động của kế hoạch tuần. Bấm Chỉnh sửa để nhập và lưu một lần cho cả trang.
 * Lưu và xóa theo quy tắc trang kế hoạch năm: nút Lưu đầu trang / Ctrl+S, hỏi khi rời trang còn thay đổi chưa lưu,
 * xóa một mục phải xác nhận.
 */
export default function EduConfigPage() {
  const { eduConfig, saveEduConfig, saveWorkflowPolicy, toast } = useEducationPlan();
  const isPrincipal = eduConfig.canConfigure === true;
  const [draft, setDraft] = useState(eduConfig);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Tab') setKeyboardNavigation(true);
    };
    const onPointer = () => setKeyboardNavigation(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, []);
  // Dòng tuần vừa thêm: chuyển con trỏ sang ngay sau khi vẽ, trước phím gõ tiếp theo (gõ nhanh, bộ gõ tiếng Việt)
  const [focusRowKey, setFocusRowKey] = useState(null);
  useLayoutEffect(() => {
    if (!focusRowKey) return;
    const i = draft.weekRows.findIndex((r) => r.key === focusRowKey);
    const el = document.querySelector(`[aria-label="Tên hoạt động ${i + 1}"]`);
    el?.focus({ preventScroll: true });
    el?.setSelectionRange?.(el.value.length, el.value.length);
    setFocusRowKey(null);
  }, [focusRowKey, draft.weekRows]);

  const saver = useManualSave({
    doc: editing ? draft : null,
    enabled: editing,
    save: async (doc) => {
      let workflowPolicy = doc.workflowPolicy;
      let workflowRevision = doc.workflowRevision;
      if (JSON.stringify(doc.workflowPolicy) !== JSON.stringify(eduConfig.workflowPolicy)) {
        const workflowSaved = await saveWorkflowPolicy(doc);
        if (!workflowSaved) return null;
        workflowPolicy = workflowSaved.workflowPolicy;
        workflowRevision = workflowSaved.workflowRevision;
        setDraft((current) => ({ ...current, workflowPolicy, workflowRevision }));
      }
      const submitted = { ...doc, workflowPolicy, workflowRevision };
      const res = await saveEduConfig(submitted);
      if (!res) return null;
      const savedDoc = {
        ...res,
        workflowPolicy: res.workflowPolicy || workflowPolicy,
        workflowRevision: res.workflowRevision ?? workflowRevision,
      };
      // Đồng bộ bản đang xem với mốc đã lưu, nhưng giữ thao tác mới phát sinh trong lúc chờ server.
      setDraft((current) => (JSON.stringify(current) === JSON.stringify(submitted) ? savedDoc : current));
      toast('Đã lưu cấu hình kế hoạch giáo dục');
      return { doc: savedDoc };
    },
  });
  const dirty = saver.unsaved;
  const guard = useLeaveGuard({ when: editing && dirty, onSave: saver.save });

  useEffect(() => {
    if (!dirty) {
      setDraft(eduConfig);
      saver.markClean(eduConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eduConfig]);

  useEffect(() => {
    setDraft((current) =>
      current.workflowRevision === eduConfig.workflowRevision
        ? current
        : {
            ...current,
            workflowPolicy: eduConfig.workflowPolicy,
            workflowRevision: eduConfig.workflowRevision,
            canConfigure: eduConfig.canConfigure,
          },
    );
  }, [eduConfig.workflowRevision, eduConfig.workflowPolicy, eduConfig.canConfigure]);

  const set = (fn) => setDraft((d) => fn(structuredClone(d)));
  // Lĩnh vực mới: tên là khóa lưu trong kế hoạch năm nên không trùng tên đã có (không phân biệt hoa thường)
  const addDomain = () => {
    const name = newDomain.trim();
    if (!name) return;
    const all = [...STANDARD_DOMAINS, ...draft.extraDomains].map((d) => d.toLowerCase());
    if (all.includes(name.toLowerCase())) {
      setDomainError(`Đã có lĩnh vực "${name}".`);
      return;
    }
    set((x) => ((x.extraDomains = [...x.extraDomains, name]), x));
    setNewDomain('');
    setDomainError('');
  };
  const updateDocWorkflow = (docKey, nextPolicy) => {
    set((x) => {
      if (!x.workflowPolicy) x.workflowPolicy = structuredClone(DEFAULT_WORKFLOW_POLICY);
      x.workflowPolicy[docKey] = nextPolicy;
      if (docKey === 'theme' && x.workflowPolicy.week) {
        x.workflowPolicy.week = nextPolicy;
      }
      return x;
    });
  };
  const yesNo = (on, label) =>
    on ? (
      <Check size={16} className="text-success" aria-label={`${label}: có`} />
    ) : (
      <span className="muted" aria-label={`${label}: không`}>
        —
      </span>
    );

  return (
    <div
      className={`page ga-page ga-config-page ga-class-editor ga-year-page${editing ? ' is-editing' : ' is-viewing'}${keyboardNavigation ? ' ga-keyboard-nav' : ''}`}
    >
      <div className="ga-sticky-head">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Cấu hình' }]} title="Cấu hình kế hoạch giáo dục" />
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác cấu hình kế hoạch giáo dục">
          {!editing && (
            <div className="ga-year-toolbar__group">
              <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setEditing(true)}>
                <Pencil size={16} aria-hidden /> Chỉnh sửa
              </button>
            </div>
          )}
          {editing && (
            <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
              <p className="muted text-sm ga-year-save-status" aria-live="polite">
                {saver.label}
              </p>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={saver.save}
                disabled={saver.saving || (!dirty && !saver.error)}
                title="Lưu (Ctrl+S)"
              >
                <Save size={16} aria-hidden /> Lưu
              </button>
            </div>
          )}
        </div>
      </div>

      <Card title="1. Thời lượng chủ đề / chủ đề nhánh" bodyClass={null}>
        <div className="card__body stack">
          {eduConfig.durationPolicyAvailable === false && (
            <Notice>Máy chủ hiện chưa hỗ trợ cấu hình thời lượng. Các cấu hình hiện có vẫn sử dụng bình thường.</Notice>
          )}
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <thead>
                <tr>
                  <th className={editing ? 'cell--fixed' : ''}>Loại chủ đề</th>
                  <th
                    className={
                      editing ? (isPrincipal && eduConfig.durationPolicyAvailable !== false ? 'ga-th-editable' : 'cell--fixed') : ''
                    }
                  >
                    Tối thiểu (tuần)
                  </th>
                  <th
                    className={
                      editing ? (isPrincipal && eduConfig.durationPolicyAvailable !== false ? 'ga-th-editable' : 'cell--fixed') : ''
                    }
                  >
                    Tối đa (tuần)
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['theme', 'Chủ đề lớn'],
                  ['branch', 'Chủ đề nhánh'],
                ].map(([key, label]) => (
                  <tr key={key}>
                    <td className={editing ? 'cell--fixed' : ''}>
                      <div className="ga-goal-table__pad ga-cell-text">{label}</div>
                    </td>
                    {['minWeeks', 'maxWeeks'].map((bound) => (
                      <td
                        key={bound}
                        className={
                          editing ? (isPrincipal && eduConfig.durationPolicyAvailable !== false ? 'ga-cell-editable' : 'cell--fixed') : ''
                        }
                      >
                        {editing && isPrincipal && eduConfig.durationPolicyAvailable !== false ? (
                          <input
                            className="ga-cell-input"
                            type="number"
                            min="1"
                            step="1"
                            aria-label={`${label} ${bound === 'minWeeks' ? 'tối thiểu' : 'tối đa'}`}
                            value={draft.durationPolicy?.[key]?.[bound] ?? ''}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                durationPolicy: {
                                  ...d.durationPolicy,
                                  [key]: { ...d.durationPolicy[key], [bound]: Number(e.target.value) },
                                },
                              }))
                            }
                          />
                        ) : (
                          <div className="ga-goal-table__pad ga-cell-text">{draft.durationPolicy?.[key]?.[bound] ?? '—'}</div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <Card title="2. Lĩnh vực giáo dục" bodyClass={null}>
        <div className="card__body stack">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-goal-table__del" />
                <col />
                {editing && <col className="ga-goal-table__del" />}
              </colgroup>
              <thead>
                <tr>
                  <th className={`ga-stt${editing ? ' cell--fixed' : ''}`}>STT</th>
                  <th className={editing ? 'ga-th-editable' : ''}>Tên lĩnh vực</th>
                  {editing && <th className="center ga-th-editable">Xóa</th>}
                </tr>
              </thead>
              <tbody>
                {[...STANDARD_DOMAINS, ...draft.extraDomains].map((d, i) => {
                  const extra = i >= STANDARD_DOMAINS.length;
                  return (
                    <tr key={d}>
                      <td className={`ga-stt${editing ? ' cell--fixed' : ''}`}>
                        <div className="ga-goal-table__pad">{DOMAIN_ROMAN[i] || i + 1}</div>
                      </td>
                      <td className={editing ? 'ga-cell-editable' : ''}>
                        {/* Tên hiển thị gõ thẳng; để trống thì dùng lại tên gốc */}
                        <Cell
                          editable={editing}
                          value={draft.domainLabels[d] || d}
                          label={`Tên lĩnh vực ${DOMAIN_ROMAN[i] || i + 1}`}
                          placeholder={d}
                          onChange={(v) => set((x) => ((x.domainLabels[d] = v.trim() === d ? '' : v), x))}
                        />
                      </td>
                      {editing && (
                        <td className="center ga-cell-editable">
                          <div className="ga-goal-table__pad">
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              aria-label={`Xóa lĩnh vực ${d}`}
                              onClick={() =>
                                extra
                                  ? setConfirmDelete({
                                      title: `Xóa lĩnh vực "${d}"?`,
                                      message: 'Kế hoạch năm học lập mới sẽ không còn lĩnh vực này. Thay đổi có hiệu lực khi bấm Lưu.',
                                      confirmLabel: 'Xóa lĩnh vực',
                                      run: () => set((x) => ((x.extraDomains = x.extraDomains.filter((y) => y !== d)), x)),
                                    })
                                  : toast('Lĩnh vực theo Chương trình Giáo dục mầm non, không xóa được (đổi tên thì được).', 'warn')
                              }
                            >
                              <Trash2 size={16} aria-hidden />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {editing && (
                  <tr>
                    <td className="cell--fixed" />
                    <td colSpan={2} className="ga-cell-editable">
                      <Cell
                        editable
                        value={newDomain}
                        label="Thêm lĩnh vực"
                        placeholder="Nhập tên lĩnh vực mới rồi Enter"
                        onChange={(v) => setNewDomain(v.replace(/\n/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          addDomain();
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {domainError && <Notice tone="err">{domainError}</Notice>}
        </div>
      </Card>

      <Card title="3. Người tạo/duyệt" bodyClass={null}>
        <div className="card__body stack gap-2">
          {editing && !isPrincipal && <Notice tone="info">Chỉ Hiệu trưởng mới có quyền thay đổi cấu hình người tạo và người duyệt.</Notice>}
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table ga-sortable-table">
              <thead>
                <tr>
                  <th className={`ga-workflow-row-heading${editing ? ' cell--fixed' : ''}`} scope="col">
                    &nbsp;
                  </th>
                  {SIGN_DOCS.filter((doc) => doc.key !== 'week').map((doc) => {
                    const canEditDoc = isPrincipal && (doc.key !== 'schoolYear' || eduConfig.durationPolicyAvailable !== false);
                    return (
                      <th key={doc.key} scope="col" className={editing ? (canEditDoc ? 'ga-th-editable' : 'cell--fixed') : ''}>
                        {doc.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'creator', label: 'Người tạo (soạn thảo)' },
                  { key: 'reviewer', label: 'Người duyệt (theo thứ tự)' },
                ].map((row) => (
                  <tr key={row.key}>
                    <th className={`ga-workflow-row-heading${editing ? ' cell--fixed' : ''}`} scope="row">
                      {row.label}
                    </th>
                    {SIGN_DOCS.filter((doc) => doc.key !== 'week').map((doc) => {
                      const policy = draft.workflowPolicy?.[doc.key] ||
                        DEFAULT_WORKFLOW_POLICY[doc.key] || { creators: [], reviewers: draft.signers?.[doc.key] || [] };
                      const canEditDoc = isPrincipal && (doc.key !== 'schoolYear' || eduConfig.durationPolicyAvailable !== false);
                      return (
                        <td key={doc.key} className={editing ? (canEditDoc ? 'ga-cell-editable' : 'cell--fixed') : ''}>
                          {row.key === 'creator' ? (
                            <WorkflowPolicyConfig
                              docKey={doc.key}
                              docLabel={doc.label}
                              policy={policy}
                              onChange={(next) => updateDocWorkflow(doc.key, { ...policy, ...next })}
                              editing={editing}
                              canEdit={isPrincipal && (doc.key !== 'schoolYear' || eduConfig.durationPolicyAvailable !== false)}
                              askDelete={setConfirmDelete}
                              toast={toast}
                              mode="creator"
                            />
                          ) : (
                            <WorkflowPolicyConfig
                              docKey={doc.key}
                              docLabel={doc.label}
                              policy={policy}
                              onChange={(next) => updateDocWorkflow(doc.key, { ...policy, ...next })}
                              editing={editing}
                              canEdit={isPrincipal && (doc.key !== 'schoolYear' || eduConfig.durationPolicyAvailable !== false)}
                              askDelete={setConfirmDelete}
                              toast={toast}
                              mode="reviewer"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card title="4. Các dòng hoạt động của kế hoạch tuần" bodyClass={null}>
        <div className="card__body stack">
          <div className="table-wrap">
            <SortableList
              overlayClassName="ga-sortable-overlay"
              ids={draft.weekRows.map((r) => r.key)}
              onMove={(from, to) => set((x) => ((x.weekRows = moveItem(x.weekRows, from, to)), x))}
              labelOf={(i) => draft.weekRows[i]?.label}
              disabled={!editing}
            >
              <table className="table ga-plan-table ga-goal-table ga-sortable-table" onMouseDown={focusCell}>
                <colgroup>
                  <col className="ga-col-stt" />
                  <col />
                  <col className="ga-col-flag" />
                  <col className="ga-col-flag" />
                  {editing && <col className="ga-goal-table__sort" />}
                  {editing && <col className="ga-goal-table__del" />}
                </colgroup>
                <thead>
                  <tr>
                    <th className={`ga-stt${editing ? ' cell--fixed' : ''}`}>
                      <span className="stt-head">STT {editing && <RenumberButton />}</span>
                    </th>
                    <th className={editing ? 'ga-th-editable' : ''}>Tên hoạt động{editing && <span className="req">*</span>}</th>
                    <th className={`center ${editing ? 'ga-th-editable' : ''}`}>Cho gộp cả tuần</th>
                    <th className={`center ${editing ? 'ga-th-editable' : ''}`}>Mặc định cả tuần</th>
                    {editing && <th className="center ga-th-editable">Sắp xếp</th>}
                    {editing && <th className="center ga-th-editable">Xóa</th>}
                  </tr>
                </thead>
                <tbody>
                  {draft.weekRows.map((r, i) => (
                    <SortableRow key={r.key} id={r.key}>
                      <td className={`ga-stt${editing ? ' cell--fixed' : ''}`}>
                        <div className="ga-goal-table__pad">
                          <SortIndex id={r.key} index={i} />
                        </div>
                      </td>
                      <td className={editing ? 'ga-cell-editable' : ''}>
                        <Cell
                          editable={editing}
                          value={r.label}
                          label={`Tên hoạt động ${i + 1}`}
                          onChange={(v) => set((x) => ((x.weekRows[i].label = v), x))}
                        />
                      </td>
                      <td className={`center${editing ? ' ga-cell-editable' : ''}`}>
                        <div className="ga-goal-table__pad">
                          {!editing ? (
                            yesNo(r.canMerge, 'Cho gộp cả tuần')
                          ) : (
                            <input
                              type="checkbox"
                              aria-label={`Cho gộp cả tuần: ${r.label}`}
                              checked={r.canMerge}
                              onChange={(e) =>
                                set((x) => ((x.weekRows[i].canMerge = e.target.checked), (x.weekRows[i].allWeek &&= e.target.checked), x))
                              }
                            />
                          )}
                        </div>
                      </td>
                      <td className={`center${editing ? ' ga-cell-editable' : ''}`}>
                        <div className="ga-goal-table__pad">
                          {!editing ? (
                            yesNo(r.allWeek, 'Mặc định cả tuần')
                          ) : (
                            <input
                              type="checkbox"
                              aria-label={`Mặc định cả tuần: ${r.label}`}
                              checked={r.allWeek}
                              // Chọn "mặc định cả tuần" thì dòng đó cũng được gộp
                              onChange={(e) =>
                                set((x) => ((x.weekRows[i].allWeek = e.target.checked), (x.weekRows[i].canMerge ||= e.target.checked), x))
                              }
                            />
                          )}
                        </div>
                      </td>
                      {editing && (
                        <td className="center ga-cell-editable">
                          <div className="ga-goal-table__pad ga-sort-cell">
                            <SortHandle label={r.label} />
                            <SortButtons index={i} label={r.label} />
                          </div>
                        </td>
                      )}
                      {editing && (
                        <td className="center ga-cell-editable">
                          <div className="ga-goal-table__pad">
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              aria-label={`Xóa dòng ${r.label}`}
                              title="Xóa dòng"
                              onClick={() =>
                                r.key === 'hoc'
                                  ? toast('Không xóa được dòng Hoạt động học vì kế hoạch ngày dùng dòng này (môn, đề tài).', 'warn')
                                  : setConfirmDelete({
                                      title: `Xóa dòng "${r.label}"?`,
                                      message: 'Kế hoạch tuần lập mới sẽ không còn dòng hoạt động này. Thay đổi có hiệu lực khi bấm Lưu.',
                                      confirmLabel: 'Xóa dòng',
                                      run: () => set((x) => ((x.weekRows = x.weekRows.filter((y) => y.key !== r.key)), x)),
                                    })
                              }
                            >
                              <Trash2 size={16} aria-hidden />
                            </button>
                          </div>
                        </td>
                      )}
                    </SortableRow>
                  ))}
                  {editing && (
                    <tr>
                      <td className="cell--fixed" />
                      <td colSpan={5} className="ga-cell-editable">
                        <Cell
                          editable
                          value=""
                          label="Thêm dòng hoạt động"
                          placeholder="Nhập tên hoạt động mới (ví dụ: Ăn, ngủ, vệ sinh)"
                          onChange={(v) => {
                            const key = `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
                            set((x) => ((x.weekRows = [...x.weekRows, { key, label: v, canMerge: true, allWeek: false }]), x));
                            setFocusRowKey(key);
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </SortableList>
          </div>
        </div>
      </Card>

      <ConfirmationModal
        open={!!confirmDelete}
        danger
        title={confirmDelete?.title}
        message={confirmDelete?.message}
        confirmLabel={confirmDelete?.confirmLabel}
        onConfirm={() => {
          confirmDelete.run();
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}
