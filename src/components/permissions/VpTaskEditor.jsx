import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, Plus, X } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { ReasonModal } from '@/components/permissions/ReasonModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { VP_PLACE, VP_VIEW_CODE } from '@/models/account/vpTaskAreas';
import { updatePermissionOverrides } from '@/services/account/permissionService';
import {
  VP_AREA_STATE,
  applyVpPreset,
  removeVpPreset,
  setVpArea,
  setVpCell,
  setVpTask,
  vpAreasView,
  vpChangePreview,
  vpDraftChanges,
  vpDraftOf,
  vpGapText,
  vpItemsKey,
  vpOverridesFromDraft,
  vpPlaceText,
  vpPresetsOf,
  vpTaskGaps,
  vpViewOff,
} from '@/utils/account/vpTasks';
import '@/styles/modules/permissions.css';

/** "Phụ trách: …" theo nhãn giao nhanh đang đủ việc; tên nhãn bỏ chữ "Phụ trách" cho gọn. */
const dutyText = (items, draft) => {
  const duties = vpPresetsOf(items, draft)
    .filter((preset) => preset.applied)
    .map((preset) => preset.label.replace(/^Phụ trách\s+/i, ''));
  return duties.length ? duties.join(', ') : 'chưa giao';
};

const editCount = (items) => {
  const tasks = vpAreasView(items).flatMap((area) => area.tasks);
  return { on: tasks.filter((task) => task.on).length, total: tasks.length };
};

/**
 * Cột trái màn Phân công PHT: mỗi người một thẻ (điểm trường, đang phụ trách gì, sửa được bao nhiêu việc); bấm để giao việc.
 * people: [{ userId, user, campusName, items, loading, error }]; actionsOf(person) trả nút thao tác của module gọi.
 */
