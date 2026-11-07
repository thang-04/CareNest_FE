import { SCHOOL_CONFIG_API } from '@/config/env';
import { KeyRound, UserCog, Utensils } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useVicePermissions } from '@/hooks/school-config/useSchoolConfig';
import { UnassignedBadge } from '@/components/school-config/SchoolConfigBadges';
import { areaTasks, scopeText, taskOn, visibleVpAreas, vpGrantsOf } from '@/utils/school-config/vpAssignmentView';
import { formatDateTime } from '@/utils/format';

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// Bảng chỉ đọc: việc người này được làm (mặc định vai trò ± ngoại lệ); sửa ở màn Quyền ngoại lệ từng người
function VicePermissionTable({ userId }) {
  const { permissions, loading, error, reload } = useVicePermissions(userId);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const items = permissions?.items || [];
  if (!items.length) return <p className="sc-vp-card__empty muted text-sm">Chưa có việc nào để thiết lập quyền cho người này.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact sc-vp-table sc-vp-table--perms">
        <thead>
          <tr>
            <th>Việc được làm</th>
            <th>Người này</th>
            <th>So với vai trò</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.code} className={item.on ? '' : 'sc-vp-table__off'}>
              <td className={item.on ? 'fw-600' : ''}>{item.label}</td>
              <td>
                {item.on ? <span className="chip chip--green">Được làm</span> : <span className="chip chip--gray">Không được làm</span>}
              </td>
              <td>
                {item.on === item.roleOn ? (
                  <span className="muted text-sm">Theo vai trò</span>
                ) : item.on ? (
                  <span className="chip chip--blue">Cấp thêm</span>
                ) : (
                  <span className="chip chip--orange">Thu hồi</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Thẻ 1 Phó hiệu trưởng: điểm trường phụ trách + bảng công việc được giao, nói bằng lời thường. */
export function VicePrincipalCard({ row, campusName, assignerName, readOnly, onEdit, onChoosePermissions }) {
  const a = row.assignment;
  const grants = vpGrantsOf(a);

  return (
    <section className="card sc-vp-card" aria-label={`Phân công ${row.user.fullName}`}>
      <div className="sc-vp-card__head">
        <div className="sc-person">
          <Avatar user={row.user} />
          <div className="sc-person__text">
            <div className="fw-600">{row.user.fullName}</div>
            <div className="text-xs muted">
              {/* BE chưa trả thời điểm phân công (dữ liệu cũ) thì hiện email thay vì "Phân công —" */}
              {a?.assignedAt ? `Phân công ${formatDateTime(a.assignedAt)}${assignerName ? ` · bởi ${assignerName}` : ''}` : row.user.email}
            </div>
          </div>
        </div>
        {!readOnly && (
          <div className="row gap-2">
            {/* Quyền thao tác thuộc màn Quyền ngoại lệ từng người (module phân quyền) */}
            {a && onChoosePermissions && (
              <button className="btn btn--sm" type="button" onClick={onChoosePermissions}>
                <KeyRound size={15} /> Chọn quyền
              </button>
            )}
            <button className={`btn btn--sm ${a ? '' : 'btn--primary'}`} onClick={onEdit}>
              <UserCog size={15} /> {a ? 'Đổi phân công' : 'Phân công'}
            </button>
          </div>
        )}
      </div>

      <div className="sc-vp-card__tags">
        {a ? <span className="chip chip--blue">Phụ trách {campusName(a.campusId)}</span> : <UnassignedBadge />}
        {!SCHOOL_CONFIG_API && a?.sharedService && (
          <span className="chip chip--teal">
            <Utensils size={13} /> Phụ trách thực đơn bán trú
          </span>
        )}
      </div>

      {a && SCHOOL_CONFIG_API ? (
        <VicePermissionTable userId={row.user.id} />
      ) : a ? (
        <div className="table-wrap">
          <table className="table table--grid table--compact sc-vp-table">
            <thead>
              <tr>
                <th>Công việc được giao</th>
                <th>Ở đâu</th>
                <th>Được làm gì</th>
              </tr>
            </thead>
            <tbody>
              {visibleVpAreas.map((area) => {
                const g = grants[area.key];
                if (!g)
                  return (
                    <tr key={area.key} className="sc-vp-table__off">
                      <td>{area.label}</td>
                      <td colSpan={2}>Không giao — không thấy mục này</td>
                    </tr>
                  );
                const done = areaTasks(area).filter((t) => taskOn(t, g.actions));
                return (
                  <tr key={area.key}>
                    <td className="fw-600">{area.label}</td>
                    <td>{scopeText(g.campusId, campusName)}</td>
                    <td>
                      {done.length ? (
                        <>
                          <span className="chip chip--green">Được quản lý</span> {done.map((t) => lowerFirst(t.label)).join(' · ')}
                        </>
                      ) : (
                        <span className="chip chip--gray">Chỉ xem</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="sc-vp-card__empty muted text-sm">Chưa giao điểm trường và công việc nào cho Phó hiệu trưởng này.</p>
      )}
    </section>
  );
}
