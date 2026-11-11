import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Lock, Pencil, Trash2, Unlock, UserPlus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAccountCandidates, useChildGuardians } from '@/hooks/account/useGuardians';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RowMenu } from '@/components/ui/RowMenu';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { activateChosenGuardian, removeGuardian, resetParentPassword, updateParentStatus } from '@/services/account/guardianService';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/account/guardianConstants';
import { avatarTone, formatDate, initials } from '@/utils/format';

/** Kết quả gửi SMS mật khẩu tạm (BE trả smsStatus): không hiện, không in mật khẩu (user bỏ màn in phiếu 2026-10-23). */
const smsFailed = (rows) => rows.filter((r) => r.smsStatus === 'FAILED');

/** Ô "Phụ huynh" của bảng: chữ cái đầu, họ tên, quan hệ với bé dòng dưới. */
function PersonCell({ name, relation }) {
  return (
    <span className="row gap-2-5 pa-person">
      <span className={`avatar avatar--sm avatar--tone-${avatarTone(name)}`} aria-hidden="true">
        {initials(name)}
      </span>
      <span className="stack gap-0">
        <span className="fw-600">{name}</span>
        {relation && <span className="muted text-xs">{relation}</span>}
      </span>
    </span>
  );
}

// Tài khoản phụ huynh của một trẻ (AUTH-18, AUTH-19, AUTH-20), qua guardianService (mock hoặc BE).
/**
 * Phụ huynh của bé: tài khoản đã liên kết (cấp mật khẩu, gỡ, khóa) và kích hoạt tài khoản cho phụ huynh trên hồ sơ trẻ.
 * Thông tin phụ huynh lấy từ hồ sơ trẻ, không sửa ở đây; có từ 2 phụ huynh thì dropdown chọn sẵn người nhận tài khoản,
 * đổi người thì hiện ngay thông tin người đó và kích hoạt cho người đang hiện (user chốt 2026-11-11). Mật khẩu tạm gửi
 * qua SMS tới số đăng nhập, không in phiếu.
 */
