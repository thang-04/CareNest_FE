import { useState } from 'react';
import { KeyRound, Lock, Printer, Trash2, Unlock, UserPlus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useChildGuardians } from '@/hooks/account/useGuardians';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { PrintHeader } from '@/components/print/PrintHeader';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { addGuardian, removeGuardian, resetParentPassword, updateParentStatus } from '@/services/account/guardianService';
import { GUARDIAN_RELATIONSHIPS, GUARDIAN_RELATIONSHIP_LABELS } from '@/models/account/guardianConstants';
import { validateGuardian } from '@/utils/account/guardianValidation';
import { avatarTone, formatDate, initials } from '@/utils/format';

const EMPTY_FORM = { phone: '', fullName: '', relationship: 'MOTHER' };

/**
 * Phụ huynh của một bé (BE AUTH-18, AUTH-19): xem, thêm (SĐT), gỡ, khóa/mở, cấp lại mật khẩu tạm.
 * Mật khẩu tạm chỉ hiện một lần trong phiếu in; không lưu ở đâu.
 */
export function GuardianPanel({ child, classroomName, onChanged, initialAdding = false, _isModal = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: guardians, loading, error, reload } = useChildGuardians(child.id);
  const [adding, setAdding] = useState(initialAdding);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [slip, setSlip] = useState(null);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
  };

  const refresh = () => {
    reload({ silent: true });
    onChanged();
  };

  const add = async (e) => {
    e.preventDefault();
    const found = validateGuardian(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const created = await addGuardian(child.id, form, user);
      setForm(EMPTY_FORM);
      setAdding(false);
      refresh();
      if (created.newAccount)
        setSlip({ username: created.username, fullName: created.fullName, password: created.temporaryPassword }); // carenest:allow-secret
      else toast.success('Số điện thoại đã có tài khoản phụ huynh; đã liên kết thêm bé này, mật khẩu giữ nguyên.');
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không thêm được phụ huynh');
    } finally {
      setSaving(false);
    }
  };

  const run = async (action, success) => {
    try {
      const result = await action();
      setConfirm(null);
      refresh();
      if (success) toast.success(success);
      return result;
    } catch (err) {
      setConfirm(null);
      toast.error(err.message, 'Không thực hiện được');
      return null;
    }
  };

  const onConfirm = async () => {
    const g = confirm.guardian;
    if (confirm.type === 'password') {
      const result = await run(() => resetParentPassword(g.userId, user));
      if (result) setSlip({ username: result.username, fullName: g.fullName, password: result.temporaryPassword }); // carenest:allow-secret
      return;
    }
    if (confirm.type === 'remove') {
      await run(() => removeGuardian(child.id, g.userId, user), 'Đã gỡ phụ huynh khỏi bé.');
      return;
    }
    const active = g.status === 'ACTIVE';
    await run(
      () => updateParentStatus(g.userId, active ? 'INACTIVE' : 'ACTIVE', user),
      active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.',
    );
  };

  const target = confirm?.guardian;
  const dialog = !confirm
    ? {}
    : confirm.type === 'remove'
      ? {
          title: 'Gỡ phụ huynh khỏi bé',
          message: `Gỡ ${target.fullName} khỏi bé ${child.fullName}? Tài khoản vẫn còn nhưng không xem được bé này nữa.`,
          danger: true,
        }
      : confirm.type === 'password'
        ? {
            title: 'Cấp mật khẩu mới và in phiếu',
            message: `Cấp mật khẩu tạm mới cho ${target.fullName}? Phiếu cũ hết hiệu lực, mọi phiên đăng nhập đang mở bị hủy.`,
          }
        : {
            title: target.status === 'ACTIVE' ? 'Khóa tài khoản phụ huynh' : 'Mở khóa tài khoản phụ huynh',
            message: `${target.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'} tài khoản ${target.fullName}?`,
            danger: target.status === 'ACTIVE',
          };
  const showForm = adding || (guardians && !guardians.length);

  return (
    <>
      <p className="text-sm text-2 pa-panel__meta">
        {classroomName || 'Chưa xếp lớp'} · sinh {formatDate(child.dateOfBirth)}
      </p>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          {!guardians.length && (
            <div className="alert alert--warning mb-16">Bé chưa có tài khoản phụ huynh. Nhập số điện thoại phụ huynh để tạo.</div>
          )}
          {guardians.map((g) => (
            <div key={g.userId} className="pa-guardian">
              <div className="pa-guardian__row">
                <span className={`avatar avatar--sm avatar--tone-${avatarTone(g.fullName)}`} aria-hidden="true">
                  {initials(g.fullName)}
                </span>
                <div className="pa-guardian__main">
                  <div className="pa-guardian__identity">
                    <strong className="pa-guardian__name">{g.fullName}</strong>
                    <span className="pa-guardian__relation">{GUARDIAN_RELATIONSHIP_LABELS[g.relationship]}</span>
                  </div>
                  <div className="pa-guardian__username">Tài khoản: {g.username}</div>
                </div>
                <AccountStatusBadge status={g.status} />
              </div>
              <div className="pa-guardian__actions">
                <button type="button" className="btn btn--sm" onClick={() => setConfirm({ type: 'password', guardian: g })}>
                  <KeyRound size={15} /> Cấp mật khẩu mới
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--outline-danger"
                  onClick={() => setConfirm({ type: 'remove', guardian: g })}
                >
                  <Trash2 size={15} /> Gỡ khỏi bé
                </button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirm({ type: 'status', guardian: g })}>
                  {g.status === 'ACTIVE' ? <Lock size={15} /> : <Unlock size={15} />} {g.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                </button>
              </div>
            </div>
          ))}

          {showForm ? (
            <form onSubmit={add} noValidate className="pa-add">
              <h3 className="section-title">{guardians.length ? 'Thêm phụ huynh khác' : 'Tạo tài khoản phụ huynh'}</h3>
              <FormField label="Số điện thoại" required error={errors.phone} hint="Dùng làm tên đăng nhập">
                <input
                  className="input"
                  inputMode="tel"
                  value={form.phone}
                  maxLength={20}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </FormField>
              <FormField label="Họ tên phụ huynh" required error={errors.fullName}>
                <input className="input" value={form.fullName} maxLength={150} onChange={(e) => set({ fullName: e.target.value })} />
              </FormField>
              <FormField label="Quan hệ với bé" required error={errors.relationship}>
                <select className="select" value={form.relationship} onChange={(e) => set({ relationship: e.target.value })}>
                  {GUARDIAN_RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>
                      {GUARDIAN_RELATIONSHIP_LABELS[r]}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="row" style={{ gap: 8 }}>
                {guardians.length > 0 && (
                  <button className="btn" type="button" onClick={() => setAdding(false)}>
                    Hủy
                  </button>
                )}
                <button className="btn btn--primary" type="submit" disabled={saving}>
                  <UserPlus size={16} /> Tạo / liên kết tài khoản
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn mt-16" onClick={() => setAdding(true)}>
              <UserPlus size={16} /> Thêm phụ huynh khác
            </button>
          )}
          {guardians.length > 0 && <p className="text-sm text-2 mt-12">Cấp mật khẩu mới sẽ in phiếu mới; phiếu cũ hết hiệu lực.</p>}
        </>
      )}

      <ConfirmationModal
        open={!!confirm}
        title={dialog.title}
        message={dialog.message}
        danger={!!dialog.danger}
        onConfirm={onConfirm}
        onClose={() => setConfirm(null)}
      />
      {slip && <AccountSlip slip={slip} child={child} classroomName={classroomName} onClose={() => setSlip(null)} />}
    </>
  );
}

