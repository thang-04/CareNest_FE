import { Fragment, useMemo, useState } from 'react';
import { Download, Plus } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { EmptyState, Modal } from '@/components/education-plan/eduUi';
import { DomainTitle } from '@/components/education-plan/PlanWidgets';

/** Picks fixed-code requirements (YCCĐ) of the yearly goals to add to a theme plan: same table as the yearly-goal form, plus a tick column. */
export function PickGoalsModal({ goal, rows, onClose, onPick }) {
  const [picked, setPicked] = useState([]);
  const used = (code) => rows.some((r) => r.code === code);
  const toggle = (c) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  // Tick nhiều YCCĐ cùng lúc (cả bảng hoặc cả lĩnh vực); YCCĐ đã có trong chủ đề bị khóa.
  const free = (domains) =>
    domains.flatMap((d) => d.items.flatMap((it) => (it.requirements || []).map((r) => r.code))).filter((c) => !used(c));
  const allPicked = (codes) => codes.length > 0 && codes.every((c) => picked.includes(c));
  const toggleMany = (codes) => setPicked((p) => (allPicked(codes) ? p.filter((c) => !codes.includes(c)) : [...new Set([...p, ...codes])]));
  const allCodes = free(goal.domains);

  return (
    <Modal
      title="Chọn YCCĐ từ mục tiêu năm học"
      width={960}
      className="ga-modal-full"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={!picked.length} onClick={() => onPick(picked)}>
            <Plus size={16} aria-hidden /> Thêm {picked.length || ''} YCCĐ
          </button>
        </>
      }
    >
      <p className="muted text-xs">Từ: {goal.title}. Mỗi YCCĐ được tick tạo một dòng, giữ nguyên mã của mục tiêu năm học.</p>
      <div className="table-wrap ga-pick-table">
        <table className="table ga-plan-table ga-goal-table">
          <colgroup>
            <col className="ga-goal-table__code" />
            <col className="ga-goal-table__goal" />
            <col className="ga-goal-table__code" />
            <col />
            <col className="ga-goal-table__del" />
          </colgroup>
          <thead>
            <tr>
              <th>Mã MT</th>
              <th>Mục tiêu</th>
              <th>Mã YCCĐ</th>
              <th>Yêu cầu cần đạt</th>
              <th className="center">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả YCCĐ"
                  disabled={!allCodes.length}
                  checked={allPicked(allCodes)}
                  onChange={() => toggleMany(allCodes)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {goal.domains.map((d) => {
              const domainCodes = free([d]);
              return (
                <Fragment key={d.name}>
                  <tr>
                    <td colSpan={4} className="ga-goal-table__domain">
                      <div className="ga-goal-table__pad row gap-2">
                        <DomainTitle name={d.name} />
                        <span className="muted text-xs">{d.items.length} mục tiêu</span>
                      </div>
                    </td>
                    <td className="ga-goal-table__domain center">
                      <div className="ga-goal-table__pad">
                        <input
                          type="checkbox"
                          aria-label={`Chọn tất cả YCCĐ lĩnh vực ${d.name}`}
                          disabled={!domainCodes.length}
                          checked={allPicked(domainCodes)}
                          onChange={() => toggleMany(domainCodes)}
                        />
                      </div>
                    </td>
                  </tr>
                  {d.items.map((it) => {
                    const reqs = it.requirements || [];
                    const span = Math.max(reqs.length, 1);
                    const goalCells = (
                      <>
                        <td rowSpan={span}>
                          <div className="ga-goal-table__pad">
                            <span className="ga-goal-code">{it.code}</span>
                          </div>
                        </td>
                        <td rowSpan={span}>
                          <div className="ga-goal-table__pad">{it.text}</div>
                        </td>
                      </>
                    );
                    if (!reqs.length)
                      return (
                        <tr key={it.code}>
                          {goalCells}
                          <td>
                            <div className="ga-goal-table__pad muted">—</div>
                          </td>
                          <td colSpan={2}>
                            <div className="ga-goal-table__pad muted text-xs">
                              Mục tiêu này chưa có YCCĐ. Phó hiệu trưởng cần bổ sung trong mục tiêu năm học.
                            </div>
                          </td>
                        </tr>
                      );
                    return reqs.map((r, ri) => (
                      <tr key={r.code}>
                        {ri === 0 && goalCells}
                        <td>
                          <div className="ga-goal-table__pad">
                            <span className="ga-goal-code">{r.code}</span>
                          </div>
                        </td>
                        <td>
                          <label className="ga-goal-table__pad ga-pick-table__label" htmlFor={`pick-${r.code}`}>
                            {r.text}
                            {used(r.code) && <span className="muted text-xs"> · đã có trong chủ đề</span>}
                          </label>
                        </td>
                        <td className="center">
                          <div className="ga-goal-table__pad">
                            <input
                              id={`pick-${r.code}`}
                              type="checkbox"
                              aria-label={`Chọn YCCĐ ${r.code}`}
                              disabled={used(r.code)}
                              checked={used(r.code) || picked.includes(r.code)}
                              onChange={() => toggle(r.code)}
                            />
                          </div>
                        </td>
                      </tr>
                    ));
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

/** Copies goals and content from another theme plan (other age group / other school year). */
export function ImportThemeRowsModal({ themes, excludeId, defaultAgeGroupId, onClose, onImport }) {
  const { schoolYears } = useEducationPlan();
  const [year, setYear] = useState('');
  const [ageGroupId, setAgeGroupId] = useState(defaultAgeGroupId || '');
  const sources = useMemo(
    () =>
      themes.filter(
        (t) => t.id !== excludeId && (!year || t.schoolYear === year) && (!ageGroupId || t.ageGroupId === ageGroupId) && t.rows?.length,
      ),
    [themes, excludeId, year, ageGroupId],
  );
  const [sourceId, setSourceId] = useState('');
  const source = sources.find((t) => t.id === sourceId) || sources[0];
  const [picked, setPicked] = useState([]);
  const rows = source?.rows || [];
  const all = rows.length > 0 && rows.every((r) => picked.includes(r.id));

  return (
    <Modal
      title="Lấy mục tiêu từ kế hoạch chủ đề có sẵn"
      width={760}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!picked.length}
            onClick={() =>
              onImport(
                rows.filter((r) => picked.includes(r.id)),
                source,
              )
            }
          >
            <Download size={16} aria-hidden /> Thêm {picked.length || ''} mục tiêu
          </button>
        </>
      }
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="field__label" htmlFor="it-year">
            Năm học
          </label>
          <select
            id="it-year"
            className="select"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setSourceId('');
              setPicked([]);
            }}
          >
            <option value="">Tất cả năm học</option>
            {schoolYears.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="it-age">
            Nhóm tuổi
          </label>
          <select
            id="it-age"
            className="select"
            value={ageGroupId}
            onChange={(e) => {
              setAgeGroupId(e.target.value);
              setSourceId('');
              setPicked([]);
            }}
          >
            <option value="">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!source ? (
        <EmptyState title="Không có kế hoạch chủ đề phù hợp" desc="Thử chọn năm học hoặc nhóm tuổi khác." />
      ) : (
        <>
          <div className="field">
            <label className="field__label" htmlFor="it-src">
              Kế hoạch chủ đề
            </label>
            <select
              id="it-src"
              className="select"
              value={source.id}
              onChange={(e) => {
                setSourceId(e.target.value);
                setPicked([]);
              }}
            >
              {sources.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.schoolYear} · {t.code}
                </option>
              ))}
            </select>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted text-xs">{rows.length} mục tiêu</span>
            <button type="button" className="btn btn--sm" onClick={() => setPicked(all ? [] : rows.map((r) => r.id))}>
              {all ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
          <div className="ga-pick-list">
            {rows.map((r) => (
              <label key={r.id} className="ga-goal-check">
                <input
                  type="checkbox"
                  checked={picked.includes(r.id)}
                  onChange={() => setPicked((p) => (p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                />
                <span className="ga-goal-code">{r.code}</span>
                <span className="text-sm">{r.requirement}</span>
              </label>
            ))}
          </div>
          <p className="muted text-xs">
            Mục tiêu được gắn vào mục tiêu năm học cùng lĩnh vực của nhóm tuổi bạn và cấp mã YCCĐ mới. Nội dung, phương pháp được chép theo,
            bạn vẫn sửa được.
          </p>
        </>
      )}
    </Modal>
  );
}