export function GuardianPanel({ child, classroomName, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: guardians, loading, error, reload } = useChildGuardians(child.id);
  const candidatesQ = useAccountCandidates(child.id);
  const [chosenId, setChosenId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const submitting = useRef(false);

  const refresh = () => {
    candidatesQ.reload({ silent: true });
    reload({ silent: true });
    onChanged();
  };

  const candidates = candidatesQ.data || [];
  const savedRecipient = candidates.find((g) => g.accountRecipient);
  // Hồ sơ một phụ huynh: người đó nhận tài khoản kể cả dữ liệu cũ chưa đánh dấu (tiếp nhận luôn chọn một người)
  const recipient = savedRecipient || (candidates.length === 1 ? candidates[0] : null);
  const chosen = candidates.find((g) => String(g.id) === String(chosenId)) || recipient;

  const activate = async () => {
    if (submitting.current || !chosen) return;
    submitting.current = true;
    setSaving(true);
    try {
      const results = await activateChosenGuardian(child.id, chosen.id, savedRecipient?.id, user);
      refresh();
      setChosenId('');
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
      // Có thể đã lưu người nhận mới trước khi kích hoạt lỗi: đọc lại để lần bấm sau dùng đúng người nhận
      candidatesQ.reload({ silent: true });
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
            message: `Gửi mật khẩu tạm mới qua SMS tới ${target.username} (${target.fullName})? Mật khẩu cũ hết hiệu lực và các phiên đăng nhập hiện có bị đăng xuất.`,
            confirmLabel: 'Gửi mật khẩu mới',
          }
        : {
            title: target.status === 'ACTIVE' ? 'Khóa tài khoản phụ huynh' : 'Mở khóa tài khoản phụ huynh',
            message: `${target.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'} tài khoản ${target.fullName}?`,
            danger: target.status === 'ACTIVE',
          };
  const historicalLinks = candidates.filter((g) => g !== recipient && g.accountStatus && g.accountStatus !== 'NOT_ACTIVATED').length;

  return (
    <>
      <p className="text-sm text-2 pa-panel__meta">
        {classroomName || 'Chưa xếp lớp'} · sinh {formatDate(child.dateOfBirth)}
      </p>

      {error || candidatesQ.error ? (
        <ErrorState error={error || candidatesQ.error} onRetry={refresh} />
      ) : loading || candidatesQ.loading ? (
        <LoadingState />
      ) : (
        <>
          {historicalLinks > 0 && (
            <div className="alert alert--info mb-16">
              Hồ sơ còn {historicalLinks} liên kết tài khoản cũ. Lựa chọn người nhận tài khoản không tự gỡ các liên kết này.
            </div>
          )}
          {!guardians.length && chosen && (
            <div className="alert alert--warning mb-16">
              Bé chưa có tài khoản phụ huynh. Kiểm tra thông tin theo hồ sơ trẻ rồi kích hoạt.
            </div>
          )}
          {/* Bảng thay thẻ từng phụ huynh (user yêu cầu 2026-11-11): cùng cột thì so sánh nhanh; thao tác hiếm dùng vào menu "…" */}
          {guardians.length > 0 && (
            <section aria-label="Tài khoản phụ huynh đã liên kết">
              <h3 className="subsection-title">Tài khoản đã liên kết</h3>
              <div className="table-wrap">
                <table className="table table--grid pa-account-table">
                  <thead>
                    <tr>
                      <th>Phụ huynh</th>
                      <th>Tên đăng nhập</th>
                      <th>Số CCCD</th>
                      <th className="center">Trạng thái</th>
                      <th className="cell--actions">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guardians.map((g) => {
                      const idNumber = g.idNumber || candidates.find((p) => p.accountRecipient)?.idNumber;
                      const active = g.status === 'ACTIVE';
                      return (
                        <tr key={g.userId}>
                          <td>
                            <PersonCell name={g.fullName} relation={g.relation || GUARDIAN_RELATIONSHIP_LABELS[g.relationship]} />
                          </td>
                          <td className="nowrap fw-600">{g.username}</td>
                          <td className="nowrap">{idNumber || <span className="muted">Chưa có</span>}</td>
                          <td className="center">
                            <AccountStatusBadge status={g.status} />
                          </td>
                          <td className="cell--actions">
                            <div className="pa-row-actions">
                              <button type="button" className="btn btn--sm" onClick={() => setConfirm({ type: 'password', guardian: g })}>
                                <KeyRound size={15} /> Cấp mật khẩu mới
                              </button>
                              <RowMenu
                                label={`Thao tác khác với tài khoản ${g.fullName}`}
                                items={[
                                  {
                                    label: active ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
                                    icon: active ? Lock : Unlock,
                                    onClick: () => setConfirm({ type: 'status', guardian: g }),
                                  },
                                  {
                                    label: 'Gỡ khỏi bé',
                                    icon: Trash2,
                                    danger: true,
                                    onClick: () => setConfirm({ type: 'remove', guardian: g }),
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!guardians.length && chosen && (
            <section className="pa-pending" aria-label="Kích hoạt tài khoản phụ huynh">
              <h3 className="subsection-title">Kích hoạt tài khoản phụ huynh</h3>
              <p className="text-sm text-2 mb-12">
                {candidates.length > 1 ? 'Chọn một phụ huynh nhận tài khoản. ' : ''}Thông tin lấy từ hồ sơ trẻ, không sửa ở đây; sai thì sửa
                ở hồ sơ trẻ rồi kích hoạt.
              </p>
              {/* Mọi phụ huynh trên hồ sơ trong một bảng; từ 2 người thì chọn người nhận bằng ô tròn đầu dòng hoặc bấm dòng */}
              <div className="table-wrap">
                <table className="table table--grid pa-account-table">
                  <thead>
                    <tr>
                      {candidates.length > 1 && <th className="center pa-col-pick">Người nhận</th>}
                      <th>Phụ huynh</th>
                      <th>Số điện thoại (tên đăng nhập)</th>
                      <th>Số CCCD</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((g) => {
                      const picked = String(g.id) === String(chosen.id);
                      const pick = () => setChosenId(String(g.id));
                      return (
                        <tr
                          key={g.id}
                          className={`${candidates.length > 1 ? 'row-click' : ''} ${picked ? 'row--selected' : ''}`}
                          onClick={candidates.length > 1 ? pick : undefined}
                        >
                          {candidates.length > 1 && (
                            <td className="center">
                              <input
                                type="radio"
                                name={`pa-recipient-${child.id}`}
                                checked={picked}
                                onChange={pick}
                                aria-label={`${g.fullName} nhận tài khoản`}
                              />
                            </td>
                          )}
                          <td>
                            <PersonCell name={g.fullName} relation={g.relation} />
                          </td>
                          <td className="nowrap fw-600">{g.phone}</td>
                          <td className="nowrap">{g.idNumber || <span className="muted">Chưa có</span>}</td>
                          <td>{g.email || <span className="muted">Không có</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="row row--wrap gap-2 mt-16">
                <button className="btn btn--primary" type="button" onClick={activate} disabled={saving}>
                  <UserPlus size={16} /> {candidates.length > 1 ? `Kích hoạt cho ${chosen.fullName}` : 'Kích hoạt tài khoản'}
                </button>
                <Link className="btn" to={`/children/${child.id}/edit`}>
                  <Pencil size={16} /> Sửa thông tin ở hồ sơ trẻ
                </Link>
              </div>
            </section>
          )}
          {!candidates.length && !guardians.length && (
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
