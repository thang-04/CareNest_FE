import { useMemo, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/form/FormField';
import { REASON_MAX_LENGTH } from '@/models/account/permissionConstants';
import { assignmentTargetOf, validateTemporaryPassword } from '@/utils/account/staffValidation';
import { validatePermissionChange } from '@/utils/account/permissionValidation';
import { todayInput } from '@/utils/format';

/** Lưu thay đổi quyền: lý do bắt buộc, ghi vào lịch sử (BE AUTH-14). */
export function ReasonModal({ title = 'Vì sao thay đổi?', changes, saving, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState();
  const submit = () => {
    const message = validatePermissionChange({ reason }).reason;
    setError(message);
    if (!message) onSubmit(reason.trim());
  };
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Quay lại
          </button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            <Save size={16} /> Lưu thay đổi
          </button>
        </>
      }
    >
      <p className="text-sm text-2 mb-12">Lý do được lưu vào lịch sử thay đổi.</p>
      <ul className="sh-reason-list">
        {changes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <FormField label="Lý do" required error={error}>
        <textarea
          className="textarea"
          rows={3}
          value={reason}
          maxLength={REASON_MAX_LENGTH}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Vd. Giao PHT Campus 2 phụ trách tuyển giáo viên"
        />
      </FormField>
    </Modal>
  );
}

export function ResetPasswordModal({ name, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState();
  const submit = () => {
    const message = validateTemporaryPassword(password);
    setError(message);
    if (!message) onSubmit(password);
  };
  return (
    <Modal
      open
      title={`Cấp lại mật khẩu tạm — ${name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit}>
            <Save size={16} /> Đặt mật khẩu tạm
          </button>
        </>
      }
    >
      <p className="text-sm text-2 mb-16">
        Mọi phiên đăng nhập đang mở của người này sẽ bị hủy. Giao mật khẩu tạm trực tiếp, không gửi qua kênh công khai.
      </p>
      <FormField label="Mật khẩu tạm" required error={error} hint="8–128 ký tự">
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={password}
          maxLength={128}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>
    </Modal>
  );
}

export function AssignModal({ role, structure, onClose, onSubmit }) {
  const target = assignmentTargetOf(role);
  const [campusId, setCampusId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [validFrom, setValidFrom] = useState(todayInput());
  const [error, setError] = useState();
  const classrooms = useMemo(
    () => structure.classrooms.filter((c) => !campusId || String(c.campusId) === String(campusId)),
    [structure.classrooms, campusId],
  );
  const submit = () => {
    if (target === 'campus' && !campusId) return setError('Chọn điểm trường');
    if (target === 'classroom' && !classroomId) return setError('Chọn lớp');
    return onSubmit(target === 'campus' ? { campusId, validFrom } : { classroomId, validFrom });
  };
  return (
    <Modal
      open
      title="Thêm nơi làm việc"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit}>
            <Save size={16} /> Lưu
          </button>
        </>
      }
    >
      <FormField label="Điểm trường" required={target === 'campus'} error={target === 'campus' ? error : undefined}>
        <select className="select" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
          <option value="">{target === 'classroom' ? 'Mọi điểm trường' : 'Chọn điểm trường'}</option>
          {structure.campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </FormField>
      {target === 'classroom' && (
        <FormField label="Lớp" required error={error}>
          <select className="select" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
            <option value="">Chọn lớp</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <FormField label="Từ ngày" required>
        <input className="input" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
      </FormField>
    </Modal>
  );
}

export function EndAssignmentModal({ assignment, scope, onClose, onSubmit }) {
  const [validTo, setValidTo] = useState(todayInput());
  const error = validTo < assignment.validFrom ? 'Ngày kết thúc phải sau ngày bắt đầu' : undefined;
  return (
    <Modal
      open
      title={`Kết thúc nơi làm việc — ${scope}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn--primary" disabled={!!error} onClick={() => onSubmit(validTo)}>
            <Save size={16} /> Kết thúc
          </button>
        </>
      }
    >
      <p className="text-sm text-2 mb-16">Nơi làm việc được giữ trong lịch sử; sau ngày cuối, người này không còn làm ở đây nữa.</p>
      <FormField label="Ngày cuối còn hiệu lực" required error={error}>
        <input className="input" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
      </FormField>
    </Modal>
  );
}
