import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw, Save, Trash2 } from '@/components/ui/icons';
import { Card, Notice, PageHead } from '@/components/education-plan/eduUi';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { STANDARD_DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { DOMAIN_ROMAN } from '@/models/education-plan/goalTable';
import { DEFAULT_EDU_CONFIG, SIGN_DOCS, SIGN_ROLES } from '@/models/education-plan/eduConfig';

// Đổi thứ tự; ở hai đầu thì đưa vòng sang đầu bên kia để mọi nút sắp xếp đều bấm được
const move = (list, i, d) => {
  const next = [...list];
  const [item] = next.splice(i, 1);
  const j = i + d;
  if (j < 0) next.push(item);
  else if (j > list.length - 1) next.unshift(item);
  else next.splice(j, 0, item);
  return next;
};

/**
 * Cấu hình kế hoạch giáo dục của trường (Phó HT, Hiệu trưởng): tên hiển thị 5 lĩnh vực, người ký theo từng loại tài liệu,
 * các dòng hoạt động của kế hoạch tuần. Dạng bảng như các màn kế hoạch; lưu một lần cho cả trang.
 */
export default function EduConfigPage() {
  const { eduConfig, saveEduConfig, toast } = useEducationPlan();
  const [draft, setDraft] = useState(eduConfig);
  const [dirty, setDirty] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');

  useEffect(() => {
    if (!dirty) setDraft(eduConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eduConfig]);

  const set = (fn) => {
    setDraft((d) => fn(structuredClone(d)));
    setDirty(true);
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
  const save = async () => {
    const res = await saveEduConfig(draft);
    if (res) {
      setDirty(false);
      toast('Đã lưu cấu hình kế hoạch giáo dục');
    }
  };

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Cấu hình' }]}
        title="Cấu hình kế hoạch giáo dục"
        actions={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setDraft(structuredClone(DEFAULT_EDU_CONFIG));
                setDirty(true);
              }}
            >
              <RotateCcw size={16} aria-hidden /> Khôi phục mặc định
            </button>
            <button type="button" className="btn btn--primary" disabled={!dirty} onClick={save}>
              <Save size={16} aria-hidden /> {dirty ? 'Lưu cấu hình' : 'Đã lưu'}
            </button>
          </>
        }
      />

      <Card title="1. Lĩnh vực giáo dục" bodyClass={null}>
        <div className="card__body stack">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-goal-table__del" />
                <col />
                <col className="ga-goal-table__del" />
              </colgroup>
              <thead>
                <tr>
                  <th className="ga-goal-table__fixed">STT</th>
                  <th>Tên lĩnh vực</th>
                  <th className="center">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {[...STANDARD_DOMAINS, ...draft.extraDomains].map((d, i) => {
                  const extra = i >= STANDARD_DOMAINS.length;
                  return (
                    <tr key={d}>
                      <td className="ga-goal-table__fixed">
                        <div className="ga-goal-table__pad">{DOMAIN_ROMAN[i] || i + 1}</div>
                      </td>
                      <td>
                        {/* Tên hiển thị gõ thẳng; để trống thì dùng lại tên gốc */}
                        <Cell
                          editable
                          value={draft.domainLabels[d] || d}
                          label={`Tên lĩnh vực ${DOMAIN_ROMAN[i] || i + 1}`}
                          placeholder={d}
                          onChange={(v) => set((x) => ((x.domainLabels[d] = v.trim() === d ? '' : v), x))}
                        />
                      </td>
                      <td className="center">
                        <div className="ga-goal-table__pad">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Xóa lĩnh vực ${d}`}
                            onClick={() =>
                              extra
                                ? set((x) => ((x.extraDomains = x.extraDomains.filter((y) => y !== d)), x))
                                : toast('Lĩnh vực theo Chương trình Giáo dục mầm non, không xóa được (đổi tên thì được).', 'warn')
                            }
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="ga-goal-table__fixed" />
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
                          {roles.map((r, i) => {
                            const locked = doc.key === 'year' && r === 'VICE_PRINCIPAL';
                            return (
                              <div key={r} className="row gap-1">
                                <span className="fw-600" style={{ flex: 1 }}>
                                  {i + 1}. {SIGN_ROLES[r]}
                                </span>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  aria-label={`Đưa ${SIGN_ROLES[r]} lên trước`}
                                  title="Lên trước"
                                  onClick={() => setRoles((l) => move(l, i, -1))}
                                >
                                  <ArrowUp size={16} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  aria-label={`Đưa ${SIGN_ROLES[r]} xuống sau`}
                                  title="Xuống sau"
                                  onClick={() => setRoles((l) => move(l, i, 1))}
                                >
                                  <ArrowDown size={16} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  aria-label={`Bỏ ${SIGN_ROLES[r]}`}
                                  title="Bỏ người ký"
                                  onClick={() =>
                                    locked
                                      ? toast('Phó hiệu trưởng ban hành kế hoạch năm nên luôn là người ký, không bỏ được.', 'warn')
                                      : setRoles((l) => l.filter((x) => x !== r))
                                  }
                                >
                                  <Trash2 size={16} aria-hidden />
                                </button>
                              </div>
                            );
                          })}
                          {free.length > 0 && (
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
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-goal-table__del" />
                <col />
                <col className="ga-goal-table__code" />
                <col className="ga-goal-table__code" />
                <col className="ga-cal__col" />
              </colgroup>
              <thead>
                <tr>
                  <th className="ga-goal-table__fixed">STT</th>
                  <th>Tên hoạt động</th>
                  <th className="center">Cho gộp cả tuần</th>
                  <th className="center">Mặc định cả tuần</th>
                  <th className="center">Sắp xếp · Xóa</th>
                </tr>
              </thead>
              <tbody>
                {draft.weekRows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="ga-goal-table__fixed">
                      <div className="ga-goal-table__pad">{i + 1}</div>
                    </td>
                    <td>
                      <Cell
                        editable
                        value={r.label}
                        label={`Tên hoạt động ${i + 1}`}
                        onChange={(v) => set((x) => ((x.weekRows[i].label = v), x))}
                      />
                    </td>
                    <td className="center">
                      <div className="ga-goal-table__pad">
                        <input
                          type="checkbox"
                          aria-label={`Cho gộp cả tuần: ${r.label}`}
                          checked={r.canMerge}
                          onChange={(e) =>
                            set((x) => ((x.weekRows[i].canMerge = e.target.checked), (x.weekRows[i].allWeek &&= e.target.checked), x))
                          }
                        />
                      </div>
                    </td>
                    <td className="center">
                      <div className="ga-goal-table__pad">
                        <input
                          type="checkbox"
                          aria-label={`Mặc định cả tuần: ${r.label}`}
                          checked={r.allWeek}
                          // Chọn "mặc định cả tuần" thì dòng đó cũng được gộp
                          onChange={(e) =>
                            set((x) => ((x.weekRows[i].allWeek = e.target.checked), (x.weekRows[i].canMerge ||= e.target.checked), x))
                          }
                        />
                      </div>
                    </td>
                    <td className="center">
                      <div className="ga-goal-table__pad row gap-1">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Đưa ${r.label} lên`}
                          onClick={() => set((x) => ((x.weekRows = move(x.weekRows, i, -1)), x))}
                        >
                          <ArrowUp size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Đưa ${r.label} xuống`}
                          onClick={() => set((x) => ((x.weekRows = move(x.weekRows, i, 1)), x))}
                        >
                          <ArrowDown size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Xóa dòng ${r.label}`}
                          onClick={() =>
                            r.key === 'hoc'
                              ? toast('Không xóa được dòng Hoạt động học vì kế hoạch ngày dùng dòng này (môn, đề tài).', 'warn')
                              : set((x) => ((x.weekRows = x.weekRows.filter((y) => y.key !== r.key)), x))
                          }
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="ga-goal-table__fixed" />
                  <td colSpan={4}>
                    <Cell
                      editable
                      value=""
                      label="Thêm dòng hoạt động"
                      placeholder="Nhập tên hoạt động mới (ví dụ: Ăn, ngủ, vệ sinh)"
                      onChange={(v) => {
                        set(
                          (x) => (
                            (x.weekRows = [
                              ...x.weekRows,
                              { key: `r_${Date.now().toString(36)}`, label: v, canMerge: true, allWeek: false },
                            ]),
                            x
                          ),
                        );
                        // Dòng vừa thêm nhận con trỏ để gõ tiếp, như bảng mục tiêu
                        const n = draft.weekRows.length + 1;
                        setTimeout(() => {
                          const el = document.querySelector(`[aria-label="Tên hoạt động ${n}"]`);
                          el?.focus({ preventScroll: true });
                          el?.setSelectionRange(el.value.length, el.value.length);
                        });
                      }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
