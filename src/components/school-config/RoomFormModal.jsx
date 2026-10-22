import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { saveRoom } from '@/services/masterDataService';
import { LOCATION_TYPE_LABELS, LOCATION_TYPES, MANAGER_LABELS, isRoomStaff } from '@/models/Location';
import { ROLE_LABELS } from '@/models/User';
import { SCHOOL_CONFIG_API } from '@/config/env';
import { validateRoom, hasErrors, errorsAfterChange, ROOM_LIMITS } from '@/utils/school-config/schoolConfigValidation';

// Nối BE thật: chỉ chọn được người có id của BE (chưa có API /users nên tài khoản mock không gửi được)
const isBeUser = (u) => !SCHOOL_CONFIG_API || /^\d+$/.test(String(u.id));

const empty = (campusId) => ({
  campusId: campusId || '',
  room: '',
  name: '',
  type: LOCATION_TYPES.CLASS,
  managerUserId: '',
  capacity: '',
  note: '',
});

/** Room Form (PROPOSED, outside SRS). Campus and type are locked once the room is in use. */
export function RoomFormModal({ open, onClose, room, defaultCampusId, campuses, users, existing }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => empty());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      room
        ? { ...empty(), ...room, managerUserId: room.managerUserId || '', capacity: room.capacity ?? '', note: room.note || '' }
        : empty(defaultCampusId),
    );
    setErrors({});
  }, [open, room, defaultCampusId]);

  const inUse = !!room && Object.keys(room.usage || {}).length > 0;
  const hasClass = !!room?.usage?.classes;
  const others = existing.filter((l) => l.id !== room?.id);
  const minCapacity = room?.minCapacity || 0;
  // Người phụ trách: nhân sự của điểm trường (Hiệu trưởng không gắn điểm trường nên luôn có trong danh sách)
  // Chỉ nhân sự đang hoạt động của đúng điểm trường đã chọn; Hiệu trưởng luôn chọn được
  const staff = form.campusId ? users.filter((u) => isRoomStaff(u, form.campusId, form.type) && isBeUser(u)) : [];

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => errorsAfterChange(e, patch, { ...form, ...patch }, ROOM_LIMITS));
  };
  const blurCheck = (field) => {
    const e = validateRoom(form, others, { minCapacity });
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  const submit = async () => {
    const e = validateRoom(form, others, { minCapacity });
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await saveRoom(room?.id || null, form, user);
      toast.success('Đã lưu thay đổi.', room ? 'Cập nhật phòng' : 'Thêm phòng');
      onClose(true);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={room ? `Sửa phòng ${room.room || room.name}` : 'Thêm phòng'}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu phòng
          </button>
        </>
      }
    >
      {errors._form && (
        <div className="alert alert--danger mb-12" role="alert">
          {errors._form}
        </div>
      )}
      <div className="grid-2">
        <FormField
          label="Điểm trường"
          required
          error={errors.campusId}
          hint={inUse ? 'Phòng đang được dùng nên không đổi điểm trường' : undefined}
        >
          <select
            className="select"
            value={form.campusId}
            disabled={inUse}
            onChange={(e) => set({ campusId: e.target.value, managerUserId: '' })}
          >
            <option value="">Chọn điểm trường</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Loại phòng"
          required
          error={errors.type}
          hint={hasClass ? 'Phòng đang gắn với lớp nên không đổi loại' : undefined}
        >
          <select className="select" value={form.type} disabled={hasClass} onChange={(e) => set({ type: e.target.value })}>
            {Object.values(LOCATION_TYPES).map((t) => (
              <option key={t} value={t}>
                {LOCATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Mã / số phòng" required error={errors.room} hint="Không trùng trong điểm trường, ví dụ P.101">
          <input className="input" value={form.room} onChange={(e) => set({ room: e.target.value })} onBlur={() => blurCheck('room')} />
        </FormField>
        <FormField label="Tên phòng" required error={errors.name} hint="Ví dụ Phòng học 101, Phòng Âm nhạc">
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => blurCheck('name')} />
        </FormField>
        {form.type === LOCATION_TYPES.CLASS ? (
          // Phòng học: người phụ trách tự theo giáo viên chủ nhiệm của lớp đang dùng phòng (năm học đang hoạt động)
          <FormField label="Người phụ trách" hint="Tự động: giáo viên chủ nhiệm của lớp đang dùng phòng (đổi ở Phân công giáo viên)">
            <input
              className="input"
              disabled
              value={users.find((u) => u.id === room?.managerUserId)?.fullName || 'Chưa có (phòng chưa có lớp / lớp chưa có chủ nhiệm)'}
            />
          </FormField>
        ) : (
          <FormField label="Người phụ trách" error={errors.managerUserId} hint={MANAGER_LABELS[form.type]}>
            <select
              className="select"
              value={form.managerUserId}
              disabled={!form.campusId}
              onChange={(e) => set({ managerUserId: e.target.value })}
            >
              <option value="">{form.campusId ? 'Chưa chọn' : 'Chọn điểm trường trước'}</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} – {ROLE_LABELS[u.role]}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField
          label="Sức chứa"
          required={form.type === LOCATION_TYPES.CLASS}
          error={errors.capacity}
          hint={
            minCapacity
              ? `Số nguyên dương, không nhỏ hơn ${minCapacity} (sĩ số tối đa của lớp đang dùng phòng)`
              : form.type === LOCATION_TYPES.CLASS
                ? 'Số nguyên dương do Hiệu trưởng đặt; sĩ số tối đa của lớp không vượt sức chứa'
                : 'Số người tối đa của phòng; nhập số nguyên dương hoặc để trống nếu chưa xác định'
          }
        >
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.capacity}
            onChange={(e) => set({ capacity: e.target.value })}
            onBlur={() => blurCheck('capacity')}
          />
        </FormField>
      </div>
      <FormField label="Ghi chú" error={errors.note} className="mt-12">
        <textarea className="textarea" rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </FormField>
    </Modal>
  );
}
