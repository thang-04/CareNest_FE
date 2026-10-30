import { useMemo, useState } from 'react';
import { Plus, Save, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useRooms, useSchoolStructure } from '@/hooks/school-config/useSchoolConfig';
import { FormField } from '@/components/form/FormField';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { saveClass } from '@/services/school-config/schoolConfigService';
import { saveRoom } from '@/services/masterDataService';
import { isActiveLocation, LOCATION_TYPES } from '@/models/Location';
import { classSizeLimit, hasErrors, validateClass, validateRoom } from '@/utils/school-config/schoolConfigValidation';

let seq = 0;
const newKey = (kind) => `new-${kind}-${++seq}`;
const isNew = (key) => String(key).startsWith('new-');

/**
 * Thiết lập năm học › bước Phòng & lớp (Cần chọn "Bảng nhập nhanh" 30/10/2026): lớp của từng điểm trường nhập thẳng
 * trên bảng. withRooms: thêm bảng phòng nhập nhanh, lớp chọn được cả phòng vừa thêm, "Lưu tất cả" lưu phòng trước.
 * Bước 2 hiện dùng màn Phòng ban đầy đủ ở trên để Hiệu trưởng xem xét lại phòng (Cần 30/10/2026) nên tắt withRooms.
 */
export function YearClassesQuickEdit({ yearId, withRooms = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const campuses = useMemo(() => md.campuses.filter((c) => c.status !== 'INACTIVE'), [md.campuses]);
  const { rooms: savedRooms, loading: roomsLoading, error: roomsError, reload: reloadRooms } = useRooms(yearId);
  const { structure, loading, error, reload } = useSchoolStructure(yearId, '');
  const ageGroups = structure?.ageGroups || [];
  const savedClasses = useMemo(() => structure?.classes || [], [structure]);

  const [campusPick, setCampusPick] = useState('');
  const campusId = campusPick || campuses[0]?.id || '';
  // Sửa / thêm chưa lưu: key = id (dòng đã có) hoặc new-... (dòng mới)
  const [roomDrafts, setRoomDrafts] = useState({});
  const [classDrafts, setClassDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const classRooms = useMemo(() => savedRooms.filter((r) => r.type === LOCATION_TYPES.CLASS && isActiveLocation(r)), [savedRooms]);
  const allRooms = useMemo(
    () => [
      ...classRooms.map((r) => ({ ...r, key: r.id, ...roomDrafts[r.id] })),
      ...Object.entries(roomDrafts)
        .filter(([k]) => isNew(k))
        .map(([key, d]) => ({ key, id: key, ...d })),
    ],
    [classRooms, roomDrafts],
  );
  const allClasses = useMemo(
    () => [
      ...savedClasses.map((c) => ({ ...c, key: c.id, locationId: c.locationId || '', ...classDrafts[c.id] })),
      ...Object.entries(classDrafts)
        .filter(([k]) => isNew(k))
        .map(([key, d]) => ({ key, id: key, ...d })),
    ],
    [savedClasses, classDrafts],
  );
  const rooms = allRooms.filter((r) => r.campusId === campusId);
  const classes = allClasses.filter((c) => c.campusId === campusId);
  const dirty = Object.keys(roomDrafts).length + Object.keys(classDrafts).length;

  if (error || roomsError) return <ErrorState error={error || roomsError} onRetry={reload} />;
  if ((loading && !structure) || (roomsLoading && !savedRooms.length && !structure)) return <LoadingState />;

  const roomOf = (id) => allRooms.find((r) => r.id === id) || null;
  const roomForm = (r) => ({ ...r, type: LOCATION_TYPES.CLASS, capacity: r.capacity ?? '' });
  const checkRoom = (r) => {
    const used = allClasses.filter((c) => c.locationId === r.id).map((c) => Number(c.capacity) || 0);
    return validateRoom(
      roomForm(r),
      allRooms.filter((x) => x.key !== r.key),
      { minCapacity: used.length ? Math.max(...used) : 0 },
    );
  };
  const checkClass = (c) => {
    const e = validateClass(
      { ...c, schoolYear: yearId },
      allClasses.filter((x) => x.key !== c.key).map((x) => ({ ...x, schoolYear: yearId })),
      {
        ageGroup: ageGroups.find((g) => g.id === c.ageGroupId) || null,
        room: roomOf(c.locationId),
        enrolled: c.childCount || 0,
      },
    );
    const other = c.locationId && allClasses.find((x) => x.key !== c.key && x.locationId === c.locationId);
    if (!e.locationId && other) e.locationId = `Phòng đã có lớp ${other.name || 'khác'}`;
    return e;
  };

  const editRoom = (key, patch) => {
    setRoomDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const editClass = (c, patch) => {
    const next = { ...c, ...patch };
    // Lớp mới: sĩ số mặc định = mức tối đa cho phép (min nhóm tuổi, sức chứa phòng)
    if (!c.childCount && ('ageGroupId' in patch || 'locationId' in patch)) {
      const { max } = classSizeLimit(
        ageGroups.find((g) => g.id === next.ageGroupId),
        roomOf(next.locationId),
      );
      if (max < Number.MAX_SAFE_INTEGER && (isNew(c.key) || Number(next.capacity) > max)) patch = { ...patch, capacity: max };
    }
    setClassDrafts((d) => ({ ...d, [c.key]: { ...d[c.key], ...patch } }));
    setErrors((e) => ({ ...e, [c.key]: undefined }));
  };
  const blurRoom = (r, field) => {
    const msg = checkRoom(r)[field];
    if (msg) setErrors((e) => ({ ...e, [r.key]: { ...e[r.key], [field]: msg } }));
  };
  const blurClass = (c, field) => {
    const msg = checkClass(c)[field];
    if (msg) setErrors((e) => ({ ...e, [c.key]: { ...e[c.key], [field]: msg } }));
  };
  const addRoom = () =>
    setRoomDrafts((d) => ({ ...d, [newKey('room')]: { campusId, room: '', name: '', capacity: '', managerUserId: '', note: '' } }));
  const addClass = () =>
    setClassDrafts((d) => ({
      ...d,
      [newKey('class')]: { campusId, name: '', ageGroupId: '', locationId: '', capacity: '', childCount: 0 },
    }));
  const dropDraft = (setter, key) => {
    setter(({ [key]: _k, ...rest }) => rest);
    setErrors(({ [key]: _k, ...rest }) => rest);
  };

  const saveAll = async () => {
    const roomRows = allRooms.filter((r) => roomDrafts[r.key]);
    const classRows = allClasses.filter((c) => classDrafts[c.key]);
    const found = {};
    roomRows.forEach((r) => {
      const e = checkRoom(r);
      if (hasErrors(e)) found[r.key] = e;
    });
    classRows.forEach((c) => {
      const e = checkClass(c);
      if (hasErrors(e)) found[c.key] = e;
    });
    setErrors(found);
    if (hasErrors(found)) {
      const bad = [...roomRows, ...classRows].find((x) => found[x.key]);
      if (bad && bad.campusId !== campusId) setCampusPick(bad.campusId);
      return;
    }
    setSaving(true);
    const failed = {};
    const idOf = {};
    let saved = 0;
    for (const r of roomRows) {
      try {
        const { key, id, ...form } = roomForm(r);
        const res = await saveRoom(isNew(key) ? null : id, form, user);
        idOf[key] = res?.id;
        saved += 1;
        dropDraft(setRoomDrafts, key);
      } catch (err) {
        failed[r.key] = err.details || { room: err.message };
      }
    }
    for (const c of classRows) {
      const locationId = idOf[c.locationId] || c.locationId;
      if (isNew(locationId)) {
        failed[c.key] = { locationId: 'Phòng chưa lưu được nên chưa lưu lớp' };
        continue;
      }
      try {
        const { key, id, childCount: _n, ...form } = c;
        await saveClass(isNew(key) ? null : id, { ...form, locationId, schoolYear: yearId, capacity: Number(c.capacity) }, user);
        saved += 1;
        dropDraft(setClassDrafts, key);
      } catch (err) {
        failed[c.key] = err.details || { name: err.message };
      }
    }
    // Lớp chưa lưu được vẫn trỏ phòng vừa tạo: đổi sang id thật
    setClassDrafts((d) =>
      Object.fromEntries(Object.entries(d).map(([k, v]) => [k, idOf[v.locationId] ? { ...v, locationId: idOf[v.locationId] } : v])),
    );
    setErrors(failed);
    setSaving(false);
    reloadRooms({ silent: true });
    reload({ silent: true });
    if (saved) toast.success(`Đã lưu ${saved} dòng.`);
    if (hasErrors(failed)) toast.error('Một số dòng chưa lưu được, xem lỗi đỏ trên bảng.');
  };

  const cell = (key, field, control) => <FormField error={errors[key]?.[field]}>{control}</FormField>;
  const usedBy = (roomId) =>
    allClasses
      .filter((c) => c.locationId === roomId)
      .map((c) => c.name)
      .filter(Boolean)
      .join(', ');

  return (
    <>
      {campuses.length > 1 && (
        <div className="row gap-2 mb-16">
          {campuses.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn ${c.id === campusId ? 'btn--primary' : ''}`}
              onClick={() => setCampusPick(c.id)}
            >
              {c.shortName || c.name}
            </button>
          ))}
        </div>
      )}

      {withRooms && (
        <section className="card mb-16">
          <div className="card__header">
            <h2 className="card__title">Phòng học ({rooms.length})</h2>
            <button className="btn btn--sm" type="button" onClick={addRoom}>
              <Plus size={15} /> Thêm phòng
            </button>
          </div>
          <div className="table-wrap sc-table-flat">
            <table className="table table--grid table--compact sc-quick">
              <thead>
                <tr>
                  <th>Mã phòng</th>
                  <th>Tên phòng</th>
                  <th className="num">Sức chứa</th>
                  <th>Lớp dùng phòng</th>
                  <th className="cell--actions" aria-label="Bỏ dòng" />
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Chưa có phòng học.
                    </td>
                  </tr>
                )}
                {rooms.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {cell(
                        r.key,
                        'room',
                        <input
                          className="input"
                          aria-label="Mã phòng"
                          placeholder="P.101"
                          value={r.room || ''}
                          onChange={(e) => editRoom(r.key, { room: e.target.value })}
                          onBlur={() => blurRoom(r, 'room')}
                        />,
                      )}
                    </td>
                    <td>
                      {cell(
                        r.key,
                        'name',
                        <input
                          className="input"
                          aria-label="Tên phòng"
                          value={r.name || ''}
                          onChange={(e) => editRoom(r.key, { name: e.target.value })}
                          onBlur={() => blurRoom(r, 'name')}
                        />,
                      )}
                    </td>
                    <td className="num">
                      {cell(
                        r.key,
                        'capacity',
                        <input
                          className="input sc-quick__num"
                          aria-label="Sức chứa"
                          inputMode="numeric"
                          value={r.capacity ?? ''}
                          onChange={(e) => editRoom(r.key, { capacity: e.target.value.trim() })}
                          onBlur={() => blurRoom(r, 'capacity')}
                        />,
                      )}
                    </td>
                    <td>{usedBy(r.id) || <span className="muted">—</span>}</td>
                    <td className="cell--actions">
                      {isNew(r.key) && (
                        <button
                          className="btn btn--sm btn--ghost"
                          type="button"
                          aria-label="Bỏ dòng"
                          onClick={() => dropDraft(setRoomDrafts, r.key)}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card mb-16">
        <div className="card__header">
          <h2 className="card__title">Lớp học ({classes.length})</h2>
          <button className="btn btn--sm" type="button" onClick={addClass} disabled={!ageGroups.length}>
            <Plus size={15} /> Thêm lớp
          </button>
        </div>
        <div className="table-wrap sc-table-flat">
          <table className="table table--grid table--compact sc-quick">
            <thead>
              <tr>
                <th>Tên lớp</th>
                <th>Nhóm tuổi</th>
                <th>Phòng</th>
                <th className="num">Sĩ số tối đa</th>
                <th className="num">Số trẻ</th>
                <th className="cell--actions" aria-label="Bỏ dòng" />
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Chưa có lớp.
                  </td>
                </tr>
              )}
              {classes.map((c) => (
                <tr key={c.key}>
                  <td>
                    {cell(
                      c.key,
                      'name',
                      <input
                        className="input"
                        aria-label="Tên lớp"
                        value={c.name || ''}
                        onChange={(e) => editClass(c, { name: e.target.value })}
                        onBlur={() => blurClass(c, 'name')}
                      />,
                    )}
                  </td>
                  <td>
                    {cell(
                      c.key,
                      'ageGroupId',
                      <select
                        className="select"
                        aria-label="Nhóm tuổi"
                        value={c.ageGroupId || ''}
                        disabled={c.childCount > 0}
                        onChange={(e) => editClass(c, { ageGroupId: e.target.value })}
                        onBlur={() => blurClass(c, 'ageGroupId')}
                      >
                        <option value="">Chọn nhóm tuổi</option>
                        {ageGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>,
                    )}
                  </td>
                  <td>
                    {cell(
                      c.key,
                      'locationId',
                      <select
                        className="select"
                        aria-label="Phòng"
                        value={c.locationId || ''}
                        onChange={(e) => editClass(c, { locationId: e.target.value })}
                        onBlur={() => blurClass(c, 'locationId')}
                      >
                        <option value="">Chọn phòng</option>
                        {rooms
                          .filter((r) => r.room)
                          .map((r) => {
                            const taken = allClasses.find((x) => x.key !== c.key && x.locationId === r.id);
                            return (
                              <option key={r.key} value={r.id} disabled={!!taken}>
                                {r.room}
                                {r.capacity ? ` · ${r.capacity} chỗ` : ''}
                                {taken ? ` · ${taken.name || 'đã có lớp'}` : ''}
                              </option>
                            );
                          })}
                      </select>,
                    )}
                  </td>
                  <td className="num">
                    {cell(
                      c.key,
                      'capacity',
                      <input
                        className="input sc-quick__num"
                        aria-label="Sĩ số tối đa"
                        inputMode="numeric"
                        value={c.capacity ?? ''}
                        onChange={(e) => editClass(c, { capacity: e.target.value.trim() })}
                        onBlur={() => blurClass(c, 'capacity')}
                      />,
                    )}
                  </td>
                  <td className="num">{c.childCount || 0}</td>
                  <td className="cell--actions">
                    {isNew(c.key) && (
                      <button
                        className="btn btn--sm btn--ghost"
                        type="button"
                        aria-label="Bỏ dòng"
                        onClick={() => dropDraft(setClassDrafts, c.key)}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="row sc-end mb-16">
        <button className="btn btn--primary" type="button" onClick={saveAll} disabled={saving || !dirty}>
          {saving ? <Spinner small /> : <Save size={16} />} Lưu tất cả{dirty ? ` (${dirty})` : ''}
        </button>
      </div>
    </>
  );
}
