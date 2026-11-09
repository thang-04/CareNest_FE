import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Buildings,
  Check,
  Info,
  Lock,
  MapPin,
  MinusCircle as Minus,
  Plus,
  Undo2,
  X,
} from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { ReasonModal } from '@/components/permissions/ReasonModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { VP_PLACE, VP_VIEW_CODE } from '@/models/account/vpTaskAreas';
import { updatePermissionOverrides } from '@/services/account/permissionService';
import {
  VP_AREA_STATE,
  VP_CHANGE,
  VP_SCOPE,
  applyVpPreset,
  removeVpPreset,
  revertVpTask,
  setVpArea,
  setVpCell,
  setVpTask,
  vpAreasView,
  vpCellText,
  vpChangePreview,
  vpDraftChanges,
  vpDraftOf,
  vpGapText,
  vpItemsKey,
  vpOverridesFromDraft,
  vpPlaceText,
  vpPresetsOf,
  vpScopeGroups,
  vpTaskGaps,
  vpViewOff,
} from '@/utils/account/vpTasks';
import '@/styles/modules/permissions.css';

/** Mảng đang phụ trách theo nhãn giao nhanh đủ việc; bỏ chữ "Phụ trách" và viết hoa chữ đầu cho gọn trong nhãn. */
const dutiesOf = (items) =>
  vpPresetsOf(items, vpDraftOf(items))
    .filter((preset) => preset.applied)
    .map((preset) => preset.label.replace(/^Phụ trách\s+/i, ''))
    .map((duty) => duty.charAt(0).toUpperCase() + duty.slice(1));

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
                <span className="vp-people__name">
                  <span className="fw-600">{person.user.fullName}</span>
                  {/* Đang chọn nói bằng chữ + dấu ✓, không chỉ bằng màu nền (người lớn tuổi khó phân biệt màu nhạt) */}
                  {selected && (
                    <span className="pick-badge">
                      <Check size={13} /> Đang chọn
                    </span>
                  )}
                </span>
                {/* Nhãn màu để lướt nhanh: điểm trường · mảng phụ trách · số việc được sửa */}
                <span className="vp-people__tags">
                  {person.campusName ? (
                    <span className="chip chip--blue" title="Điểm trường phụ trách">
                      <MapPin size={12} /> {person.campusName}
                    </span>
                  ) : (
                    <span className="chip chip--orange">Chưa có điểm trường</span>
                  )}
                  {person.campusName &&
                    (person.loading ? (
                      <span className="text-xs muted">Đang tải việc…</span>
                    ) : person.error || !person.items ? (
                      <span className="chip chip--red">Chưa tải được việc</span>
                    ) : (
                      <>
                        {dutiesOf(person.items).map((duty) => (
                          <span key={duty} className="chip chip--teal" title="Mảng phụ trách">
                            <Check size={12} /> {duty}
                          </span>
                        ))}
                        {dutiesOf(person.items).length === 0 && <span className="chip chip--gray">Chưa giao mảng</span>}
                        {counts && (
                          <span className={`chip ${counts.on ? 'chip--green' : 'chip--gray'}`} title="Số việc được sửa">
                            Sửa {counts.on}/{counts.total} việc
                          </span>
                        )}
                      </>
                    ))}
                </span>
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

/**
 * Bản xem trước trong hộp lưu: sửa lại "Sau" hoặc hoàn tác từng việc ngay tại đây, không phải đóng hộp.
 * Việc hoàn tác về như cũ thì tự rời khỏi danh sách.
 */
// Lời giải thích phạm vi theo nhóm: nói "sửa ở đâu" và "vì sao" bằng lời thường
const SCOPE_INFO = {
  [VP_SCOPE.SCHOOL]: () => ({
    icon: Buildings,
    title: 'Dùng chung cả trường',
    why: 'Cả trường dùng chung một bộ dữ liệu này, nên được sửa là sửa cho mọi điểm trường.',
  }),
  [VP_SCOPE.CHOOSABLE]: (campusName) => ({
    icon: MapPin,
    title: 'Theo điểm trường — chọn được phạm vi',
    why: `Mặc định chỉ ${campusName}. Chọn "Cả trường" khi người này lo việc đó thay cho mọi điểm trường.`,
  }),
  [VP_SCOPE.CAMPUS]: (campusName) => ({
    icon: Lock,
    title: `Chỉ ${campusName}`,
    why: 'Phó hiệu trưởng chỉ sửa ở điểm trường mình phụ trách; phần cả trường do Hiệu trưởng làm.',
  }),
};

