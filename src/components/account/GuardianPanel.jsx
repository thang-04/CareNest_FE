import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, KeyRound, Lock, Pencil, Trash2, Unlock, UserPlus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useChildGuardians, usePendingGuardians } from '@/hooks/account/useGuardians';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { activateGuardians, removeGuardian, resetParentPassword, updateParentStatus } from '@/services/account/guardianService';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/account/guardianConstants';
import { avatarTone, formatDate, initials } from '@/utils/format';

/** Kết quả gửi SMS mật khẩu tạm (BE trả smsStatus): không hiện, không in mật khẩu (user bỏ màn in phiếu 2026-10-23). */
const smsFailed = (rows) => rows.filter((r) => r.smsStatus === 'FAILED');

// Quản lý tài khoản demo qua adapter legacy; chưa nối hợp đồng BE/App.
/**
 * Phụ huynh của bé: tài khoản đã liên kết (cấp mật khẩu, gỡ, khóa) và phụ huynh trên hồ sơ trẻ chưa có tài khoản.
 * Thông tin phụ huynh lấy từ hồ sơ trẻ, không sửa ở đây; có từ 2 phụ huynh thì chọn xem từng người, kích hoạt tạo cho tất cả
 * (user chốt 2026-10-23). Mật khẩu tạm gửi qua SMS tới số đăng nhập, không in phiếu.
 */