/** Phiếu tài khoản để in giao phụ huynh; đóng là mất mật khẩu (không lưu ở đâu). */
export function AccountSlip({ slip, child, classroomName, onClose }) {
  return (
    <Modal
      open
      title="Phiếu tài khoản phụ huynh"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn--primary" onClick={() => window.print()}>
            <Printer size={16} /> In phiếu
          </button>
        </>
      }
    >
      <p className="text-sm text-2 mb-16 no-print">Mật khẩu tạm chỉ hiện lần này. Hãy in phiếu trước khi đóng.</p>
      <div className="print-sheet">
        <PrintHeader />
        <div className="ps-title">
          <h1>Phiếu tài khoản ứng dụng CareNest</h1>
        </div>
        <div className="ps-section">
          <table className="ps-table">
            <tbody>
              <tr>
                <th>Trẻ</th>
                <td>
                  {child.fullName}
                  {classroomName ? ` — ${classroomName}` : ''}
                </td>
              </tr>
              <tr>
                <th>Phụ huynh</th>
                <td>{slip.fullName}</td>
              </tr>
              <tr>
                <th>Tên đăng nhập</th>
                <td>
                  <b>{slip.username}</b>
                </td>
              </tr>
              <tr>
                <th>Mật khẩu tạm</th>
                <td>
                  <b style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 1 }}>{slip.password}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="ps-section">
          Hướng dẫn: mở ứng dụng CareNest, đăng nhập bằng số điện thoại và mật khẩu tạm ở trên; hệ thống sẽ yêu cầu đặt mật khẩu mới. Không
          chia sẻ phiếu này cho người khác.
        </div>
      </div>
    </Modal>
  );
}
