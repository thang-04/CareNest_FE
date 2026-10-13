import { useEffect, useMemo, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Spinner } from '@/components/ui/States';
import { savePlacements } from '@/services/school-config/schoolConfigService';
import {
  PLACEMENT_ACTION,
  PLACEMENT_ACTION_LABELS,
  PLACEMENT_ACTION_SHORT,
  PLACEMENT_IN_CLASS,
} from '@/models/school-config/schoolConfigConstants';

const { PROMOTE, STAY, LEAVE, GRADUATE } = PLACEMENT_ACTION;

/** Lớp năm mới hợp lệ cho một kết quả: lên lớp = nhóm tuổi kế tiếp, ở lại = cùng nhóm tuổi; cùng điểm trường xếp trước. */
const optionsFor = (targets, from, action) => {
  const group = action === PROMOTE ? from.nextAgeGroupId : from.ageGroupId;
  return targets
    .filter((t) => t.ageGroupId === group)
    .sort((a, b) => (a.campusId === from.campusId ? 0 : 1) - (b.campusId === from.campusId ? 0 : 1) || a.name.localeCompare(b.name, 'vi'));
};
const defaultTarget = (targets, from, action) =>
  (action === PROMOTE ? from.suggestedTargetId : optionsFor(targets, from, STAY)[0]?.id) || '';
const initialRows = (from, targets) => {
  const first = from.graduating ? GRADUATE : PROMOTE;
  return Object.fromEntries(
    from.children.map((ch) => [
      ch.id,
      ch.placement
        ? { action: ch.placement.action, toClassId: ch.placement.toClassId || '' }
        : { action: first, toClassId: defaultTarget(targets, from, first) },
    ]),
  );
};

/**
 * Xếp lớp năm mới cho các trẻ của một lớp cũ (bản dự kiến, áp dụng khi kích hoạt năm học).
 * Một dòng điều khiển "Cả lớp lên", chọn nhiều trẻ để đổi kết quả cùng lúc, thanh lưu luôn hiện ở cuối.
 */
