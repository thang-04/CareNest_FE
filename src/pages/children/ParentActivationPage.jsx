import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, KeyRound, Send, Info, X, Lock, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useParentAccounts } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ParentAccountBadge } from '@/components/children/ChildBadges';
import { activateParentAccount, resendParentSms } from '@/services/children/childrenService';
import { PARENT_ACCOUNT_STATUS, PARENT_ACCOUNT_STATUS_LABELS, SMS_STATUS, SMS_STATUS_LABELS } from '@/models/children/childrenConstants';
import { formatDateTime, normalizeText } from '@/utils/format';
import { canActivateParent, canViewParentAccounts } from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const TABS = [PARENT_ACCOUNT_STATUS.NOT_ACTIVATED, PARENT_ACCOUNT_STATUS.PENDING_ACTIVATION, PARENT_ACCOUNT_STATUS.ACTIVE, ''];

export default function ParentActivationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const childId = params.get('childId') || '';
  const [tab, setTab] = useState(childId ? '' : PARENT_ACCOUNT_STATUS.NOT_ACTIVATED);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null);
  const [rowBusy, setRowBusy] = useState('');
  const { rows: all, loading, error, reload } = useParentAccounts({});

  const scoped = useMemo(() => all.filter((r) => !childId || r.childId === childId), [all, childId]);
  const rows = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return scoped
      .filter((r) => !tab || r.guardian.accountStatus === tab)
      .filter((r) => !kw || normalizeText(`${r.childName} ${r.childCode} ${r.guardian.fullName} ${r.guardian.phone}`).includes(kw));
  }, [scoped, tab, keyword]);
  const pageRows = paginate(rows, page);

  if (!canViewParentAccounts(user))
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Tài khoản phụ huynh')} />
        <h1 className="page__title">Kích hoạt tài khoản phụ huynh</h1>
        <div className="card">
          <EmptyState icon={Lock} title="Bạn không có quyền xem tài khoản phụ huynh" />
        </div>
      </div>
    );

  const childOf = (r) => ({ id: r.childId, campusId: r.campusId, status: 'ACTIVE' });
  const failedSms = scoped.filter(
    (r) => r.guardian.smsStatus === SMS_STATUS.FAILED && r.guardian.accountStatus === PARENT_ACCOUNT_STATUS.PENDING_ACTIVATION,
  );

  const activate = async () => {
    const r = pending;
    try {
      const result = await activateParentAccount(r.childId, r.guardianIndex, user);
      if (result.mode === 'LINKED')
        toast.success(
          `Đã liên kết ${r.childName} với tài khoản có sẵn ${result.username}. Không gửi mật khẩu mới.`,
          'Đã liên kết tài khoản',
        );
      else if (result.smsStatus === SMS_STATUS.SENT)
        toast.success(
          `Đã tạo tài khoản ${result.username} và gửi SMS mật khẩu tới ${r.guardian.phone}. Phụ huynh phải đổi mật khẩu khi đăng nhập lần đầu.`,
          'Đã kích hoạt',
        );
      else
        toast.warning(
          'Đã tạo tài khoản nhưng gửi SMS không thành công. Phụ huynh chưa nhận được mật khẩu – hãy bấm Gửi lại SMS.',
          'Gửi SMS lỗi',
        );
    } catch (err) {
      toast.error(err.message, 'Không kích hoạt được tài khoản');
    } finally {
      setPending(null);
    }
  };

  const resend = async (r) => {
    setRowBusy(r.key);
    try {
      const { smsStatus } = await resendParentSms(r.childId, r.guardianIndex, user);
      if (smsStatus === SMS_STATUS.SENT) toast.success(`Đã gửi lại SMS tới ${r.guardian.phone}.`);
      else toast.warning('Gửi SMS vẫn chưa thành công. Kiểm tra lại số điện thoại hoặc thử lại sau.', 'Gửi SMS lỗi');
    } catch (err) {
      toast.error(err.message, 'Không gửi lại được SMS');
    } finally {
      setRowBusy('');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Tài khoản phụ huynh')} />
      <h1 className="page__title">Kích hoạt tài khoản phụ huynh</h1>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Kích hoạt để liên kết phụ huynh với trẻ. Nếu số điện thoại hoặc email đã có tài khoản, hệ thống chỉ liên kết thêm trẻ, không tạo
          tài khoản mới. Phụ huynh mới nhận tên đăng nhập (số điện thoại) và mật khẩu cấp qua SMS, và phải đổi mật khẩu khi đăng nhập ứng
          dụng lần đầu.
        </div>
      </div>
      {failedSms.length > 0 && (
        <div className="alert alert--danger mb-16" role="alert">
          <AlertTriangle size={18} />
          <div>
            <b>{failedSms.length}</b> phụ huynh chưa nhận được SMS do gửi lỗi. Bấm <b>Gửi lại SMS</b> ở dòng tương ứng.
          </div>
        </div>
      )}

      <div className="card">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t || 'all'}
              role="tab"
              aria-selected={tab === t}
              className={`tab ${tab === t ? 'tab--active' : ''}`}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
            >
              {t ? PARENT_ACCOUNT_STATUS_LABELS[t] : 'Tất cả'}{' '}
              <span className="tab__count">{t ? scoped.filter((r) => r.guardian.accountStatus === t).length : scoped.length}</span>
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm theo tên trẻ, mã trẻ, phụ huynh hoặc số điện thoại..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              aria-label="Tìm kiếm"
            />
          </label>
          {childId && (
            <span className="chip chip--blue">
              Đang lọc theo 1 trẻ
              <button type="button" className="tr-chip-remove" aria-label="Bỏ lọc theo trẻ" onClick={() => setParams({})}>
                <X size={12} />
              </button>
            </span>
          )}
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap tr-table-flat">
            <table className="table">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  <th>Phụ huynh</th>
                  <th>Liên hệ</th>
                  <th>Tên đăng nhập</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={6} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={KeyRound}
                        title={
                          tab === PARENT_ACCOUNT_STATUS.NOT_ACTIVATED ? 'Không còn phụ huynh chờ kích hoạt' : 'Không có phụ huynh phù hợp'
                        }
                        description="Phụ huynh của trẻ mới tiếp nhận sẽ hiện ở tab Chưa kích hoạt."
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const g = r.guardian;
                    const allowed = canActivateParent(childOf(r), user);
                    return (
                      <tr key={r.key}>
                        <td>
                          <Link to={`/children/${r.childId}`} className="fw-600">
                            {r.childName}
                          </Link>
                          <div className="muted text-xs">
                            {r.childCode} · {r.className || 'Chưa xếp lớp'}
                          </div>
                        </td>
                        <td>
                          {g.fullName} <span className="muted">({g.relation})</span>
                        </td>
                        <td className="text-sm">
                          <div className="nowrap">{g.phone}</div>
                          <div className="muted">{g.email || 'Chưa có email'}</div>
                        </td>
                        <td className="text-sm">{r.username || <span className="muted">—</span>}</td>
                        <td>
                          <ParentAccountBadge status={g.accountStatus} />
                          {g.smsStatus && g.accountStatus === PARENT_ACCOUNT_STATUS.PENDING_ACTIVATION && (
                            <div className={`text-xs mt-8 ${g.smsStatus === SMS_STATUS.FAILED ? 'text-danger' : 'muted'}`}>
                              {SMS_STATUS_LABELS[g.smsStatus]} · {formatDateTime(g.smsAt)}
                            </div>
                          )}
                        </td>
                        <td className="center nowrap">
                          {allowed && g.accountStatus === PARENT_ACCOUNT_STATUS.NOT_ACTIVATED && (
                            <button className="btn btn--sm btn--primary" onClick={() => setPending(r)}>
                              <KeyRound size={15} /> Kích hoạt
                            </button>
                          )}
                          {allowed && g.accountStatus === PARENT_ACCOUNT_STATUS.PENDING_ACTIVATION && (
                            <button className="btn btn--sm" onClick={() => resend(r)} disabled={rowBusy === r.key}>
                              <Send size={15} /> Gửi lại SMS
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="phụ huynh" />}
      </div>

      <ConfirmationModal
        open={!!pending}
        title="Kích hoạt tài khoản phụ huynh?"
        message={
          pending
            ? `Liên kết ${pending.guardian.fullName} (${pending.guardian.phone}) với trẻ ${pending.childName}. Nếu chưa có tài khoản, hệ thống tạo tài khoản và gửi mật khẩu qua SMS.`
            : ''
        }
        confirmLabel="Kích hoạt tài khoản"
        onConfirm={activate}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
