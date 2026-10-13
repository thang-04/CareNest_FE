import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, DoorOpen, Info, Search, PauseCircle, RotateCcw, ChevronDown } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useRooms } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RoomStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { RoomFormModal } from '@/components/school-config/RoomFormModal';
import { RoomBlockedModal } from '@/components/school-config/RoomBlockedModal';
import { deleteRoom, setRoomStatus } from '@/services/masterDataService';
import { LOCATION_TYPE_LABELS, LOCATION_TYPES, ROOM_STATUS, ROOM_STATUS_LABELS } from '@/models/Location';
import { canManageRooms, canViewRooms, roomCampusIds } from '@/utils/school-config/schoolConfigPermissions';
import { roomCrumbs } from '@/utils/school-config/breadcrumbs';
import { normalizeText } from '@/utils/format';
import '@/styles/modules/school-config.css';

/**
 * Room List (PROPOSED 10/10/2026, outside SRS): the Principal manages the rooms of both campuses;
 * a Vice Principal views the rooms of the assigned campus.
 */
export default function RoomListPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const { rooms, loading, error, reload } = useRooms(schoolYear);
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({ campusId: params.get('campus') || '', type: '', status: '', keyword: '' }));
  const [modal, setModal] = useState(null); // { room }
  const [pending, setPending] = useState(null); // { kind: 'delete' | 'deactivate' | 'activate', room }
  const [blocked, setBlocked] = useState(null); // { room, actionLabel }
  // Điểm trường xem / sửa được theo quyền "Quản lý phòng ban" (Hiệu trưởng: tất cả)
  const viewIds = roomCampusIds(user, md.campuses);
  const editIds = roomCampusIds(user, md.campuses, true);
  const manage = editIds.length > 0;
  // Thêm phòng cần quyền Thêm; sửa phòng cần quyền Sửa (theo điểm trường)
  const createIds = roomCampusIds(user, md.campuses, 'create');
  const multiCampus = viewIds.length > 1;

  const shown = useMemo(() => {
    const kw = normalizeText(filters.keyword.trim());
    return rooms
      .filter((r) => !filters.campusId || r.campusId === filters.campusId)
      .filter((r) => !filters.type || r.type === filters.type)
      .filter((r) => !filters.status || r.status === filters.status)
      .filter((r) => !kw || normalizeText(`${r.room} ${r.name}`).includes(kw))
      .sort((a, b) => a.campusId.localeCompare(b.campusId) || (a.room || '').localeCompare(b.room || '', 'vi', { numeric: true }));
  }, [rooms, filters]);

  if (!canViewRooms(user))
    return (
      <div className="page">
        <Breadcrumb items={roomCrumbs()} />
        <h1 className="page__title">Phòng ban</h1>
        <ScNoAccess />
      </div>
    );

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const closeModal = (changed) => {
    setModal(null);
    if (changed) reload({ silent: true });
  };

  const ACTIONS = {
    delete: {
      title: 'Xóa phòng',
      label: 'Xóa phòng',
      danger: true,
      run: (r) => deleteRoom(r.id, user),
      done: 'Đã xóa bản ghi.',
      message: (r) => (
        <>
          Xóa phòng{' '}
          <b>
            {r.room} · {r.name}
          </b>
          ? Phòng biến mất khỏi danh sách và mọi ô chọn phòng; lớp năm cũ vẫn hiện tên phòng. Không hoàn tác được trên giao diện.
        </>
      ),
    },
    deactivate: {
      title: 'Ngừng sử dụng phòng',
      label: 'Ngừng sử dụng',
      run: (r) => setRoomStatus(r.id, ROOM_STATUS.INACTIVE, user),
      done: 'Đã chuyển phòng sang Ngừng sử dụng.',
      message: (r) => (
        <>
          Ngừng sử dụng phòng{' '}
          <b>
            {r.room} · {r.name}
          </b>
          ? Phòng không còn hiện trong danh sách chọn phòng của lớp nhưng vẫn giữ trong lịch sử.
        </>
      ),
    },
    activate: {
      title: 'Dùng lại phòng',
      label: 'Dùng lại',
      run: (r) => setRoomStatus(r.id, ROOM_STATUS.ACTIVE, user),
      done: 'Đã chuyển phòng sang Đang sử dụng.',
      message: (r) => (
        <>
          Dùng lại phòng{' '}
          <b>
            {r.room} · {r.name}
          </b>
          ?
        </>
      ),
    },
  };
  const action = pending && ACTIONS[pending.kind];

  const confirm = async () => {
    try {
      await action.run(pending.room);
      toast.success(action.done);
      setPending(null);
      reload({ silent: true });
    } catch (err) {
      setPending(null);
      toast.error(err.message, `Không ${action.label.toLowerCase()} được`);
    }
  };

  // Còn lớp của năm học chưa kết thúc dùng phòng: chưa ngừng hay xóa được, hiện lý do
  const ask = (kind, label) => (r) => (r.blockers.length ? setBlocked({ room: r, actionLabel: label }) : setPending({ kind, room: r }));
  const askDelete = ask('delete', 'Xóa');
  const askDeactivate = ask('deactivate', 'Ngừng sử dụng');

  const campuses = md.campuses.filter((c) => viewIds.includes(c.id));
  const formIds = modal?.room ? roomCampusIds(user, md.campuses, 'update') : createIds;
  const editCampuses = md.campuses.filter((c) => formIds.includes(c.id));
  const campusShort = (r) => md.campusById(r.campusId)?.shortName || '';
  const renderRow = (r) => (
    <tr key={r.id} className={r.status === ROOM_STATUS.INACTIVE ? 'muted' : undefined}>
      <td className="fw-600 nowrap">{r.room || '—'}</td>
      <td>{r.name}</td>
      <td>{LOCATION_TYPE_LABELS[r.type]}</td>
      <td className="center">{r.capacity ?? <span className="muted">—</span>}</td>
      <td>{r.yearClasses.length ? r.yearClasses.join(', ') : <span className="muted">—</span>}</td>
      <td>
        {md.userById(r.managerUserId)?.fullName || <span className="muted">—</span>}
        {r.managerFromClass && r.managerUserId && <div className="text-xs muted">Chủ nhiệm lớp</div>}
      </td>
      <td>
        <RoomStatusBadge status={r.status} />
      </td>
      {manage && (
        <td className="right nowrap">
          {canManageRooms(user, r.campusId, 'update') && (
            <button
              className="icon-btn"
              title="Sửa"
              aria-label={`Sửa phòng ${r.room} ${campusShort(r)}`}
              onClick={() => setModal({ room: r })}
            >
              <Pencil size={17} />
            </button>
          )}
          {canManageRooms(user, r.campusId, 'delete') && (
            <>
              {r.status === ROOM_STATUS.ACTIVE ? (
                <button
                  className="icon-btn"
                  title={r.blockers.length ? `Chưa ngừng được: ${r.blockers.join('; ')}` : 'Ngừng sử dụng'}
                  aria-label={`Ngừng sử dụng phòng ${r.room} ${campusShort(r)}`}
                  onClick={() => askDeactivate(r)}
                >
                  <PauseCircle size={17} />
                </button>
              ) : (
                <button
                  className="icon-btn"
                  title="Dùng lại"
                  aria-label={`Dùng lại phòng ${r.room} ${campusShort(r)}`}
                  onClick={() => setPending({ kind: 'activate', room: r })}
                >
                  <RotateCcw size={17} />
                </button>
              )}
              <button className="icon-btn" title="Xóa" aria-label={`Xóa phòng ${r.room} ${campusShort(r)}`} onClick={() => askDelete(r)}>
                <Trash2 size={17} />
              </button>
            </>
          )}
        </td>
      )}
    </tr>
  );
  // Khối theo điểm trường; lọc điểm trường thì chỉ còn khối đó. Khối thu gọn lưu trên URL (?collapsed=c1)
  const blocks = campuses
    .map((campus) => ({ campus, list: shown.filter((r) => r.campusId === campus.id) }))
    .filter((b) => b.list.length > 0);
  const collapsed = new Set((params.get('collapsed') || '').split(',').filter(Boolean));
  const toggleCampus = (id) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next.size) p.set('collapsed', [...next].join(','));
        else p.delete('collapsed');
        return p;
      },
      { replace: true },
    );
  };

  return (
    <div className="page">
      <Breadcrumb items={roomCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Phòng ban</h1>
        {createIds.length > 0 && (
          <button className="btn btn--primary btn--lg" onClick={() => setModal({ room: null })}>
            <Plus size={18} /> Thêm phòng
          </button>
        )}
      </div>

      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {manage
            ? 'Phòng đang là phòng của lớp năm học chưa kết thúc thì chưa ngừng sử dụng hay xóa được: đổi phòng cho lớp trước.'
            : 'Bạn đang xem phòng của điểm trường được phân công (chỉ xem). Hiệu trưởng giao quyền sửa ở màn Phân công Phó hiệu trưởng.'}
        </div>
      </div>

      <div className="card mb-16">
        <div className="filter-bar">
          <label className="search-box sc-search">
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã hoặc tên phòng..."
              aria-label="Tìm mã hoặc tên phòng"
              value={filters.keyword}
              maxLength={50}
              onChange={(e) => setFilter({ keyword: e.target.value })}
            />
          </label>
          {multiCampus && (
            <select
              className="select sc-inline-select"
              aria-label="Điểm trường"
              value={filters.campusId}
              onChange={(e) => setFilter({ campusId: e.target.value })}
            >
              <option value="">Tất cả điểm trường</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="select sc-inline-select"
            aria-label="Loại phòng"
            value={filters.type}
            onChange={(e) => setFilter({ type: e.target.value })}
          >
            <option value="">Tất cả loại phòng</option>
            {Object.values(LOCATION_TYPES).map((t) => (
              <option key={t} value={t}>
                {LOCATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            className="select sc-inline-select"
            aria-label="Trạng thái"
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value })}
          >
            <option value="">Tất cả trạng thái</option>
            {[ROOM_STATUS.ACTIVE, ROOM_STATUS.INACTIVE].map((k) => (
              <option key={k} value={k}>
                {ROOM_STATUS_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <LoadingState />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={DoorOpen}
            title={rooms.length ? 'Không có phòng phù hợp' : 'Chưa có phòng'}
            description={rooms.length ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Thêm phòng trước khi xếp phòng cho lớp.'}
          />
        ) : (
          <div className="sc-classes">
            {blocks.map(({ campus, list }) => {
              const open = !collapsed.has(campus.id);
              return (
                <section key={campus.id} className={`sc-cgroup ${open ? '' : 'sc-cgroup--collapsed'}`} aria-label={campus.name}>
                  <header className="sc-cgroup__head">
                    <button
                      type="button"
                      className="sc-cgroup__title sc-cgroup__toggle"
                      aria-expanded={open}
                      aria-controls={`rooms-${campus.id}`}
                      onClick={() => toggleCampus(campus.id)}
                    >
                      <span className="sc-cgroup__name">
                        <ChevronDown size={18} className="sc-cgroup__chevron" aria-hidden="true" />
                        {campus.shortName || campus.name}
                      </span>
                      <span className="sc-cgroup__meta">
                        <span className="chip chip--gray">{list.length} phòng</span>
                        <span className="chip chip--gray">{list.filter((r) => r.type === LOCATION_TYPES.CLASS).length} phòng học</span>
                      </span>
                    </button>
                  </header>
                  {open && (
                    <div id={`rooms-${campus.id}`} className="table-wrap sc-table-flat">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Mã phòng</th>
                            <th>Tên phòng</th>
                            <th>Loại</th>
                            <th className="center">Sức chứa</th>
                            <th>Lớp ({schoolYear})</th>
                            <th>Người phụ trách</th>
                            <th>Trạng thái</th>
                            {manage && <th className="right">Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>{list.map(renderRow)}</tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <RoomFormModal
        open={!!modal}
        onClose={closeModal}
        room={modal?.room}
        defaultCampusId={filters.campusId || (editCampuses.length === 1 ? editCampuses[0].id : '')}
        campuses={editCampuses}
        users={md.users}
        existing={rooms}
      />
      {blocked && <RoomBlockedModal room={blocked.room} actionLabel={blocked.actionLabel} onClose={() => setBlocked(null)} />}
      <ConfirmationModal
        open={!!pending}
        title={action?.title}
        message={pending && action?.message(pending.room)}
        confirmLabel={action?.label}
        danger={action?.danger}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