// Mỗi loại thay đổi một màu + icon + chữ (không chỉ dựa vào màu)
const CHANGE_LOOK = {
  [VP_CHANGE.GRANT]: { icon: Plus, tone: 'green', text: 'Được sửa thêm' },
  [VP_CHANGE.REVOKE]: { icon: Minus, tone: 'red', text: 'Về chỉ xem' },
  [VP_CHANGE.PLACE]: { icon: MapPin, tone: 'blue', text: 'Đổi nơi sửa' },
};

function ReviewSummary({ rows, preview, disabled, onRevertAll }) {
  const count = (kind) => rows.filter((row) => row.kind === kind).length;
  return (
    <div className="vp-review__summary">
      <div className="vp-review__stats">
        <span className="vp-review__total">{rows.length} thay đổi</span>
        {Object.entries(CHANGE_LOOK).map(([kind, look]) =>
          count(kind) ? (
            <span key={kind} className={`chip chip--${look.tone}`}>
              {look.text}: {count(kind)}
            </span>
          ) : null,
        )}
      </div>
      <button type="button" className="btn btn--sm btn--ghost" disabled={disabled} onClick={onRevertAll}>
        <Undo2 size={14} /> Hoàn tác tất cả
      </button>
      {(preview.labelsAdded.length > 0 || preview.labelsRemoved.length > 0) && (
        <div className="vp-review__labels text-sm">
          {preview.labelsAdded.map((label) => (
            <span key={label} className="chip chip--teal">
              <Check size={12} /> Thêm: {label}
            </span>
          ))}
          {preview.labelsRemoved.map((label) => (
            <span key={label} className="chip chip--gray">
              <X size={12} /> Bỏ: {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Bản xem trước trong hộp lưu: mỗi việc một thẻ "trước → sau", nhóm theo mảng. Sửa lại "sau" hoặc hoàn tác ngay tại đây;
 * việc hoàn tác về như cũ thì tự rời khỏi danh sách.
 */
function ReviewList({ preview, campusName, disabled, onChange, onRevert, onRevertAll }) {
  if (!preview.rows.length)
    return (
      <div className="vp-review__empty">
        <Check size={22} />
        <p className="fw-600">Không còn thay đổi nào</p>
        <p className="text-sm text-2">Đã hoàn tác hết. Bấm Quay lại để tiếp tục giao việc.</p>
      </div>
    );
  const groups = preview.rows.reduce((all, row) => {
    const group = all.find((g) => g.area === row.area);
    if (group) group.rows.push(row);
    else all.push({ area: row.area, rows: [row] });
    return all;
  }, []);
  return (
    <div className="vp-review">
      <ReviewSummary rows={preview.rows} preview={preview} disabled={disabled} onRevertAll={onRevertAll} />
      {groups.map((group) => (
        <section key={group.area} className="vp-review__group" aria-label={group.area}>
          <h3 className="vp-review__area">{group.area}</h3>
          <ul className="vp-review__list">
            {group.rows.map((row) => {
              const look = CHANGE_LOOK[row.kind];
              const KindIcon = look.icon;
              return (
                <li key={row.code} className={`vp-change vp-change--${look.tone}`}>
                  <span className="vp-change__icon" aria-hidden="true">
                    <KindIcon size={14} />
                  </span>
                  <div className="vp-change__body">
                    <span className="vp-change__label">{row.label}</span>
                    <span className="sr-only">{look.text}.</span>
                    <div className="vp-change__diff">
                      <span className="vp-change__before" title="Trước khi lưu">
                        {row.before}
                      </span>
                      <ArrowRight size={14} className="vp-change__arrow" aria-hidden="true" />
                      {row.options ? (
                        <select
                          className="select vp-review__select"
                          aria-label={`Sau khi lưu: ${row.label}`}
                          value={row.value}
                          disabled={disabled}
                          onChange={(e) => onChange(row.code, e.target.value)}
                        >
                          {row.options.map((value) => (
                            <option key={value} value={value}>
                              {vpCellText(value, campusName)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="vp-change__after">{row.after}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost vp-change__undo"
                    aria-label={`Hoàn tác: ${row.label}`}
                    title="Hoàn tác về như đã lưu"
                    disabled={disabled}
                    onClick={() => onRevert(row.code)}
                  >
                    <Undo2 size={14} /> Hoàn tác
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
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
          {task.place === place && <Check size={14} aria-hidden="true" />}
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
            {vpScopeGroups(area.tasks).map((group) => {
              const info = SCOPE_INFO[group.scope](person.campusName);
              const ScopeIcon = info.icon;
              return (
                <div key={group.scope} className={`vp-scope vp-scope--${group.scope.toLowerCase()}`}>
                  {/* Nói lý do phạm vi một lần cho cả nhóm, để người dùng hiểu vì sao việc này khác việc kia */}
                  <div className="vp-scope__head">
                    <span className="vp-scope__icon" aria-hidden="true">
                      <ScopeIcon size={14} />
                    </span>
                    <div>
                      <span className="vp-scope__title">{info.title}</span>
                      <span className="vp-scope__why">{info.why}</span>
                    </div>
                  </div>
                  <ul className="vp-area__tasks">
                    {group.tasks.map((task) => {
                      const names = othersByTask.get(task.code) || [];
                      const gap = gaps[task.code];
                      return (
                        <li key={task.code} className={`vp-task-row${task.on ? ' is-on' : ''}`}>
                          {/* Trạng thái ghi bằng chữ ngay cạnh công tắc, không chỉ dựa vào màu công tắc/nền dòng */}
                          <div className="vp-task-row__toggle">
                            <Switch
                              checked={task.on}
                              label={`Được sửa: ${task.label}`}
                              disabled={readOnly}
                              onChange={(on) => setDraft((d) => setVpTask(d, task.code, on))}
                            />
                            <span className={`vp-task-row__state${task.on ? ' is-on' : ''}`} aria-hidden="true">
                              {task.on ? (
                                <>
                                  <Check size={14} /> Được sửa
                                </>
                              ) : (
                                'Chỉ xem'
                              )}
                            </span>
                          </div>
                          <div className="vp-task-row__text">
                            <span className={task.on ? 'fw-600' : ''}>{task.label}</span>
                            {names.length > 0 && <span className="text-xs text-2">PHT khác đang sửa: {names.join('; ')}</span>}
                            {gap && (
                              <span className="text-xs vp-task__gap">
                                <AlertTriangle size={12} /> {vpGapText(gap)}
                              </span>
                            )}
                          </div>
                          {/* Chỉ nhóm chọn được mới có nút chọn phạm vi; nhóm cố định đã ghi phạm vi ở tiêu đề */}
                          {task.choosable && task.on && (
                            <div className="vp-task-row__place">
                              <PlacePicker
                                task={task}
                                campusName={person.campusName}
                                disabled={readOnly}
                                onChange={(place) => setDraft((d) => setVpCell(d, task.code, place))}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
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
              Lưu
            </button>
          </div>
        </div>
      )}

      {reviewing && (
        <ReasonModal
          title={`Xem lại việc giao cho ${person.fullName}`}
          size="lg"
          confirmLabel="Lưu"
          canSubmit={dirty}
          saving={saving}
          onClose={() => setReviewing(false)}
          onSubmit={save}
        >
          <ReviewList
            preview={vpChangePreview(person.items, draft, person.campusName)}
            campusName={person.campusName}
            disabled={saving}
            onChange={(code, value) => setDraft((d) => setVpCell(d, code, value))}
            onRevert={(code) => setDraft((d) => revertVpTask(d, code, person.items))}
            onRevertAll={() => setStored(null)}
          />
        </ReasonModal>
      )}
    </div>
  );
}
