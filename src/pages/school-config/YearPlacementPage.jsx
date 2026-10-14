import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarRange, Info, Users, Wand2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { PlacementClassPanel } from '@/components/school-config/PlacementClassPanel';
import { usePlacements, useSchoolYears } from '@/hooks/school-config/useSchoolConfig';
import { autoPlace } from '@/services/school-config/schoolConfigService';
import { PLACEMENT_ACTION, PLACEMENT_ACTION_SHORT, YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canConfigureSchool } from '@/utils/school-config/schoolConfigPermissions';
import { placementCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/school-config.css';

const TONE = { PROMOTE: 'green', STAY: 'orange', LEAVE: 'gray', GRADUATE: 'blue' };
const placedOf = (c) => c.children.filter((ch) => ch.placement).length;

/**
 * Xếp lớp năm học mới (Hiệu trưởng): trái là danh sách lớp năm cũ, phải là trẻ của lớp đang chọn.
 * Bản dự kiến, áp dụng khi kích hoạt năm học.
 */
export default function YearPlacementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { years } = useSchoolYears();
  const planned = years.filter((y) => y.status === YEAR_STATUS.PLANNED);
  const yearId = params.get('year') || planned[0]?.id || '';
  const campusId = params.get('campus') || '';
  const groupId = params.get('group') || '';
  const filtered = !!(campusId || groupId);
  const { plan, loading, error, reload } = usePlacements(yearId, { live: false });
  const [selectedId, setSelectedId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [confirmAuto, setConfirmAuto] = useState(false);

  const campusName = (id) => plan?.campuses.find((c) => c.id === id)?.name || id;
  const groupName = (id) => plan?.ageGroups.find((g) => g.id === id)?.shortName || '—';
  // Lọc theo điểm trường và nhóm tuổi; xếp theo nhóm tuổi (nhỏ đến lớn, đúng thứ tự cấu hình) rồi đến điểm trường
  const classes = useMemo(() => {
    const order = (id) => (plan?.ageGroups || []).findIndex((g) => g.id === id);
    return (plan?.classes || [])
      .filter((c) => (!campusId || c.campusId === campusId) && (!groupId || c.ageGroupId === groupId))
      .sort(
        (a, b) => order(a.ageGroupId) - order(b.ageGroupId) || a.campusId.localeCompare(b.campusId) || a.name.localeCompare(b.name, 'vi'),
      );
  }, [plan, campusId, groupId]);
  const groupOptions = (plan?.ageGroups || []).filter((g) => (plan?.classes || []).some((c) => c.ageGroupId === g.id));
  const autoLabel = filtered ? 'Xếp tự động các lớp đang lọc' : 'Xếp tự động tất cả lớp';
  const selected = classes.find((c) => c.id === selectedId) || classes[0];
  const all = classes.flatMap((c) => c.children);
  const count = (action) => all.filter((ch) => ch.placement?.action === action).length;
  const unplaced = all.filter((ch) => !ch.placement).length;
  const onDirty = useCallback((value) => setDirty(value), []);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  // Đổi lớp khi đang sửa dở thì hỏi trước để không mất thay đổi
  const pick = (id) => {
    if (id === selected?.id) return;
    if (dirty) setPendingId(id);
    else setSelectedId(id);
  };
  const onListKey = (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) || !classes.length) return;
    event.preventDefault();
    const i = classes.findIndex((c) => c.id === selected?.id);
    const next = classes[Math.min(classes.length - 1, Math.max(0, i + (event.key === 'ArrowDown' ? 1 : -1)))];
    pick(next.id);
    document.getElementById(`plc-class-${next.id}`)?.focus();
  };

  const runAuto = async () => {
    setConfirmAuto(false);
    try {
      const r = await autoPlace(yearId, user, { campusId: campusId || undefined, ageGroupId: groupId || undefined });
      const left = r.unplaced.map((u) => `${u.className}: ${u.count} trẻ`).join(', ');
      toast.success(`${r.promoted} trẻ lên lớp, ${r.graduated} trẻ ra trường.${left ? ` Chưa đủ chỗ: ${left}.` : ''}`, 'Đã xếp tự động');
      const fresh = await reload({ silent: true });
      // Mở ngay lớp còn trẻ chưa xếp để Hiệu trưởng xử lý tiếp
      const todo = classes.map((c) => fresh?.classes.find((x) => x.id === c.id)).find((c) => c && placedOf(c) < c.children.length);
      if (todo) setSelectedId(todo.id);
    } catch (err) {
      toast.error(err.message, 'Không xếp tự động được');
    }
  };

  if (!canConfigureSchool(user))
    return (
      <div className="page">
        <Breadcrumb items={placementCrumbs()} />
        <h1 className="page__title">Xếp lớp năm học mới</h1>
        <ScNoAccess />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={placementCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Xếp lớp năm học mới</h1>
          {plan?.sourceYear && (
            <p className="muted">
              Từ năm {plan.sourceYear.name} sang năm {plan.year.name} · đã xếp {all.length - unplaced}/{all.length} trẻ
            </p>
          )}
        </div>
        {plan?.editable && (
          <button className="btn btn--primary" onClick={() => setConfirmAuto(true)}>
            <Wand2 size={16} /> {autoLabel}
          </button>
        )}
      </div>

      {!planned.length && !params.get('year') ? (
        <div className="card card__body">
          <EmptyState
            icon={CalendarRange}
            title="Chưa có năm học sắp diễn ra"
            description="Tạo năm học mới và sao chép lớp trước khi xếp trẻ lên lớp."
            action={
              <Link className="btn btn--primary" to="/school/years/new">
                Thêm năm học
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="card sc-plc__filters">
            <div className="sc-inline-field">
              <label className="field__label" htmlFor="plc-year">
                Năm học mới
              </label>
              <select id="plc-year" className="select" value={yearId} onChange={(e) => setParam('year', e.target.value)}>
                {planned.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sc-inline-field">
              <label className="field__label" htmlFor="plc-campus">
                Điểm trường
              </label>
              <select id="plc-campus" className="select" value={campusId} onChange={(e) => setParam('campus', e.target.value)}>
                <option value="">Tất cả điểm trường</option>
                {(plan?.campuses || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sc-inline-field">
              <label className="field__label" htmlFor="plc-group">
                Nhóm tuổi
              </label>
              <select id="plc-group" className="select" value={groupId} onChange={(e) => setParam('group', e.target.value)}>
                <option value="">Tất cả nhóm tuổi</option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.shortName}
                  </option>
                ))}
              </select>
            </div>
            <div className="sc-plc__totals">
              {Object.values(PLACEMENT_ACTION).map((a) => (
                <span key={a} className={`chip chip--${TONE[a]}`}>
                  {PLACEMENT_ACTION_SHORT[a]}: {count(a)}
                </span>
              ))}
              <span className={`chip ${unplaced ? 'chip--red' : 'chip--green'}`}>Chưa xếp: {unplaced}</span>
            </div>
          </div>

          {error ? (
            <div className="card card__body">
              <ErrorState error={error} onRetry={reload} />
            </div>
          ) : loading && !plan ? (
            <LoadingState />
          ) : !plan?.sourceYear ? (
            <div className="card card__body">
              <EmptyState icon={Users} title="Không có trẻ cần chuyển" description="Chưa có năm học đang hoạt động để chuyển trẻ." />
            </div>
          ) : !classes.length ? (
            <div className="card card__body">
              <EmptyState
                icon={Users}
                title="Không có lớp"
                description={
                  groupId
                    ? 'Không có lớp nào của nhóm tuổi này trong phạm vi đang lọc.'
                    : 'Điểm trường này chưa có lớp trong năm học đang hoạt động.'
                }
              />
            </div>
          ) : (
            <div className="sc-plc">
              <nav className="card sc-plc__list" aria-label="Lớp năm học cũ" onKeyDown={onListKey}>
                {classes.map((c) => {
                  const done = placedOf(c);
                  const complete = done === c.children.length;
                  return (
                    <button
                      key={c.id}
                      id={`plc-class-${c.id}`}
                      type="button"
                      className={`sc-plc__class ${c.id === selected?.id ? 'is-active' : ''}`}
                      aria-current={c.id === selected?.id ? 'true' : undefined}
                      onClick={() => pick(c.id)}
                    >
                      <span className="sc-plc__class-name">{c.name}</span>
                      <span className="muted text-xs">
                        {groupName(c.ageGroupId)} · {campusName(c.campusId)}
                      </span>
                      <span className={`chip ${complete ? 'chip--green' : done ? 'chip--orange' : 'chip--red'}`}>
                        {complete ? `Đã xếp ${done}/${c.children.length}` : `Chưa xếp ${c.children.length - done}`}
                      </span>
                      {!c.graduating && !c.suggestedTargetId && (
                        <span className="text-xs sc-plc__warn">Năm mới chưa có lớp {groupName(c.nextAgeGroupId)}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <section className="card sc-plc__main" aria-label={selected ? `Trẻ lớp ${selected.name}` : 'Trẻ của lớp'}>
                {selected && (
                  <>
                    <div className="sc-plc__head">
                      <h2 className="section-title">
                        {selected.name} · {campusName(selected.campusId)}
                      </h2>
                      <span className="muted text-sm">
                        {groupName(selected.ageGroupId)} · {selected.children.length} trẻ
                      </span>
                    </div>
                    {selected.children.length ? (
                      <PlacementClassPanel
                        key={`${selected.id}:${selected.children.map((ch) => ch.placement?.updatedAt || '').join()}`}
                        yearId={yearId}
                        from={selected}
                        targets={plan.targets}
                        campusName={campusName}
                        editable={plan.editable}
                        onDirty={onDirty}
                        onSaved={() => reload({ silent: true })}
                      />
                    ) : (
                      <EmptyState icon={Users} title="Lớp không có trẻ đang học" />
                    )}
                  </>
                )}
              </section>
            </div>
          )}

          <p className="muted text-sm mt-12">
            <Info size={14} /> Bản xếp lớp chỉ là dự kiến: trẻ vẫn học lớp cũ tới khi kích hoạt năm học {plan?.year.name}. Lớp năm mới không
            vượt sĩ số tối đa (theo nhóm tuổi và sức chứa phòng). Dùng phím ↑ ↓ để chuyển lớp.
          </p>
        </>
      )}

      <ConfirmationModal
        open={!!pendingId}
        title="Bỏ thay đổi chưa lưu?"
        message="Lớp đang chọn có thay đổi xếp lớp chưa lưu. Chuyển sang lớp khác sẽ bỏ các thay đổi này."
        confirmLabel="Bỏ thay đổi"
        danger
        onConfirm={() => {
          setSelectedId(pendingId);
          setPendingId(null);
          setDirty(false);
        }}
        onClose={() => setPendingId(null)}
      />
      <ConfirmationModal
        open={confirmAuto}
        title={`${autoLabel}?`}
        message={`${filtered ? `Chỉ các lớp đang hiện theo bộ lọc (${classes.length} lớp). ` : ''}Trẻ chưa xếp được chuyển cả lớp lên nhóm tuổi kế tiếp (lớp cùng điểm trường còn nhiều chỗ nhất); nhóm tuổi lớn nhất ra trường. Trẻ đã xếp giữ nguyên. Lớp mới hết chỗ thì trẻ còn lại để chưa xếp.`}
        confirmLabel="Xếp tự động"
        onConfirm={runAuto}
        onClose={() => setConfirmAuto(false)}
      />
    </div>
  );
}
