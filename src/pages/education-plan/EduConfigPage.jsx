import { ResponsiveToolbar } from '@/components/ui/ResponsiveToolbar';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Check, Pencil, RotateCcw, Save, Trash2, X } from '@/components/ui/icons';
import { Card, Notice, PageHead } from '@/components/education-plan/eduUi';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { DOMAIN_ROMAN } from '@/models/education-plan/goalTable';
import { resetEduConfig } from '@/models/education-plan/eduConfig';
import { moveItem } from '@/hooks/useSortableList';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { RenumberButton, SortHandle, SortIndex, SortableList, SortableRow } from '@/components/ui/Sortable';
import { Button } from '@/components';

/**
 * Cấu hình kế hoạch giáo dục của trường: tên hiển thị 5 lĩnh vực, thời lượng, dòng hoạt động.
 * Người soạn/duyệt từng loại hồ sơ ở tab Soạn / duyệt hồ sơ của trang Phân quyền (EDU-108).
 * các dòng hoạt động của kế hoạch tuần. Bấm Chỉnh sửa để nhập và lưu một lần cho cả trang.
 * Lưu và xóa theo quy tắc trang kế hoạch năm: nút Lưu đầu trang / Ctrl+S, hỏi khi rời trang còn thay đổi chưa lưu,
 * xóa một mục phải xác nhận.
 */
export default function EduConfigPage() {
  const { eduConfig, saveEduConfig, toast } = useEducationPlan();
  const isPrincipal = eduConfig.canConfigure === true;
  const [draft, setDraft] = useState(eduConfig);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');
  const [editing, setEditing] = useState(false);
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
      const { workflowPolicy, workflowRevision } = doc;
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
    const all = [...draft.standardDomains, ...draft.extraDomains].map((d) => d.toLowerCase());
    if (all.includes(name.toLowerCase())) {
      setDomainError(`Đã có lĩnh vực "${name}".`);
      return;
    }
    set((x) => ((x.extraDomains = [...x.extraDomains, name]), x));
    setNewDomain('');
    setDomainError('');
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
    <div className={`page ga-page ga-config-page ga-class-editor ga-year-page${editing ? ' is-editing' : ' is-viewing'}`}>
      <div className="ga-sticky-head">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Cấu hình' }]} title="Cấu hình kế hoạch giáo dục" />
        <ResponsiveToolbar className="ga-year-toolbar" role="group" aria-label="Thao tác cấu hình kế hoạch giáo dục">
          {editing && isPrincipal && (
            <div className="ga-year-toolbar__group">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() =>
                  setConfirmDelete({
                    title: 'Khôi phục mặc định',
                    message:
                      'Toàn bộ cấu hình (thời lượng, lĩnh vực, người tạo/duyệt, dòng kế hoạch tuần) sẽ về mặc định. Bấm Lưu để áp dụng.',
                    confirmLabel: 'Khôi phục',
                    run: () => setDraft((d) => resetEduConfig(d)),
                  })
                }
              >
                <RotateCcw size={16} aria-hidden /> Khôi phục mặc định
              </Button>
            </div>
          )}
          {/* Chỉnh sửa / Hủy cùng một chỗ, Lưu đứng sau (Tiền 13/11/2026) */}
          <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
            {editing && (
              <p className="muted text-sm ga-year-save-status" aria-live="polite">
                {saver.label}
              </p>
            )}
            {editing ? (
              <Button
                variant="outline-primary"
                size="sm"
                disabled={saver.saving}
                onClick={() => {
                  const run = () => {
                    saver.discardBackup?.();
                    setDraft(saver.cleanDoc?.() || eduConfig);
                    setEditing(false);
                  };
                  if (dirty)
                    setConfirmDelete({
                      title: 'Hủy chỉnh sửa',
                      message: 'Các thay đổi chưa lưu sẽ bị bỏ.',
                      confirmLabel: 'Hủy chỉnh sửa',
                      run,
                    });
                  else run();
                }}
              >
                <X size={16} aria-hidden /> Hủy
              </Button>
            ) : (
              <Button variant="outline-primary" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={16} aria-hidden /> Chỉnh sửa
              </Button>
            )}
            {editing && (
              <Button
                variant="primary"
                size="sm"
                onClick={saver.save}
                disabled={saver.saving || (!dirty && !saver.error)}
                title="Lưu (Ctrl+S)"
              >
                <Save size={16} aria-hidden /> Lưu
              </Button>
            )}
          </div>
        </ResponsiveToolbar>
      </div>

      <Card title="1. Thời lượng chủ đề / chủ đề nhánh" bodyClass={null}>
        <div className="card__body stack">
          {eduConfig.durationPolicyAvailable === false && (
            <Notice tone="info">Máy chủ hiện chưa hỗ trợ cấu hình thời lượng. Các cấu hình hiện có vẫn sử dụng bình thường.</Notice>
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
                {[...draft.standardDomains, ...draft.extraDomains].map((d, i) => {
                  const extra = i >= draft.standardDomains.length;
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
                        <td className="cell--actions ga-cell-editable">
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
          {domainError && <Notice>{domainError}</Notice>}
        </div>
      </Card>

      <Card title="3. Các dòng hoạt động của kế hoạch tuần" bodyClass={null}>
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
                  {editing && <col className="ga-col-row-actions" />}
                </colgroup>
                <thead>
                  <tr>
                    <th className={`ga-stt${editing ? ' cell--fixed' : ''}`}>
                      <span className="stt-head">STT {editing && <RenumberButton />}</span>
                    </th>
                    <th className={editing ? 'ga-th-editable' : ''}>Tên hoạt động{editing && <span className="req">*</span>}</th>
                    <th className={`center ${editing ? 'ga-th-editable' : ''}`}>Cho gộp cả tuần</th>
                    <th className={`center ${editing ? 'ga-th-editable' : ''}`}>Mặc định cả tuần</th>
                    {editing && <th className="cell--actions ga-th-editable">Thao tác</th>}
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
                        // Một ô Thao tác: kéo xếp + xóa (Tiền 25/11/2026)
                        <td className="cell--actions ga-cell-editable">
                          <div className="ga-goal-table__pad ga-sort-cell">
                            <SortHandle label={r.label} />
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
                      <td colSpan={4} className="ga-cell-editable">
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
