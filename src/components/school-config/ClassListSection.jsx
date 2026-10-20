import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Copy, DoorOpen, Pencil, Plus, RotateCcw, Search, Shapes, Trash2, UserCheck } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { AssignClassTeachersDialog } from '@/components/school-config/AssignDialogs';
import { canAssignClass } from '@/utils/school-config/schoolConfigPermissions';
import { useMasterData } from '@/hooks/useMasterData';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { ClassFillBadge } from '@/components/school-config/SchoolConfigBadges';
import {
  CLASS_FILL,
  CLASS_FILTERS,
  TEACHERS_PER_CLASS,
  ageRangeLabel,
  mealSessionsLabel,
} from '@/models/school-config/schoolConfigConstants';
import { normalizeText } from '@/utils/format';

const matchStatus = (c, status) => {
  if (!status) return true;
  if (status === 'NO_TEACHER') return c.missingTeachers > 0;
  if (status === 'NO_ROOM') return c.noRoom;
  return c.fill === status;
};

/**
 * Class list of the selected school year (SRS 4.1.3), grouped by age group.
 * Filters live in the URL (?q=&group=&status=) so a reload keeps them; counts and fill states come from the repository.
 */
export function ClassListSection({
  year,
  campuses = [],
  ageGroups,
  classes,
  groupStats,
  loading,
  editable,
  principal,
  canCopy,
  onAdd,
  onEdit,
  onDelete,
  onCopy,
  onChanged,
}) {
  const md = useMasterData();
  const { user } = useAuth();
  const [assigning, setAssigning] = useState(null); // { kind: 'teachers', cls }
  // Phân công giáo viên ngay tại đây (tổ trưởng chọn ở form nhóm tuổi): Hiệu trưởng luôn được; Phó HT khi có quyền sửa "Phân công giáo viên" trong phạm vi
  const yearOpen = year && year.status !== 'CLOSED';
  const closeAssign = (changed) => {
    setAssigning(null);
    if (changed) onChanged?.();
  };
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const group = params.get('group') || '';
  const status = params.get('status') || '';
  // Điểm trường lọc cả bảng nhóm tuổi phía trên (repository trả lớp theo điểm trường)
  const campus = params.get('campus') || '';
  const filtered = !!(q || group || status || campus);
  // Nhóm đang mở nằm trên URL (?expanded=ag-3,ag-4): mở trang mới thì mọi nhóm thu gọn, chỉ nhóm mở mới vẽ thẻ lớp;
  // tải lại / gửi link vẫn giữ nhóm đang mở
  const expanded = new Set((params.get('expanded') || '').split(',').filter(Boolean));
  const setExpanded = (ids) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (ids.size) next.set('expanded', [...ids].join(','));
        else next.delete('expanded');
        return next;
      },
      { replace: true },
    );
  const isOpen = (id) => expanded.has(id);
  const toggleGroup = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };
  // Vừa đổi bộ lọc: mở các nhóm có lớp khớp (chỉ lúc đổi; sau đó chevron của người dùng quyết định).
  // Đổi điểm trường thì chờ danh sách lớp mới tải về rồi mới mở.
  const autoExpand = useRef(null);

  const setFilter = (key, value) => {
    autoExpand.current = { waitFor: key === 'campus' ? classes : null };
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const reset = () => {
    autoExpand.current = null;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ['q', 'group', 'status', 'campus', 'expanded'].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );
  };

  const shown = useMemo(() => {
    const kw = normalizeText(q.trim());
    return classes.filter(
      (c) => (!kw || normalizeText(c.name).includes(kw)) && (!group || c.ageGroupId === group) && matchStatus(c, status),
    );
  }, [classes, q, group, status]);

  // Không lọc: người cấu hình thấy cả nhóm chưa có lớp để thêm lớp; đang lọc: chỉ nhóm có kết quả
  // Lọc điểm trường vẫn hiện đủ nhóm tuổi (nhóm tuổi dùng chung cả trường, để thêm lớp cho điểm trường đó);
  // tìm tên / tình trạng chỉ hiện nhóm có kết quả; lọc nhóm tuổi thì hiện đúng nhóm đó
  const narrowed = !!(q || status);
  const groups = ageGroups.filter((g) =>
    group ? g.id === group : narrowed ? shown.some((c) => c.ageGroupId === g.id) : editable || classes.some((c) => c.ageGroupId === g.id),
  );

  useEffect(() => {
    const pending = autoExpand.current;
    if (!pending || (pending.waitFor && pending.waitFor === classes)) return;
    autoExpand.current = null;
    setExpanded(new Set(filtered ? groups.filter((g) => g.id === group || shown.some((c) => c.ageGroupId === g.id)).map((g) => g.id) : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, group, status, campus, classes]);

  const roomCell = (c) => {
    const l = c.locationId && md.locationById(c.locationId);
    if (!l) return <span className="muted text-sm">Chưa có phòng</span>;
    return (
      <span className="text-sm">
        <span className="fw-600">{l.room || l.name}</span>
        {l.room && l.name ? ` – ${l.name}` : ''}
        {l.capacity ? <span className="muted"> · sức chứa {l.capacity}</span> : null}
      </span>
    );
  };

  // Hai ô giáo viên cố định (mỗi lớp 2 GV); ô trống là khung nét đứt nhẹ, không dùng màu cảnh báo
  const teacherCell = (c) => {
    const ids = [...c.teacherIds].sort((a, b) => (b === c.homeroomTeacherId) - (a === c.homeroomTeacherId));
    const slots = Array.from({ length: Math.max(TEACHERS_PER_CLASS, ids.length) }, (_, i) => ids[i] || null);
    return (
      <div className="sc-tslots">
        {slots.map((id, i) =>
          id ? (
            <span key={id} className="sc-tslot">
              <span className="sc-tslot__label">GV {i + 1}</span>
              <span className="sc-tslot__name">{md.userById(id)?.fullName || id}</span>
              {id === c.homeroomTeacherId && <span className="chip chip--teal sc-tslot__tag">CN</span>}
            </span>
          ) : (
            <span key={`empty-${i}`} className="sc-tslot sc-tslot--empty">
              <span className="sc-tslot__label">GV {i + 1}</span>
              <span>Chưa phân công</span>
            </span>
          ),
        )}
      </div>
    );
  };

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Lớp năm học {year?.name}</h2>
        <span className="row sc-classes__tools">
          <span className="muted text-sm">
            {q || group || status ? `Hiển thị ${shown.length}/${classes.length} lớp` : `${classes.length} lớp`}
            {campus ? ` · ${md.campusById(campus)?.shortName || ''}` : ''}
          </span>
          {groups.length > 0 && (
            <>
              <button className="link-btn text-sm" onClick={() => setExpanded(new Set(groups.map((g) => g.id)))}>
                Mở rộng tất cả
              </button>
              <button className="link-btn text-sm" onClick={() => setExpanded(new Set())}>
                Thu gọn tất cả
              </button>
            </>
          )}
        </span>
      </div>

      <div className="filter-bar sc-class-filters">
        <SearchSubmit
          className="sc-search"
          value={q}
          placeholder="Tìm tên lớp"
          label="Tìm tên lớp"
          maxLength={50}
          onSearch={(text) => setFilter('q', text)}
        />
        <select className="select" aria-label="Lọc theo điểm trường" value={campus} onChange={(e) => setFilter('campus', e.target.value)}>
          <option value="">{principal ? 'Tất cả điểm trường' : 'Điểm trường của tôi'}</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.shortName || c.name}
            </option>
          ))}
        </select>
        <select className="select" aria-label="Lọc theo nhóm tuổi" value={group} onChange={(e) => setFilter('group', e.target.value)}>
          <option value="">Tất cả nhóm tuổi</option>
          {ageGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.shortName}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label="Lọc theo tình trạng lớp"
          value={status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">Tất cả tình trạng</option>
          {Object.entries(CLASS_FILTERS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        {filtered && (
          <button className="btn" onClick={reset}>
            <RotateCcw size={16} /> Đặt lại bộ lọc
          </button>
        )}
      </div>

      <div className="sc-classes">
        {loading ? (
          <LoadingState />
        ) : classes.length === 0 && !campus ? (
          <EmptyState
            icon={Shapes}
            title="Chưa có lớp trong năm học này"
            description={
              editable ? 'Thêm lớp mới hoặc sao chép lớp của một năm học khác.' : 'Lớp được Hiệu trưởng cấu hình sẽ hiển thị tại đây.'
            }
            action={
              editable && (
                <div className="row row--wrap">
                  {canCopy && (
                    <button className="btn" onClick={onCopy}>
                      <Copy size={16} /> Sao chép từ năm khác
                    </button>
                  )}
                  <button className="btn btn--primary" onClick={() => onAdd('')}>
                    <Plus size={16} /> Thêm lớp
                  </button>
                </div>
              )
            }
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Không có lớp phù hợp"
            description="Thử đổi từ khóa hoặc bộ lọc."
            action={
              <button className="btn" onClick={reset}>
                <RotateCcw size={16} /> Đặt lại bộ lọc
              </button>
            }
          />
        ) : (
          groups.map((g) => {
            const rows = shown.filter((c) => c.ageGroupId === g.id);
            const stats = groupStats?.[g.id];
            const open = isOpen(g.id);
            const bodyId = `sc-cgroup-${g.id}`;
            return (
              <section key={g.id} className={`sc-cgroup ${open ? '' : 'sc-cgroup--collapsed'}`} aria-label={`Nhóm ${g.name}`}>
                {/* Đầu nhóm: bấm để ẩn / hiện các lớp của nhóm; nút Thêm lớp nằm ngoài vùng bấm */}
                <header className="sc-cgroup__head">
                  <button
                    type="button"
                    className="sc-cgroup__title sc-cgroup__toggle"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    title={open ? 'Thu gọn nhóm' : 'Mở rộng nhóm'}
                    onClick={() => toggleGroup(g.id)}
                  >
                    <span className="sc-cgroup__name">
                      <ChevronDown size={18} className="sc-cgroup__chevron" aria-hidden="true" />
                      {g.name}
                    </span>
                    <span className="sc-cgroup__meta">
                      <span className="chip chip--gray">{ageRangeLabel(g)}</span>
                      <span className="chip chip--gray">Bữa: {mealSessionsLabel(g)}</span>
                      <span className="chip chip--gray">
                        {stats?.classCount ?? rows.length} lớp
                        {stats?.capacity ? ` · ${stats.enrolled}/${stats.capacity} trẻ` : ''}
                        {stats?.planned ? ` · ${stats.planned} dự kiến xếp` : ''}
                      </span>
                    </span>
                  </button>
                  <span className="row row--wrap sc-cgroup__actions">
                    {editable && (
                      <button
                        className="btn btn--sm"
                        onClick={() => {
                          // Mở nhóm để thấy lớp vừa thêm
                          if (!open) toggleGroup(g.id);
                          onAdd(g.id);
                        }}
                      >
                        <Plus size={14} /> Thêm lớp {g.shortName}
                      </button>
                    )}
                  </span>
                </header>

                {!open ? null : rows.length === 0 ? (
                  <div id={bodyId} className="sc-cgroup__empty">
                    <span className="muted text-sm">
                      Chưa có lớp {g.shortName}
                      {campus ? ` ở ${md.campusById(campus)?.shortName || ''}` : ''} trong năm học này.
                    </span>
                    {editable && (
                      <button className="link-btn" onClick={() => onAdd(g.id)}>
                        <Plus size={14} /> Thêm lớp
                      </button>
                    )}
                  </div>
                ) : (
                  <ul id={bodyId} className="sc-clist">
                    {rows.map((c) => (
                      <li key={c.id} className="sc-ccard">
                        <div className="sc-ccard__top">
                          <span className="sc-ccard__name">{c.name}</span>
                          {principal && <span className="chip chip--gray">{md.campusById(c.campusId)?.shortName}</span>}
                          {editable && (
                            <span className="sc-ccard__actions">
                              <button className="icon-btn" title="Sửa lớp" aria-label={`Sửa ${c.name}`} onClick={() => onEdit(c)}>
                                <Pencil size={16} />
                              </button>
                              <button className="icon-btn" title="Xóa lớp" aria-label={`Xóa ${c.name}`} onClick={() => onDelete(c)}>
                                <Trash2 size={16} />
                              </button>
                            </span>
                          )}
                        </div>
                        <div className="sc-ccard__line">
                          <DoorOpen size={15} className="muted" aria-hidden="true" />
                          <span className="sr-only">Phòng:</span>
                          {roomCell(c)}
                        </div>
                        {teacherCell(c)}
                        {yearOpen && canAssignClass(c, user) && (
                          <button className="link-btn text-sm sc-ccard__assign" onClick={() => setAssigning({ kind: 'teachers', cls: c })}>
                            <UserCheck size={14} /> {c.teacherIds.length ? 'Đổi giáo viên' : 'Phân công giáo viên'}
                          </button>
                        )}
                        <div className="sc-ccard__fill">
                          <div className="sc-ccard__fill-row">
                            {c.plannedCount != null ? (
                              // Năm sắp diễn ra: trẻ đã xếp lớp chưa chuyển vào lớp cho tới khi kích hoạt năm học
                              <span className="text-sm" title="Trẻ chuyển vào lớp khi kích hoạt năm học">
                                <span className="fw-600">{c.childCount}</span> trẻ · <span className="fw-600">{c.plannedCount}</span> dự
                                kiến xếp / {c.capacity}
                              </span>
                            ) : (
                              <span className="text-sm">
                                <span className="fw-600">{c.childCount}</span> / {c.capacity} trẻ
                              </span>
                            )}
                            <ClassFillBadge status={c.fill || CLASS_FILL.OPEN} />
                          </div>
                          <div className="sc-bar" aria-hidden="true">
                            <div
                              className={`sc-bar__fill sc-bar__fill--${(c.fill || CLASS_FILL.OPEN).toLowerCase()}`}
                              style={{
                                width: `${Math.min(100, c.capacity ? Math.round(((c.childCount + (c.plannedCount || 0)) / c.capacity) * 100) : 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
      {assigning?.kind === 'teachers' && <AssignClassTeachersDialog cls={assigning.cls} schoolYear={year?.id} onClose={closeAssign} />}
    </section>
  );
}
