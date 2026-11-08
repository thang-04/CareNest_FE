import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Eye, PencilLine } from '@/components/ui/icons';
import { ReasonModal } from '@/components/permissions/ReasonModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { VP_PLACE, VP_TASK_PRESETS, VP_VIEW_CODE } from '@/models/account/vpTaskAreas';
import { updatePermissionOverrides } from '@/services/account/permissionService';
import {
  VP_AREA_STATE,
  applyVpPreset,
  setVpArea,
  setVpTask,
  setVpTaskScope,
  vpAreaStatusText,
  vpAreasView,
  vpChangeTexts,
  vpDraftChanges,
  vpDraftOf,
  vpEditSummary,
  vpOverridesFromDraft,
  vpPlaceText,
  vpViewOff,
} from '@/utils/account/vpTasks';
import '@/styles/modules/permissions.css';

/** Hai nút Chỉ xem / Được sửa. value null = mảng mới giao một phần, chưa nút nào sáng. */
function EditChoice({ label, value, disabled, onChange }) {
  const option = (on, text) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === on}
      className={`tab${value === on ? ' tab--active' : ''}`}
      disabled={disabled}
      onClick={() => onChange(on)}
    >
      {text}
    </button>
  );
  return (
    <div className="tabs vp-choice" role="radiogroup" aria-label={label}>
      {option(false, 'Chỉ xem')}
      {option(true, 'Được sửa')}
    </div>
  );
}

function TaskRow({ task, campusName, readOnly, onToggle, onScope }) {
  return (
    <div className="vp-task">
      <span className="vp-task__label">{task.label}</span>
      <EditChoice label={task.label} value={task.on} disabled={readOnly} onChange={onToggle} />
      {task.choosable && task.on && !readOnly ? (
        <select
          className="select vp-task__place"
          value={task.place}
          aria-label={`Nơi áp dụng: ${task.label}`}
          onChange={(e) => onScope(e.target.value)}
        >
          <option value={VP_PLACE.CAMPUS}>{campusName}</option>
          <option value={VP_PLACE.SCHOOL}>Cả trường</option>
        </select>
      ) : (
        <span className="vp-task__place text-sm muted">{task.on ? vpPlaceText(task.place, campusName) : '—'}</span>
      )}
    </div>
  );
}

/**
 * Giao việc cho một Phó hiệu trưởng theo mảng, nói bằng lời thường: xem cả trường là mặc định, Hiệu trưởng chỉ giao
 * phần được sửa và nơi áp dụng (AUTH-20). Bản nháp giữ ở đây; cha đặt `key` theo dữ liệu đã lưu để nạp lại sau khi lưu.
 */
export function VpTaskPanel({ staff, campusName, items, readOnly, onSaved, onDirty }) {
  const { user } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState(() => vpDraftOf(items));
  const [openAreas, setOpenAreas] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const areas = useMemo(() => vpAreasView(items, draft), [items, draft]);
  const changes = useMemo(() => vpDraftChanges(items, draft), [items, draft]);
  const viewOff = vpViewOff(items, draft);
  const summary = vpEditSummary(areas, campusName);
  const dirty = changes.length > 0;

  // Cha truyền onDirty mới mỗi lần render: giữ trong ref, nếu không effect chạy lại liên tục và lặp render
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
      await updatePermissionOverrides(staff.userId, { overrides: vpOverridesFromDraft(items, draft), reason }, user);
      toast.success(`Đã lưu việc giao cho ${staff.fullName}`);
      setConfirming(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || 'Chưa lưu được việc đã giao', 'Lỗi lưu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vp-panel">
      <div className="vp-summary">
        {viewOff ? (
          <div className="vp-summary__line vp-summary__line--warn">
            <AlertTriangle size={16} />
            <span className="flex-1">Người này đang bị tắt quyền xem hồ sơ trẻ.</span>
            {!readOnly && (
              <button type="button" className="btn btn--sm" onClick={() => setDraft((d) => setVpTask(d, VP_VIEW_CODE, true))}>
                Bật lại
              </button>
            )}
          </div>
        ) : (
          <div className="vp-summary__line">
            <Eye size={16} />
            <span>Xem được dữ liệu của cả trường</span>
          </div>
        )}
        <div className="vp-summary__line">
          <PencilLine size={16} />
          <span>{summary ? `Được sửa: ${summary}` : 'Chưa được giao sửa mảng nào'}</span>
        </div>
      </div>

      {readOnly ? (
        <p className="text-sm muted vp-panel__note">Việc giao theo người, không theo năm. Chọn năm đang hoạt động để sửa.</p>
      ) : (
        <div className="vp-presets">
          <span className="text-sm muted">Giao nhanh:</span>
          {VP_TASK_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="btn btn--sm"
              onClick={() => setDraft((d) => applyVpPreset(d, preset.key, items))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {areas.map((area) => (
        <section key={area.key} className="vp-area" aria-label={area.label}>
          <div className="vp-area__head">
            <div className="vp-area__title">
              <div className="fw-600">{area.label}</div>
              <div className="text-sm muted">{vpAreaStatusText(area)}</div>
            </div>
            <EditChoice
              label={`Cả mảng ${area.label}`}
              value={area.state === VP_AREA_STATE.PARTIAL ? null : area.state === VP_AREA_STATE.ALL}
              disabled={readOnly}
              onChange={(on) => setDraft((d) => setVpArea(d, area, on))}
            />
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              aria-expanded={!!openAreas[area.key]}
              onClick={() => setOpenAreas((o) => ({ ...o, [area.key]: !o[area.key] }))}
            >
              {openAreas[area.key] ? 'Thu gọn' : 'Chọn từng việc'}
              <ChevronDown size={15} className={openAreas[area.key] ? 'vp-area__chevron--open' : undefined} />
            </button>
          </div>
          {openAreas[area.key] &&
            area.tasks.map((task) => (
              <TaskRow
                key={task.code}
                task={task}
                campusName={campusName}
                readOnly={readOnly}
                onToggle={(on) => setDraft((d) => setVpTask(d, task.code, on))}
                onScope={(scope) => setDraft((d) => setVpTaskScope(d, task.code, scope))}
              />
            ))}
        </section>
      ))}

      {dirty && (
        <div className="vp-panel__bar" role="region" aria-label="Lưu việc đã giao">
          <span className="text-sm">
            Có <strong>{changes.length}</strong> thay đổi chưa lưu
          </span>
          <div className="row gap-2">
            <button type="button" className="btn btn--sm" onClick={() => setDraft(vpDraftOf(items))}>
              Bỏ thay đổi
            </button>
            <button type="button" className="btn btn--sm btn--primary" onClick={() => setConfirming(true)}>
              Lưu
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <ReasonModal
          title={`Lưu việc giao cho ${staff.fullName}?`}
          changes={vpChangeTexts(items, draft, campusName)}
          saving={saving}
          onClose={() => setConfirming(false)}
          onSubmit={save}
        />
      )}
    </div>
  );
}
