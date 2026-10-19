import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, History } from '@/components/ui/icons';
import { usePermissionChangeLogs } from '@/hooks/account/usePermissions';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PermissionTabs } from '@/components/permissions/PermissionTabs';
import {
  CHANGE_LOG_PAGE_SIZE,
  PERMISSION_ROLE_LABELS,
  PERMISSION_STATE_LABELS,
  PERMISSION_TASKS,
} from '@/models/account/permissionConstants';
import { permissionCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/school-config.css';
import '@/styles/modules/permissions.css';

const EDITABLE_ROLES = ['VICE_PRINCIPAL', 'TEACHER'];

/** Lịch sử thay đổi ma trận và ngoại lệ quyền (BE AUTH-14), mới nhất trước. */
export default function PermissionHistoryPage() {
  const [params, setParams] = useSearchParams();
  const targetRole = params.get('role') || '';
  const targetUserId = params.get('userId') || '';
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = usePermissionChangeLogs({
    targetRole: targetRole || undefined,
    targetUserId: targetUserId || undefined,
    page: page - 1,
    size: CHANGE_LOG_PAGE_SIZE,
  });

  const filterRole = (role) => {
    setPage(1);
    setParams(role ? { role } : {});
  };

  return (
    <div className="page permission-center">
      <Breadcrumb items={permissionCrumbs('Lịch sử thay đổi')} />
      <PermissionTabs />
      <div className="permission-page-head">
        <div>
          <h1 className="page__title">Lịch sử thay đổi quyền</h1>
          <p className="text-sm text-2">Theo dõi các lần điều chỉnh quyền theo vai trò và từng nhân sự.</p>
        </div>
      </div>

      <section className="card permission-history-card">
        <div className="filter-bar permission-filter-bar">
          <select className="select" value={targetRole} onChange={(e) => filterRole(e.target.value)} aria-label="Lọc theo vai trò">
            <option value="">{targetUserId ? `Tài khoản #${targetUserId}` : 'Tất cả thay đổi'}</option>
            {EDITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                Ma trận: {PERMISSION_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {targetUserId && (
            <button className="btn" onClick={() => filterRole('')}>
              Bỏ lọc tài khoản
            </button>
          )}
        </div>

        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <LoadingState />
        ) : !data?.items?.length ? (
          <EmptyState icon={History} title="Chưa có thay đổi nào" description="Mọi thay đổi ma trận và ngoại lệ quyền sẽ hiện ở đây." />
        ) : (
          <>
            <div className="table-wrap sc-table-flat permission-history-table-wrap">
              <table className="table table--compact permission-history-table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Người đổi</th>
                    <th>Áp cho</th>
                    <th>Quyền</th>
                    <th>Thay đổi</th>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((log) => (
                    <tr key={log.id}>
                      <td className="nowrap text-sm">{formatDateTime(log.changedAt)}</td>
                      <td>
                        <strong>{log.actorName || `Tài khoản #${log.actorUserId}`}</strong>
                      </td>
                      <td>
                        {log.targetRole ? (
                          <StatusBadge tone="teal" label={`Vai trò: ${PERMISSION_ROLE_LABELS[log.targetRole] || log.targetRole}`} />
                        ) : (
                          <Link
                            to={`/permissions/overrides?userId=${encodeURIComponent(log.targetUserId)}`}
                            className="permission-history-person"
                          >
                            <StatusBadge tone="blue" label={`Nhân sự: ${log.targetUserName || `Tài khoản #${log.targetUserId}`}`} />
                          </Link>
                        )}
                      </td>
                      <td>
                        <strong>{PERMISSION_TASKS[log.permissionCode]?.label || log.permissionCode}</strong>
                      </td>
                      <td className="nowrap">
                        <StatusBadge tone="gray" label={PERMISSION_STATE_LABELS[log.beforeState] || log.beforeState} />
                        {' → '}
                        <StatusBadge
                          tone={
                            log.afterState === 'GRANT' || log.afterState === 'ON'
                              ? 'green'
                              : log.afterState === 'REVOKE' || log.afterState === 'OFF'
                                ? 'orange'
                                : 'gray'
                          }
                          label={PERMISSION_STATE_LABELS[log.afterState] || log.afterState}
                        />
                      </td>
                      <td className="text-sm">{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={data.totalElements} pageSize={CHANGE_LOG_PAGE_SIZE} onChange={setPage} unit="thay đổi" />
          </>
        )}
      </section>

      <div className="page-actions">
        <Link className="btn" to="/permissions">
          <ArrowLeft size={16} /> Về quyền theo vai trò
        </Link>
      </div>
    </div>
  );
}
