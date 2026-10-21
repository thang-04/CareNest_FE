import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RotateCcw, ShieldCheck } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { RowActions } from '@/components/ui/RowActions';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PermissionTabs } from '@/components/permissions/PermissionTabs';
import { OverrideWizardModal } from '@/components/permissions/OverrideWizardModal';
import { PermissionStateBadge } from '@/components/permissions/PermissionBadges';
import { ReasonModal } from '@/components/permissions/ReasonModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAccountsWithOverrides, usePermissionStaff } from '@/hooks/account/usePermissions';
import { updatePermissionOverrides } from '@/services/account/permissionService';
import { PERMISSION_ROLE_LABELS, PERMISSION_TASKS } from '@/models/account/permissionConstants';
import { permissionCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDate } from '@/utils/format';
import '@/styles/modules/permissions.css';

const CONFIGURABLE_ROLES = ['VICE_PRINCIPAL', 'TEACHER'];

export default function UserOverridesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const { data: accounts, loading, error, reload } = useAccountsWithOverrides();
  const [params, setParams] = useSearchParams();
  const targetId = params.get('userId');
  const staffQuery = usePermissionStaff({ enabled: !!targetId });
  const targetStaff = staffQuery.data?.items.find((row) => String(row.userId) === targetId);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [wizardStaff, setWizardStaff] = useState(null); // null = đóng, {} = chọn người mới, staff = sửa người này
  const [resetStaff, setResetStaff] = useState(null);
  const [savingReset, setSavingReset] = useState(false);

  const filteredAccounts = useMemo(() => {
    const list = accounts || [];
    return list.filter((acc) => {
      const matchesRole = !roleFilter || acc.role === roleFilter;
      const matchesSearch =
        !searchQuery || acc.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || acc.phone?.includes(searchQuery);
      return matchesRole && matchesSearch && (!targetId || String(acc.userId) === targetId);
    });
  }, [accounts, roleFilter, searchQuery, targetId]);

  const handleResetConfirm = async (reason) => {
    if (!resetStaff || savingReset) return;
    setSavingReset(true);
    try {
      await updatePermissionOverrides(
        resetStaff.userId,
        {
          overrides: [],
          reason: reason.trim(),
        },
        user,
      );
      toast.success(`Đã khôi phục toàn bộ quyền của ${resetStaff.fullName} về mặc định vai trò.`);
      setResetStaff(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không thể khôi phục quyền', 'Lỗi khôi phục quyền');
    } finally {
      setSavingReset(false);
    }
  };

  return (
    <div className="page permission-center">
      <Breadcrumb items={permissionCrumbs('Quyền ngoại lệ từng người')} />
      <div className="page__head permission-page-head">
        <div>
          <h1 className="page__title">Quyền ngoại lệ từng người</h1>
          <p className="text-sm text-2">Danh sách nhân sự được cấp thêm (+) hoặc thu hồi (-) quyền đặc thù so với vai trò chuẩn.</p>
        </div>
      </div>
      <PermissionTabs
        actions={
          <button className="btn btn--primary" type="button" onClick={() => setWizardStaff({})}>
            <Plus size={16} /> Thêm ngoại lệ cho nhân sự
          </button>
        }
      />

      {targetId && (
        <div className="alert alert--info">
          <span>
            {staffQuery.loading
              ? 'Đang tìm nhân sự…'
              : targetStaff
                ? `Đang xem: ${targetStaff.fullName}`
                : 'Nhân sự này không còn nằm trong danh sách cấu hình demo.'}
          </span>
          {targetStaff && (
            <button className="btn btn--sm" onClick={() => setWizardStaff(targetStaff)}>
              Thiết lập ngoại lệ cho người này
            </button>
          )}
          <button className="btn btn--sm" onClick={() => setParams({})}>
            Xem tất cả nhân sự
          </button>
          {staffQuery.error && <ErrorState error={staffQuery.error} onRetry={staffQuery.reload} />}
        </div>
      )}
      <section className="card">
        <div className="filter-bar">
          <SearchSubmit
            className="permission-search"
            value={searchQuery}
            placeholder="Tìm theo họ tên hoặc SĐT nhân sự"
            label="Tìm kiếm nhân sự"
            onSearch={setSearchQuery}
          />
          <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Lọc theo vai trò">
            <option value="">Tất cả vai trò</option>
            {CONFIGURABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {PERMISSION_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <LoadingState />
        ) : filteredAccounts.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={accounts?.length === 0 ? 'Chưa có nhân sự nào có quyền ngoại lệ' : 'Không tìm thấy kết quả phù hợp'}
            description={
              accounts?.length === 0
                ? 'Tất cả nhân sự trong trường đang sử dụng quyền mặc định theo vai trò. Bấm “Thêm ngoại lệ cho nhân sự” để thiết lập quyền riêng.'
                : 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.'
            }
            action={
              accounts?.length > 0 && (
                <button
                  className="btn"
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('');
                  }}
                >
                  <RotateCcw size={15} /> Đặt lại bộ lọc
                </button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid table--compact permission-overrides-table">
              <thead>
                <tr>
                  <th>Nhân sự</th>
                  <th>Vai trò & Nơi làm</th>
                  <th>Quyền cấp thêm (+)</th>
                  <th>Quyền thu hồi (-)</th>
                  <th>Ghi chú / Lý do</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((item) => {
                  const grantOverrides = item.overrides.filter((o) => o.effect === 'GRANT');
                  const revokeOverrides = item.overrides.filter((o) => o.effect === 'REVOKE');
                  const campusText = item.campusName || item.assignments?.[0]?.campusName || 'Chưa phân công';

                  return (
                    <tr key={item.userId}>
                      <td>
                        <div className="permission-person">
                          <Avatar user={item} size="sm" />
                          <div>
                            <strong>{item.fullName}</strong>
                            {item.phone && <div className="text-xs text-muted">{item.phone}</div>}
                          </div>
                        </div>
                      </td>

                      <td className="center">
                        <StatusBadge tone="teal" label={PERMISSION_ROLE_LABELS[item.role] || item.role} />
                        <div className="text-xs text-muted mt-1">{campusText}</div>
                      </td>

                      {[
                        ['GRANT', grantOverrides],
                        ['REVOKE', revokeOverrides],
                      ].map(([effect, list]) => (
                        <td key={effect}>
                          {list.length > 0 ? (
                            <div className="permission-override-tags">
                              {list.map((o) => {
                                const label = PERMISSION_TASKS[o.permission]?.label || o.permission;
                                return (
                                  <span key={o.permission} title={label}>
                                    <PermissionStateBadge state={effect} label={label} signed />
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                      ))}

                      <td>
                        <div className="text-sm">{item.overrides[0]?.reason || 'Không có ghi chú'}</div>
                        {item.overrides[0]?.updatedAt && (
                          <div className="text-xs text-muted">Cập nhật: {formatDate(item.overrides[0].updatedAt)}</div>
                        )}
                      </td>

                      <td className="cell--actions">
                        <RowActions
                          edit={{ onClick: () => setWizardStaff(item), label: 'Sửa quyền ngoại lệ' }}
                          menu={[
                            {
                              label: 'Đặt lại quyền theo vai trò',
                              icon: RotateCcw,
                              danger: true,
                              onClick: () => setResetStaff(item),
                            },
                          ]}
                          name={item.fullName}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Wizard: Tạo mới hoặc chỉnh sửa ngoại lệ */}
      {wizardStaff && (
        <OverrideWizardModal
          open
          initialStaff={wizardStaff.userId ? wizardStaff : null}
          onClose={() => setWizardStaff(null)}
          onSaved={() => {
            setWizardStaff(null);
            reload({ silent: true });
          }}
        />
      )}

      {/* Modal xác nhận đặt lại về mặc định */}
      {resetStaff && (
        <ReasonModal
          title={`Đặt lại quyền theo vai trò cho ${resetStaff.fullName}?`}
          changes={resetStaff.overrides.map(
            (o) => `Khôi phục “${PERMISSION_TASKS[o.permission]?.label || o.permission}” về mặc định theo vai trò`,
          )}
          saving={savingReset}
          onClose={() => setResetStaff(null)}
          onSubmit={handleResetConfirm}
        />
      )}
    </div>
  );
}