export function GuardianPanel({ child, classroomName, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: guardians, loading, error, reload } = useChildGuardians(child.id);
  const pendingQ = usePendingGuardians(child.id);
  const [pick, setPick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const submitting = useRef(false);

  const refresh = () => {
    reload({ silent: true });
    pendingQ.reload({ silent: true });
    onChanged();
  };

  const activate = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      const results = await activateGuardians(child.id, user);
      refresh();
      setPick(0);
      const fresh = results.filter((r) => r.newAccount);
      const linked = results.length - fresh.length;
      const failed = smsFailed(fresh);
      const sent = fresh.filter((r) => !failed.includes(r));
      if (sent.length)
        toast.success(
          `Đã tạo ${sent.length} tài khoản; mật khẩu tạm gửi qua SMS tới ${sent.map((r) => r.username).join(', ')}.`,
          'Kích hoạt thành công',
        );
      if (linked) toast.success(`${linked} phụ huynh đã có tài khoản: đã liên kết thêm bé này, mật khẩu giữ nguyên.`);
      if (failed.length)
        toast.warning(
          `Tài khoản đã tạo nhưng chưa gửi được SMS mật khẩu tới ${failed.map((r) => r.username).join(', ')}. Bấm "Cấp mật khẩu mới" để gửi lại.`,
          'Gửi SMS lỗi',
        );
    } catch (err) {
      toast.error(err, 'Không kích hoạt được tài khoản');
    } finally {
      submitting.current = false;
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
      toast.error(err, 'Không thực hiện được');
      return null;
    }
  };

  const onConfirm = async () => {
    const g = confirm.guardian;
    if (confirm.type === 'password') {
      const result = await run(() => resetParentPassword(g.userId, user));
      if (result?.smsStatus === 'FAILED') toast.warning(`Chưa gửi được SMS mật khẩu tới ${result.username}. Thử lại sau.`, 'Gửi SMS lỗi');
      else if (result) toast.success(`Đã gửi mật khẩu tạm mới qua SMS tới ${result.username}.`);
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
            title: 'Cấp mật khẩu mới',
            message: `Gửi mật khẩu tạm mới qua SMS tới ${target.username} (${target.fullName})? Mật khẩu cũ hết hiệu lực.`,
            confirmLabel: 'Gửi mật khẩu mới',
          }
        : {
            title: target.status === 'ACTIVE' ? 'Khóa tài khoản phụ huynh' : 'Mở khóa tài khoản phụ huynh',
            message: `${target.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'} tài khoản ${target.fullName}?`,
            danger: target.status === 'ACTIVE',
          };
  const pending = pendingQ.data || [];
  const current = pending[Math.min(pick, pending.length - 1)];
  const blocked = pending.some((p) => p.problems.length > 0);

  return (
    <>
      <p className="text-sm text-2 pa-panel__meta">
        {classroomName || 'Chưa xếp lớp'} · sinh {formatDate(child.dateOfBirth)}
      </p>

      {error || pendingQ.error ? (
        <ErrorState error={error || pendingQ.error} onRetry={refresh} />
      ) : loading || pendingQ.loading ? (
        <LoadingState />
      ) : (
        <>
          {!guardians.length && pending.length > 0 && (
            <div className="alert alert--warning mb-16">
              Bé chưa có tài khoản phụ huynh. Kiểm tra thông tin theo hồ sơ trẻ rồi kích hoạt.
            </div>
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
                    <span className="pa-guardian__relation">{g.relation || GUARDIAN_RELATIONSHIP_LABELS[g.relationship]}</span>
                  </div>
                  <div className="pa-guardian__username">
                    Tài khoản: {g.username} · {g.idNumber ? `CCCD ${g.idNumber}` : 'Chưa có CCCD'}
                  </div>
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

          {pending.length > 0 && (
            <section className="pa-pending" aria-label="Phụ huynh chưa có tài khoản">
              <h3 className="section-title">{guardians.length ? 'Phụ huynh chưa có tài khoản' : 'Kích hoạt tài khoản phụ huynh'}</h3>
              <p className="text-sm text-2 mb-12">
                Thông tin lấy từ hồ sơ trẻ, không sửa ở đây. Sai hoặc thiếu thì sửa ở hồ sơ trẻ rồi kích hoạt.
              </p>
              {pending.length > 1 && (
                <div className="tabs mb-12" role="tablist" aria-label="Phụ huynh trên hồ sơ trẻ">
                  {pending.map((p, i) => (
                    <button
                      key={p.phone || i}
                      type="button"
                      role="tab"
                      aria-selected={p === current}
                      className={`tab ${p === current ? 'tab--active' : ''}`}
                      onClick={() => setPick(i)}
                    >
                      {p.fullName || `Phụ huynh ${i + 1}`} <span className="muted">({p.relation || '—'})</span>
                    </button>
                  ))}
                </div>
              )}
              {current && (
                <div className="pa-guardian" role={pending.length > 1 ? 'tabpanel' : undefined}>
                  <dl className="info-list">
                    <dt>Số điện thoại</dt>
                    <dd>
                      <b>{current.phone || '—'}</b> <span className="text-sm muted">(tên đăng nhập)</span>
                    </dd>
                    <dt>Họ tên</dt>
                    <dd>{current.fullName || '—'}</dd>
                    <dt>Số CCCD</dt>
                    <dd>{current.idNumber || '—'}</dd>
                    <dt>Quan hệ với bé</dt>
                    <dd>{current.relation || '—'}</dd>
                    <dt>Email</dt>
                    <dd>{current.email || <span className="muted">Không có</span>}</dd>
                  </dl>
                  {current.hasAccount && (
                    <div className="alert alert--info mt-12">
                      <Info size={18} />
                      <div>Số điện thoại này đã có tài khoản phụ huynh: kích hoạt chỉ liên kết thêm bé, mật khẩu giữ nguyên.</div>
                    </div>
                  )}
                  {current.problems.length > 0 && (
                    <div className="alert alert--warning mt-12">
                      <Info size={18} />
                      <div>Thông tin trên hồ sơ trẻ chưa đủ: {current.problems.join('; ')}. Sửa ở hồ sơ trẻ trước khi kích hoạt.</div>
                    </div>
                  )}
                </div>
              )}
              <div className="row row--wrap gap-2 mt-16">
                <button className="btn btn--primary" type="button" onClick={activate} disabled={saving || blocked}>
                  <UserPlus size={16} />{' '}
                  {pending.length > 1 ? `Kích hoạt tài khoản cho cả ${pending.length} phụ huynh` : 'Kích hoạt tài khoản'}
                </button>
                <Link className="btn" to={`/children/${child.id}/edit`}>
                  <Pencil size={16} /> Sửa thông tin ở hồ sơ trẻ
                </Link>
              </div>
            </section>
          )}
          {!pending.length && !guardians.length && (
            <div className="alert alert--warning">
              Hồ sơ trẻ chưa có phụ huynh.{' '}
              <Link className="text-primary" to={`/children/${child.id}/edit`}>
                Thêm phụ huynh ở hồ sơ trẻ
              </Link>
              .
            </div>
          )}
          {guardians.length > 0 && (
            <p className="text-sm text-2 mt-12">Cấp mật khẩu mới: mật khẩu tạm gửi qua SMS tới số đăng nhập, mật khẩu cũ hết hiệu lực.</p>
          )}
        </>
      )}

      <ConfirmationModal
        open={!!confirm}
        title={dialog.title}
        message={dialog.message}
        danger={!!dialog.danger}
        confirmLabel={dialog.confirmLabel}
        onConfirm={onConfirm}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