export function PlacementClassPanel({ yearId, from, targets, campusName, editable, onDirty, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState(() => initialRows(from, targets));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState([]);
  const [wholeClass, setWholeClass] = useState(from.suggestedTargetId || '');
  const [bulkAction, setBulkAction] = useState('');
  const actions = from.graduating ? [GRADUATE, STAY, LEAVE] : [PROMOTE, STAY, LEAVE];
  const saved = useMemo(() => initialRows(from, targets), [from, targets]);
  const dirty = from.children.some(
    (ch) => !ch.placement || rows[ch.id]?.action !== saved[ch.id]?.action || rows[ch.id]?.toClassId !== saved[ch.id]?.toClassId,
  );
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  // Số chỗ đã dùng sau khi lưu: chỗ của các lớp cũ khác + lựa chọn đang sửa ở lớp này
  const seats = useMemo(() => {
    const base = Object.fromEntries(targets.map((t) => [t.id, t.taken]));
    from.children.forEach((ch) => {
      if (ch.placement && PLACEMENT_IN_CLASS.includes(ch.placement.action)) base[ch.placement.toClassId] -= 1;
    });
    Object.values(rows).forEach((r) => {
      if (PLACEMENT_IN_CLASS.includes(r.action) && r.toClassId) base[r.toClassId] = (base[r.toClassId] || 0) + 1;
    });
    return base;
  }, [rows, targets, from]);
  const over = targets.filter((t) => seats[t.id] > t.capacity);
  const count = (a) => Object.values(rows).filter((r) => r.action === a).length;
  const promoteOptions = optionsFor(targets, from, PROMOTE);
  const target = targets.find((t) => t.id === wholeClass);

  const patchRows = (ids, patch) => {
    setRows((current) => {
      const next = { ...current };
      ids.forEach((id) => {
        const row = { ...current[id], ...patch };
        if (patch.action && !patch.toClassId)
          row.toClassId = PLACEMENT_IN_CLASS.includes(patch.action) ? defaultTarget(targets, from, patch.action) : '';
        next[id] = row;
      });
      return next;
    });
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([id]) => !ids.includes(id))));
  };
  const applyWholeClass = () =>
    patchRows(
      from.children.map((ch) => ch.id),
      { action: PROMOTE, toClassId: wholeClass },
    );
  const applyBulk = () => {
    if (!bulkAction) return;
    patchRows(picked, { action: bulkAction });
    setPicked([]);
    setBulkAction('');
  };
  const togglePick = (id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const allPicked = picked.length === from.children.length && picked.length > 0;

  const reset = () => {
    setRows(saved);
    setErrors({});
    setPicked([]);
  };
  const submit = async () => {
    const missing = Object.fromEntries(
      Object.entries(rows)
        .filter(([, r]) => PLACEMENT_IN_CLASS.includes(r.action) && !r.toClassId)
        .map(([id]) => [id, 'Chọn lớp năm học mới']),
    );
    setErrors(missing);
    if (Object.keys(missing).length || over.length) return;
    setSaving(true);
    try {
      await savePlacements(yearId, { items: Object.entries(rows).map(([childId, r]) => ({ childId, ...r })) }, user);
      toast.success('Đã lưu xếp lớp (dự kiến).', from.name);
      onSaved();
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được xếp lớp');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sc-plc__panel">
      <div className="sc-plc__toolbar">
        {from.graduating ? (
          <span className="chip chip--blue">Nhóm tuổi lớn nhất: mặc định ra trường</span>
        ) : (
          <>
            <label className="field__label" htmlFor="plc-whole">
              Cả lớp lên
            </label>
            <select
              id="plc-whole"
              className="select sc-placement__select"
              value={wholeClass}
              disabled={!editable}
              onChange={(e) => setWholeClass(e.target.value)}
            >
              <option value="">Chọn lớp năm mới…</option>
              {promoteOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {campusName(t.campusId)}
                </option>
              ))}
            </select>
            <button className="btn" type="button" disabled={!editable || !wholeClass} onClick={applyWholeClass}>
              Áp dụng
            </button>
            {target && (
              <span className={`chip ${seats[target.id] > target.capacity ? 'chip--red' : 'chip--gray'}`}>
                {target.name}: {seats[target.id] || 0}/{target.capacity} trẻ
              </span>
            )}
          </>
        )}
      </div>

      {picked.length > 0 && (
        <div className="sc-plc__bulk" role="region" aria-label="Đổi kết quả cho trẻ đã chọn">
          <span className="fw-600">Đã chọn {picked.length} trẻ</span>
          <select className="select" aria-label="Kết quả mới" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
            <option value="">Chọn kết quả…</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {PLACEMENT_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
          <button className="btn btn--primary" type="button" disabled={!bulkAction} onClick={applyBulk}>
            Đổi kết quả cho {picked.length} trẻ
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setPicked([])}>
            Bỏ chọn
          </button>
        </div>
      )}

      {over.length > 0 && (
        <div className="alert alert--danger" role="alert">
          Vượt sĩ số tối đa: {over.map((t) => `${t.name} (${seats[t.id]}/${t.capacity})`).join(', ')}. Chọn lớp khác cho một số trẻ.
        </div>
      )}

      <div className="sc-plc__table">
        <table className="table table--compact">
          <thead>
            <tr>
              <th className="sc-plc__check">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả trẻ"
                  checked={allPicked}
                  disabled={!editable}
                  onChange={() => setPicked(allPicked ? [] : from.children.map((ch) => ch.id))}
                />
              </th>
              <th>Trẻ</th>
              <th>Kết quả</th>
              <th>Lớp năm học mới</th>
            </tr>
          </thead>
          <tbody>
            {from.children.map((ch) => {
              const r = rows[ch.id] || {};
              const inClass = PLACEMENT_IN_CLASS.includes(r.action);
              return (
                <tr key={ch.id} className={picked.includes(ch.id) ? 'is-picked' : ''}>
                  <td className="sc-plc__check">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${ch.fullName}`}
                      checked={picked.includes(ch.id)}
                      disabled={!editable}
                      onChange={() => togglePick(ch.id)}
                    />
                  </td>
                  <td className="nowrap">
                    <div className="fw-600">{ch.fullName}</div>
                    <div className="muted text-xs">
                      {ch.code}
                      {!ch.placement && <span className="sc-plc__new"> · chưa lưu</span>}
                    </div>
                  </td>
                  <td>
                    <div className="sc-seg" role="radiogroup" aria-label={`Kết quả của ${ch.fullName}`}>
                      {actions.map((a) => (
                        <label key={a} className={`sc-seg__item ${r.action === a ? 'is-on' : ''}`} title={PLACEMENT_ACTION_LABELS[a]}>
                          <input
                            type="radio"
                            className="sr-only"
                            name={`plc-${ch.id}`}
                            checked={r.action === a}
                            disabled={!editable}
                            onChange={() => patchRows([ch.id], { action: a })}
                          />
                          {PLACEMENT_ACTION_SHORT[a]}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    {inClass ? (
                      <select
                        className="select sc-placement__select"
                        aria-label={`Lớp năm mới của ${ch.fullName}`}
                        value={r.toClassId || ''}
                        disabled={!editable}
                        onChange={(e) => patchRows([ch.id], { toClassId: e.target.value })}
                      >
                        <option value="">Chọn lớp</option>
                        {optionsFor(targets, from, r.action).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} · {campusName(t.campusId)} · {seats[t.id] || 0}/{t.capacity}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="muted">Không xếp lớp</span>
                    )}
                    {errors[ch.id] && <p className="field__error">{errors[ch.id]}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sc-plc__footer">
        <div className="row row--wrap">
          {[PROMOTE, STAY, LEAVE, GRADUATE].map((a) =>
            count(a) ? (
              <span key={a} className={`chip chip--${{ PROMOTE: 'green', STAY: 'orange', LEAVE: 'gray', GRADUATE: 'blue' }[a]}`}>
                {PLACEMENT_ACTION_SHORT[a]}: {count(a)}
              </span>
            ) : null,
          )}
          {dirty && <span className="chip chip--orange">Có thay đổi chưa lưu</span>}
        </div>
        <div className="row">
          <button className="btn" type="button" disabled={!dirty || saving} onClick={reset}>
            Hoàn tác
          </button>
          <button className="btn btn--primary" type="button" disabled={!editable || saving || over.length > 0} onClick={submit}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu xếp lớp
          </button>
        </div>
      </div>
    </div>
  );
}
