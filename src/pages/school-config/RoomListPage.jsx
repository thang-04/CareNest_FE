import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, DoorOpen, PauseCircle, RotateCcw, ChevronDown } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useRooms } from '@/hooks/school-config/useSchoolConfig';
import { useConfigYear } from '@/hooks/school-config/useConfigYear';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RowActions } from '@/components/ui/RowActions';
import { RoomStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { RoomFormModal } from '@/components/school-config/RoomFormModal';
import { RoomBlockedModal } from '@/components/school-config/RoomBlockedModal';
import { deleteRoom, setRoomStatus } from '@/services/masterDataService';
import { LOCATION_TYPE_LABELS, LOCATION_TYPES, ROOM_STATUS, ROOM_STATUS_LABELS } from '@/models/Location';
import { canManageRooms, canViewRooms, roomCampusIds } from '@/utils/school-config/schoolConfigPermissions';
import { roomCrumbs } from '@/utils/school-config/breadcrumbs';
import { normalizeText } from '@/utils/format';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { YearReadOnlyNotice } from '@/components/school-config/YearReadOnlyNotice';
import '@/styles/modules/school-config.css';

/**
 * Room List (PROPOSED 10/10/2026, outside SRS): the Principal manages the rooms of both campuses;
 * a Vice Principal views the rooms of the assigned campus.
 */
const ROOM_PAGE_SIZE = 10;

export default function RoomListPage() {
  const { user } = useAuth();
  const toast = useToast();
  // ?year= (từ Chuẩn bị năm học) chọn luôn năm trên header
  useConfigYear();
  const { schoolYear, yearReadOnly } = useSchoolYear();
  const md = useMasterData();
  const { rooms, loading, error, reload } = useRooms(schoolYear);
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({ campusId: params.get('campus') || '', type: '', status: '', keyword: '' }));
  const [modal, setModal] = useState(null); // { room }
  const [pending, setPending] = useState(null); // { kind: 'delete' | 'deactivate' | 'activate', room }
  const [pendingError, setPendingError] = useState('');
  const [blocked, setBlocked] = useState(null); // { room, actionLabel }
  // Điểm trường xem / sửa được theo quyền "Quản lý phòng ban" (Hiệu trưởng: tất cả)
  const viewIds = roomCampusIds(user, md.campuses);
  const editIds = yearReadOnly ? [] : roomCampusIds(user, md.campuses, true);
  const manage = editIds.length > 0;
  // Thêm phòng cần quyền Thêm; sửa phòng cần quyền Sửa (theo điểm trường)
  const createIds = yearReadOnly ? [] : roomCampusIds(user, md.campuses, 'create');
  const multiCampus = viewIds.length > 1;

  const shown = useMemo(() => {
    const kw = normalizeText(filters.keyword.trim());
    return rooms
      .filter((r) => !filters.campusId || r.campusId === filters.campusId)
      .filter((r) => !filters.type || r.type === filters.type)
      .filter((r) => yearReadOnly || !filters.status || r.status === filters.status)
      .filter((r) => !kw || normalizeText(`${r.room} ${r.name}`).includes(kw))
      .sort((a, b) => a.campusId.localeCompare(b.campusId) || (a.room || '').localeCompare(b.room || '', 'vi', { numeric: true }));
  }, [rooms, filters, yearReadOnly]);

  // Khối điểm trường mở nằm trên URL (?expanded=c1): mở trang thì mọi khối thu gọn, chỉ khối mở mới vẽ bảng.
  // Vừa đổi tìm kiếm / bộ lọc: mở các khối có phòng khớp (chỉ lúc đổi), bỏ lọc hết thì thu gọn lại.
  const [pages, setPages] = useState({});
  const lastFilters = useRef(JSON.stringify(filters));
  useEffect(() => {
    const key = JSON.stringify(filters);
    if (key === lastFilters.current) return;
    lastFilters.current = key;
    setPages({});
    const any = Object.values(filters).some(Boolean);
    const ids = any ? [...new Set(shown.map((r) => r.campusId))] : [];
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('collapsed');
        if (ids.length) p.set('expanded', ids.join(','));
        else p.delete('expanded');
        return p;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

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
      setPendingError(err.message);
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
        {r.managerName || md.userById(r.managerUserId)?.fullName || <span className="muted">—</span>}
        {r.managerFromClass && r.managerUserId && <div className="text-xs muted">Chủ nhiệm lớp</div>}
      </td>
      {!yearReadOnly && (
        <td className="center">
          <RoomStatusBadge status={r.status} />
        </td>
      )}
      {manage && (
        <td className="cell--actions">
          <RowActions
            edit={canManageRooms(user, r.campusId, 'update') ? { onClick: () => setModal({ room: r }), label: 'Sửa phòng' } : null}
            menu={
              canManageRooms(user, r.campusId, 'delete')
                ? [
                    r.status === ROOM_STATUS.ACTIVE
                      ? { label: 'Ngừng sử dụng', icon: PauseCircle, danger: true, onClick: () => askDeactivate(r) }
                      : { label: 'Dùng lại', icon: RotateCcw, onClick: () => setPending({ kind: 'activate', room: r }) },
                    { label: 'Xóa phòng', icon: Trash2, danger: true, onClick: () => askDelete(r) },
                  ]
                : []
            }
            name={`${r.room} ${campusShort(r)}`}
          />
        </td>
      )}
    </tr>
  );
  // Khối theo điểm trường; lọc điểm trường thì chỉ còn khối đó
  const blocks = campuses
    .map((campus) => ({ campus, list: shown.filter((r) => r.campusId === campus.id) }))
    .filter((b) => b.list.length > 0);
  const expanded = new Set((params.get('expanded') || '').split(',').filter(Boolean));
  const toggleCampus = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('collapsed');
        if (next.size) p.set('expanded', [...next].join(','));
        else p.delete('expanded');
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
      <YearReadOnlyNotice />

      <div className="card mb-16">
        <div className="filter-bar">
          <SearchSubmit
            className="sc-search"
            value={filters.keyword}
            placeholder="Tìm mã hoặc tên phòng"
            label="Tìm mã hoặc tên phòng"
            onSearch={(text) => setFilter({ keyword: text })}
          />
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
          {/* Năm đã kết thúc: trạng thái là tình trạng hiện tại của phòng, không thuộc năm cũ ⇒ ẩn */}
          {!yearReadOnly && (
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
          )}
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
              const open = expanded.has(campus.id);
              const page = Math.min(pages[campus.id] || 1, Math.max(1, Math.ceil(list.length / ROOM_PAGE_SIZE)));
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
                      <table className="table table--grid table--compact">
                        <thead>
                          <tr>
                            <th>Mã phòng</th>
                            <th>Tên phòng</th>
                            <th>Loại</th>
                            <th className="center">Sức chứa</th>
                            <th>Lớp ({schoolYear})</th>
                            <th>Người phụ trách</th>
                            {!yearReadOnly && <th className="center">Trạng thái</th>}
                            {manage && <th className="cell--actions">Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>{paginate(list, page, ROOM_PAGE_SIZE).map(renderRow)}</tbody>
                      </table>
                    </div>
                  )}
                  {open && list.length > ROOM_PAGE_SIZE && (
                    <Pagination
                      page={page}
                      total={list.length}
                      pageSize={ROOM_PAGE_SIZE}
                      onChange={(p) => setPages((m) => ({ ...m, [campus.id]: p }))}
                      unit="phòng"
                    />
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
        error={pendingError}
        onClose={() => {
          setPending(null);
          setPendingError('');
        }}
      />
    </div>
  );
}
