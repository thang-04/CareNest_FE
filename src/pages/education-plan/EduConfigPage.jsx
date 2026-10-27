import { useEffect, useLayoutEffect, useState } from 'react';
import { Check, Pencil, RotateCcw, Save, Trash2, X } from '@/components/ui/icons';
import { Card, Notice, PageHead } from '@/components/education-plan/eduUi';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { STANDARD_DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { DOMAIN_ROMAN } from '@/models/education-plan/goalTable';
import { DEFAULT_EDU_CONFIG, SIGN_DOCS, SIGN_ROLES } from '@/models/education-plan/eduConfig';
import { moveItem } from '@/hooks/useSortableList';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { RenumberButton, SortButtons, SortHandle, SortIndex, SortableList, SortableRow } from '@/components/ui/Sortable';

/** Người ký của một loại tài liệu: thứ tự ký kéo-thả bằng tay nắm. */
function SignerList({ docKey, docLabel, roles, setRoles, toast, editing, askDelete }) {
  if (!editing)
    return roles.map((r, i) => (
      <div key={r} className="fw-600">
        {i + 1}. {SIGN_ROLES[r]}
      </div>
    ));
  return (
    <SortableList ids={roles} onMove={(from, to) => setRoles((l) => moveItem(l, from, to))} labelOf={(i) => SIGN_ROLES[roles[i]]}>
      {roles.map((r, i) => {
        const locked = docKey === 'year' && r === 'VICE_PRINCIPAL';
        return (
          <SortableRow key={r} id={r} as="div" className="ga-signer row gap-1">
            <SortHandle label={SIGN_ROLES[r]} />
            <span className="fw-600 flex-1">
              {i + 1}. {SIGN_ROLES[r]}
            </span>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              aria-label={`Bỏ ${SIGN_ROLES[r]}`}
              title="Bỏ người ký"
              onClick={() =>
                locked
                  ? toast('Phó hiệu trưởng ban hành kế hoạch năm nên luôn là người ký, không bỏ được.', 'warn')
                  : askDelete({
                      title: `Bỏ ${SIGN_ROLES[r]} khỏi người ký?`,
                      message: `${docLabel} sẽ không còn bước ký của ${SIGN_ROLES[r]}. Thay đổi có hiệu lực khi bấm Lưu.`,
                      confirmLabel: 'Bỏ người ký',
                      run: () => setRoles((l) => l.filter((x) => x !== r)),
                    })
              }
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </SortableRow>
        );
      })}
    </SortableList>
  );
}

/**
 * Cấu hình kế hoạch giáo dục của trường (Phó HT, Hiệu trưởng): tên hiển thị 5 lĩnh vực, người ký theo từng loại tài liệu,
 * các dòng hoạt động của kế hoạch tuần. Vào màn ở chế độ xem; bấm "Chỉnh sửa" mới sửa, lưu một lần cho cả trang.
 * Lưu và xóa theo quy tắc trang kế hoạch năm: nút Lưu đầu trang / Ctrl+S, hỏi khi rời trang còn thay đổi chưa lưu,
 * xóa một mục phải xác nhận.
 */
export default function EduConfigPage() {
  const { eduConfig, saveEduConfig, toast } = useEducationPlan();
  const [draft, setDraft] = useState(eduConfig);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
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
      const res = await saveEduConfig(doc);
      if (!res) return null;
      toast('Đã lưu cấu hình kế hoạch giáo dục');
      return true;
    },
  });
  const dirty = saver.unsaved;
  const guard = useLeaveGuard({ when: editing && dirty, onSave: saver.save });

  useEffect(() => {
    if (!editing) setDraft(eduConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eduConfig]);

  const set = (fn) => setDraft((d) => fn(structuredClone(d)));
  const startEditing = () => {
    saver.markClean(draft);
    setEditing(true);
  };
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
  // Hủy / Xong: bỏ mọi thay đổi chưa lưu, về chế độ xem
  const cancel = () => {
    setDraft(eduConfig);
    saver.markClean(null);
    setNewDomain('');
    setDomainError('');
    setEditing(false);
    setConfirmCancel(false);
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
    <div className="page ga-page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Cấu hình' }]}
        title="Cấu hình kế hoạch giáo dục"
        actions={
          editing ? (
            <>
              <span className="muted text-sm">{saver.label}</span>
              <button type="button" className="btn btn--ghost" onClick={() => setDraft(structuredClone(DEFAULT_EDU_CONFIG))}>
                <RotateCcw size={16} aria-hidden /> Khôi phục mặc định
              </button>
              <button type="button" className="btn" onClick={() => (dirty ? setConfirmCancel(true) : cancel())}>
                <X size={16} aria-hidden /> {dirty ? 'Hủy' : 'Xong'}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={saver.save}
                disabled={saver.saving || (!dirty && !saver.error)}
                title="Lưu (Ctrl+S)"
              >
                <Save size={16} aria-hidden /> Lưu
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary" onClick={startEditing}>
              <Pencil size={16} aria-hidden /> Chỉnh sửa
            </button>
          )
        }
      />

      <Card title="1. Lĩnh vực giáo dục" bodyClass={null}>
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
                  <th className="cell--fixed">STT</th>
                  <th>Tên lĩnh vực</th>
                  {editing && <th className="center">Xóa</th>}
                </tr>
              </thead>
              <tbody>
                {[...STANDARD_DOMAINS, ...draft.extraDomains].map((d, i) => {
                  const extra = i >= STANDARD_DOMAINS.length;
                  return (
                    <tr key={d}>
                      <td className="cell--fixed">
                        <div className="ga-goal-table__pad">{DOMAIN_ROMAN[i] || i + 1}</div>
                      </td>
                      <td>
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
                        <td className="center">
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
                    <td colSpan={2}>
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

      <Card title="2. Người ký" bodyClass={null}>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table">
              <thead>
                <tr>
                  {SIGN_DOCS.map((doc) => (
                    <th key={doc.key} className="center">
                      {doc.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {SIGN_DOCS.map((doc) => {
                    const roles = draft.signers[doc.key];
                    const free = Object.keys(SIGN_ROLES).filter((r) => !roles.includes(r));
                    const setRoles = (fn) => set((x) => ((x.signers[doc.key] = fn(x.signers[doc.key])), x));
                    return (
                      <td key={doc.key}>
                        <div className="ga-goal-table__pad stack">
                          {roles.length === 0 && <div className="muted">Chưa có người ký</div>}
                          <SignerList
                            docKey={doc.key}
                            docLabel={doc.label}
                            roles={roles}
                            setRoles={setRoles}
                            toast={toast}
                            editing={editing}
                            askDelete={setConfirmDelete}
                          />
                          {editing && free.length > 0 && (
                            <div>
                              <select
                                className="select"
                                aria-label={`Thêm người ký cho ${doc.label}`}
                                value=""
                                onChange={(e) => e.target.value && setRoles((l) => [...l, e.target.value])}
                              >
                                <option value="">+ Thêm người ký</option>
                                {free.map((r) => (
                                  <option key={r} value={r}>
                                    {SIGN_ROLES[r]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card title="3. Các dòng hoạt động của kế hoạch tuần" bodyClass={null}>
        <div className="card__body stack">
          <div className="table-wrap">
            <SortableList
              ids={draft.weekRows.map((r) => r.key)}
              onMove={(from, to) => set((x) => ((x.weekRows = moveItem(x.weekRows, from, to)), x))}
              labelOf={(i) => draft.weekRows[i]?.label}
              disabled={!editing}
            >
              <table className="table ga-plan-table ga-goal-table ga-sortable-table" onMouseDown={focusCell}>
                <colgroup>
                  <col className="ga-goal-table__del" />
                  <col />
                  <col className="ga-goal-table__code" />
                  <col className="ga-goal-table__code" />
                  {editing && <col className="ga-goal-table__sort" />}
                  {editing && <col className="ga-goal-table__del" />}
                </colgroup>
                <thead>
                  <tr>
                    <th className="cell--fixed">
                      <span className="stt-head">STT {editing && <RenumberButton />}</span>
                    </th>
                    <th>Tên hoạt động</th>
                    <th className="center">Cho gộp cả tuần</th>
                    <th className="center">Mặc định cả tuần</th>
                    {editing && <th className="center">Sắp xếp</th>}
                    {editing && <th className="center">Xóa</th>}
                  </tr>
                </thead>
                <tbody>
                  {draft.weekRows.map((r, i) => (
                    <SortableRow key={r.key} id={r.key}>
                      <td className="cell--fixed">
                        <div className="ga-goal-table__pad">
                          <SortIndex id={r.key} index={i} />
                        </div>
                      </td>
                      <td>
                        <Cell
                          editable={editing}
                          value={r.label}
                          label={`Tên hoạt động ${i + 1}`}
                          onChange={(v) => set((x) => ((x.weekRows[i].label = v), x))}
                        />
                      </td>
                      <td className="center">
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
                      <td className="center">
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
                        <td className="center">
                          <div className="ga-goal-table__pad ga-sort-cell">
                            <SortHandle label={r.label} />
                            <SortButtons index={i} label={r.label} />
                          </div>
                        </td>
                      )}
                      {editing && (
                        <td className="center">
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
                      <td colSpan={5}>
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
        open={confirmCancel}
        danger
        title="Bỏ thay đổi chưa lưu?"
        message="Các thay đổi trong cấu hình sẽ mất và trang trở về chế độ xem."
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Tiếp tục sửa"
        onConfirm={cancel}
        onClose={() => setConfirmCancel(false)}
      />
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