export function VpPeopleList({ people, selectedId, onSelect, actionsOf }) {
  return (
    <ul className="vp-people" aria-label="Phó hiệu trưởng">
      {people.map((person) => {
        const selected = person.userId === selectedId;
        const counts = person.items?.length ? editCount(person.items) : null;
        return (
          <li key={person.userId} className={`vp-people__item${selected ? ' is-selected' : ''}`}>
            <button
              type="button"
              className="vp-people__pick"
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect(person.userId)}
            >
              <Avatar user={person.user} />
              <span className="vp-people__text">
                <span className="fw-600">{person.user.fullName}</span>
                <span className="text-sm text-2">Điểm trường: {person.campusName || 'chưa phân công'}</span>
                {person.campusName && (
                  <span className="text-sm">
                    {person.loading ? (
                      <span className="muted">Đang tải việc…</span>
                    ) : person.error || !person.items ? (
                      <span className="text-warning">Chưa tải được việc</span>
                    ) : (
                      <>
                        Phụ trách: <b>{dutyText(person.items, vpDraftOf(person.items))}</b>
                        {counts && (
                          <span className="muted">
                            {' '}
                            · sửa {counts.on}/{counts.total} việc
                          </span>
                        )}
                      </>
                    )}
                  </span>
                )}
              </span>
            </button>
            {actionsOf && <div className="vp-people__actions">{actionsOf(person)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Việc ở Bán trú / Hồ sơ trẻ chưa PHT nào được sửa (theo dữ liệu đã lưu) ⇒ Hiệu trưởng tự làm. people: [{ campusId, items }]. */
export function VpGapsNote({ people, campuses, missing = [] }) {
  const loaded = people.filter((person) => person.items?.length);
  const gaps = vpTaskGaps(
    loaded.map((person) => ({ ...person, draft: vpDraftOf(person.items) })),
    campuses,
  );
  const labels = new Map(loaded.flatMap((person) => vpAreasView(person.items).flatMap((area) => area.tasks.map((t) => [t.code, t.label]))));
  const rows = Object.entries(gaps);
  if (!rows.length) return null;
  return (
    <div className="alert alert--info mb-16">
      <Info size={18} />
      <div className="flex-1">
        {/* Thu gọn mặc định: danh sách dài sẽ đẩy phần giao việc xuống */}
        <details className="vp-task__gaps-box">
          <summary>
            <span className="fw-600">{rows.length} việc chưa giao cho Phó hiệu trưởng nào</span> — Hiệu trưởng tự làm. Xem danh sách
          </summary>
          <ul className="vp-task__gaps">
            {rows.map(([code, gap]) => (
              <li key={code}>
                {labels.get(code) || code}
                {gap.campuses ? ` — ${gap.campuses.join(', ')}` : ''}
              </li>
            ))}
          </ul>
        </details>
        {missing.length > 0 && <div className="text-xs muted">Chưa tính {missing.join(', ')} (chưa tải được việc).</div>}
      </div>
    </div>
  );
}

function ReviewTable({ preview }) {
  return (
    <>
      {(preview.labelsAdded.length > 0 || preview.labelsRemoved.length > 0) && (
        <p className="text-sm vp-review__labels">
          {preview.labelsAdded.length > 0 && <span>Thêm phụ trách:</span>}
          {preview.labelsAdded.map((label) => (
            <span key={label} className="chip chip--teal">
              {label}
            </span>
          ))}
          {preview.labelsRemoved.length > 0 && <span>Bỏ phụ trách:</span>}
          {preview.labelsRemoved.map((label) => (
            <span key={label} className="chip chip--gray">
              {label}
            </span>
          ))}
        </p>
      )}
      <table className="table table--grid table--compact vp-review__table">
        <thead>
          <tr>
            <th>Việc</th>
            <th>Trước</th>
            <th>Sau</th>
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row) => (
            <tr key={row.code}>
              <td>{row.label}</td>
              <td className="muted">{row.before}</td>
              <td className="fw-600">{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function AreaToggle({ area, disabled, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = area.state === VP_AREA_STATE.PARTIAL;
  }, [area.state]);
  return (
    <label className="vp-area__all">
      <input
        ref={ref}
        type="checkbox"
        checked={area.state === VP_AREA_STATE.ALL}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      Sửa cả mảng
    </label>
  );
}

/** Chọn nơi áp dụng cho việc đang bật: chỉ mã campusScoped mới chọn được, còn lại hiện nơi cố định. */
function PlacePicker({ task, campusName, disabled, onChange }) {
  if (!task.choosable) return <span className="text-sm muted">{vpPlaceText(task.place, campusName)}</span>;
  const options = [VP_PLACE.CAMPUS, VP_PLACE.SCHOOL];
  return (
    <div className="tabs tabs--pill vp-place" role="radiogroup" aria-label={`Nơi được sửa: ${task.label}`}>
      {options.map((place) => (
        <button
          key={place}
          type="button"
          role="radio"
          aria-checked={task.place === place}
          className={`tab ${task.place === place ? 'tab--active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(place)}
        >
          {vpPlaceText(place, campusName)}
        </button>
      ))}
    </div>
  );
}

/**
 * Cột phải: giao việc cho một Phó hiệu trưởng (AUTH-20). Mỗi việc một công tắc "được sửa"; việc chọn được nơi thì chọn ngay
 * cạnh. Dưới tên việc ghi PHT khác đang sửa hoặc chỗ chưa ai sửa. Lưu phải qua bản xem trước và lý do (AUTH-14).
 * person / others: { userId, fullName, campusId, campusName, items }.
 */
export function VpTaskEditor({ person, others = [], campuses, readOnly, onSaved, onDirty }) {
  const { user } = useAuth();
  const toast = useToast();
  // Nháp gắn với dữ liệu đã lưu: lưu xong tải lại (khóa đổi) thì nháp tự bỏ
  const key = vpItemsKey(person.items);
  const [stored, setStored] = useState(null);
  const draft = stored?.key === key ? stored.draft : vpDraftOf(person.items);
  const setDraft = (change) => setStored({ key, draft: change(draft) });
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const areas = vpAreasView(person.items, draft);
  const presets = vpPresetsOf(person.items, draft);
  const changes = vpDraftChanges(person.items, draft);
  const dirty = changes.length > 0;
  const loadedOthers = others.filter((other) => other.items?.length);
  const othersByTask = new Map();
  loadedOthers.forEach((other) =>
    vpAreasView(other.items).forEach((area) =>
      area.tasks
        .filter((task) => task.on)
        .forEach((task) =>
          othersByTask.set(task.code, [
            ...(othersByTask.get(task.code) || []),
            `${other.fullName} (${vpPlaceText(task.place, other.campusName)})`,
          ]),
        ),
    ),
  );
  // Tính cả lựa chọn đang chỉnh của người này
  const gaps = vpTaskGaps(
    [
      { campusId: person.campusId, items: person.items, draft },
      ...loadedOthers.map((other) => ({ ...other, draft: vpDraftOf(other.items) })),
    ],
    campuses,
  );

  // Cha truyền onDirty mới mỗi lần render: giữ trong ref để effect không chạy lặp
  const onDirtyRef = useRef(onDirty);
  onDirtyRef.current = onDirty;
  useEffect(() => {
    onDirtyRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyRef.current?.(false), []);

  const save = async (reason) => {
    if (saving) return;
    setSaving(true);
    try {
      await updatePermissionOverrides(person.userId, { overrides: vpOverridesFromDraft(person.items, draft), reason }, user);
      toast.success(`Đã lưu việc giao cho ${person.fullName}`);
      setReviewing(false);
      setSaving(false);
      onSaved?.();
    } catch (err) {
      setSaving(false);
      toast.error(err, 'Chưa lưu được việc giao');
    }
  };

  return (
    <div className="vp-editor">
      <div className="vp-editor__head">
        <div>
          <h2 className="vp-editor__name">Việc của {person.fullName}</h2>
          <p className="text-sm text-2">
            Điểm trường {person.campusName} · Mọi Phó hiệu trưởng xem được dữ liệu cả trường; bật công tắc để cho người này sửa.
          </p>
        </div>
        {presets.length > 0 && (
          <div className="vp-editor__duties" aria-label="Giao nhanh theo mảng phụ trách">
            <span className="text-sm text-2">Giao nhanh:</span>
            {presets.map((preset) =>
              preset.applied ? (
                <span key={preset.key} className="chip chip--teal vp-editor__duty">
                  <Check size={13} /> {preset.label}
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={`Bỏ ${preset.label}`}
                      onClick={() => setDraft((d) => removeVpPreset(d, preset.key, person.items))}
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ) : (
                !readOnly && (
                  <button
                    key={preset.key}
                    type="button"
                    className="btn btn--sm"
                    onClick={() => setDraft((d) => applyVpPreset(d, preset.key, person.items))}
                  >
                    <Plus size={14} /> {preset.label}
                  </button>
                )
              ),
            )}
          </div>
        )}
      </div>

      {vpViewOff(person.items, draft) && (
        <div className="alert alert--warning mb-12">
          <AlertTriangle size={18} />
          <div className="flex-1">
            Đang tắt quyền xem hồ sơ trẻ của người này.{' '}
            {!readOnly && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setDraft((d) => setVpTask(d, VP_VIEW_CODE, true))}>
                Bật lại
              </button>
            )}
          </div>
        </div>
      )}

      <div className="vp-areas">
        {areas.map((area) => (
          <section key={area.key} className="vp-area" aria-label={area.label}>
            <header className="vp-area__head">
              <h3 className="vp-area__title">
                {area.label}{' '}
                <span className="text-sm text-2">
                  · được sửa {area.onCount}/{area.tasks.length} việc
                </span>
              </h3>
              <AreaToggle area={area} disabled={readOnly} onChange={(on) => setDraft((d) => setVpArea(d, area, on))} />
            </header>
            <ul className="vp-area__tasks">
              {area.tasks.map((task) => {
                const names = othersByTask.get(task.code) || [];
                const gap = gaps[task.code];
                return (
                  <li key={task.code} className={`vp-task-row${task.on ? ' is-on' : ''}`}>
                    <Switch
                      checked={task.on}
                      label={`Được sửa: ${task.label}`}
                      disabled={readOnly}
                      onChange={(on) => setDraft((d) => setVpTask(d, task.code, on))}
                    />
                    <div className="vp-task-row__text">
                      <span className={task.on ? 'fw-600' : ''}>{task.label}</span>
                      {names.length > 0 && <span className="text-xs text-2">PHT khác đang sửa: {names.join('; ')}</span>}
                      {gap && (
                        <span className="text-xs vp-task__gap">
                          <AlertTriangle size={12} /> {vpGapText(gap)}
                        </span>
                      )}
                    </div>
                    <div className="vp-task-row__place">
                      {task.on ? (
                        <PlacePicker
                          task={task}
                          campusName={person.campusName}
                          disabled={readOnly}
                          onChange={(place) => setDraft((d) => setVpCell(d, task.code, place))}
                        />
                      ) : (
                        <span className="text-sm muted">Chỉ xem</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {readOnly ? (
        <p className="text-sm muted mt-12">Việc giao theo người, không theo năm. Chọn năm đang hoạt động để sửa.</p>
      ) : (
        <div className={`vp-editor__bar${dirty ? ' is-dirty' : ''}`} role="region" aria-label="Lưu việc đã giao">
          <span className="text-sm">{dirty ? `Có ${changes.length} thay đổi chưa lưu` : 'Chưa có thay đổi'}</span>
          <div className="row gap-2">
            {dirty && (
              <button type="button" className="btn btn--sm" onClick={() => setStored(null)}>
                Bỏ thay đổi
              </button>
            )}
            <button type="button" className="btn btn--sm btn--primary" disabled={!dirty} onClick={() => setReviewing(true)}>
              Xem lại và lưu
            </button>
          </div>
        </div>
      )}

      {reviewing && (
        <ReasonModal
          title={`Xem lại việc giao cho ${person.fullName}`}
          size="lg"
          confirmLabel="Xác nhận lưu"
          saving={saving}
          onClose={() => setReviewing(false)}
          onSubmit={save}
        >
          <ReviewTable preview={vpChangePreview(person.items, draft, person.campusName)} />
        </ReasonModal>
      )}
    </div>
  );
}
