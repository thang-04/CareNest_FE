import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Info, ShieldCheck, Pencil, RotateCcw, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePermissions } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PermissionLevelBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { CONFIG_ROLE_DESCRIPTIONS, CONFIG_ROLE_LABELS, PERMISSION_MODULES } from '@/models/school-config/schoolConfigConstants';
import { PERMISSION_CATALOG } from '@/models/school-config/permissionCatalog';
import { canManageRolePermissions } from '@/utils/school-config/schoolConfigPermissions';
import { roleCrumbs } from '@/utils/school-config/breadcrumbs';
import { normalizeText } from '@/utils/format';
import '@/styles/modules/school-config.css';

/** #24 Role & Permission List (UC 2.4, SRS 4.4 Permission Matrix). Principal only. */
export default function RolePermissionListPage() {
  const { user } = useAuth();
  const { roles, loading, error, reload } = useRolePermissions();
  const [module, setModule] = useState('');
  const [keyword, setKeyword] = useState('');

  const rows = useMemo(
    () =>
      PERMISSION_CATALOG.filter(
        (p) =>
          (!module || p.module === module) &&
          (!keyword || normalizeText(`${p.entity} ${p.action} ${p.code}`).includes(normalizeText(keyword))),
      ),
    [module, keyword],
  );

  if (!canManageRolePermissions(user))
    return (
      <div className="page">
        <Breadcrumb items={roleCrumbs()} />
        <h1 className="page__title">Vai trò & quyền</h1>
        <ScNoAccess description="Chỉ Hiệu trưởng được xem và thay đổi quyền theo vai trò." />
      </div>
    );

  const modules = Object.keys(PERMISSION_MODULES).filter((m) => rows.some((p) => p.module === m));

  return (
    <div className="page">
      <Breadcrumb items={roleCrumbs()} />
      <h1 className="page__title">Vai trò & quyền</h1>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Ma trận quyền theo SRS 4.4: <b>Toàn quyền</b> – không giới hạn; <b>Theo phạm vi</b> – chỉ dữ liệu được phân công (điểm trường,
          lớp, nhóm tuổi); <b>Không</b> – không được dùng. Phụ huynh dùng ứng dụng di động nên không cấu hình ở đây.
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="sc-role-grid mb-16">
            {roles.map((r) => {
              const values = Object.values(r.grants);
              return (
                <article key={r.role} className="card sc-role-card">
                  <div className="row row--between">
                    <h2 className="card__title">{CONFIG_ROLE_LABELS[r.role]}</h2>
                    <span className="chip chip--gray" title="Số tài khoản">
                      <Users size={12} /> {r.userCount}
                    </span>
                  </div>
                  <p className="text-sm text-2 sc-role-card__desc">{CONFIG_ROLE_DESCRIPTIONS[r.role]}</p>
                  <div className="row row--wrap text-xs" style={{ gap: 6 }}>
                    <span className="chip chip--green">{values.filter((v) => v === 'FULL').length} toàn quyền</span>
                    <span className="chip chip--blue">{values.filter((v) => v === 'RESTRICTED').length} theo phạm vi</span>
                  </div>
                  <Link className="btn btn--sm mt-12" to={`/school/roles/${r.role}`}>
                    <Pencil size={15} /> Xem và sửa quyền
                  </Link>
                </article>
              );
            })}
          </div>

          <section className="card">
            <div className="filter-bar">
              <label className="search-box" style={{ flex: 1 }}>
                <Search size={17} className="muted" />
                <input placeholder="Tìm quyền..." value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Tìm quyền" />
              </label>
              <select className="select" value={module} onChange={(e) => setModule(e.target.value)} aria-label="Nhóm chức năng">
                <option value="">Tất cả nhóm chức năng</option>
                {Object.entries(PERMISSION_MODULES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                className="btn"
                onClick={() => {
                  setModule('');
                  setKeyword('');
                }}
                disabled={!module && !keyword}
              >
                <RotateCcw size={15} /> Đặt lại
              </button>
            </div>
            {rows.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Không có quyền phù hợp"
                description="Thử từ khóa khác hoặc đặt lại bộ lọc."
                action={
                  <button
                    className="btn"
                    onClick={() => {
                      setModule('');
                      setKeyword('');
                    }}
                  >
                    Đặt lại bộ lọc
                  </button>
                }
              />
            ) : (
              <div className="table-wrap sc-table-flat">
                <table className="table table--compact sc-matrix">
                  <thead>
                    <tr>
                      <th className="sc-matrix__name">Chức năng / thao tác</th>
                      {roles.map((r) => (
                        <th key={r.role} className="center">
                          <Link to={`/school/roles/${r.role}`}>{CONFIG_ROLE_LABELS[r.role]}</Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((m) => [
                      <tr key={`m-${m}`} className="sc-group-row">
                        <td colSpan={roles.length + 1} className="fw-600">
                          {PERMISSION_MODULES[m]}
                        </td>
                      </tr>,
                      ...rows
                        .filter((p) => p.module === m)
                        .map((p) => (
                          <tr key={p.code}>
                            <td className="sc-matrix__name">
                              <div>{p.entity}</div>
                              <div className="text-xs muted">
                                {p.action} · <code>{p.code}</code>
                              </div>
                            </td>
                            {roles.map((r) => (
                              <td key={r.role} className="center">
                                <PermissionLevelBadge status={r.grants[p.code] || 'NONE'} />
                              </td>
                            ))}
                          </tr>
                        )),
                    ])}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
