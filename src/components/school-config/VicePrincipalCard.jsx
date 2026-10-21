import { UserCog, Utensils } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { UnassignedBadge } from '@/components/school-config/SchoolConfigBadges';
import { areaTasks, scopeText, taskOn, visibleVpAreas, vpGrantsOf } from '@/utils/school-config/vpAssignmentView';
import { formatDateTime } from '@/utils/format';

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** Thẻ 1 Phó hiệu trưởng: điểm trường phụ trách + bảng công việc được giao, nói bằng lời thường. */
export function VicePrincipalCard({ row, campusName, assignerName, readOnly, onEdit }) {
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
              {a ? `Phân công ${formatDateTime(a.assignedAt)}${assignerName ? ` · bởi ${assignerName}` : ''}` : row.user.email}
            </div>
          </div>
        </div>
        {!readOnly && (
          <button className={`btn btn--sm ${a ? '' : 'btn--primary'}`} onClick={onEdit}>
            <UserCog size={15} /> {a ? 'Đổi phân công' : 'Phân công'}
          </button>
        )}
      </div>

      <div className="sc-vp-card__tags">
        {a ? <span className="chip chip--blue">Phụ trách {campusName(a.campusId)}</span> : <UnassignedBadge />}
        {a?.sharedService && (
          <span className="chip chip--teal">
            <Utensils size={13} /> Phụ trách thực đơn bán trú
          </span>
        )}
      </div>

      {a ? (
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
