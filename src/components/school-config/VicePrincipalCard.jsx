import { SCHOOL_CONFIG_API } from '@/config/env';
import { UserCog, Utensils } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { VpTaskPanel } from '@/components/permissions/VpTaskPanel';
import { vpItemsKey } from '@/utils/account/vpTasks';
import { UnassignedBadge } from '@/components/school-config/SchoolConfigBadges';
import { areaTasks, scopeText, taskOn, visibleVpAreas, vpGrantsOf } from '@/utils/school-config/vpAssignmentView';
import { formatDateTime } from '@/utils/format';

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** Thẻ 1 Phó hiệu trưởng: điểm trường phụ trách + bảng công việc được giao, nói bằng lời thường. */
export function VicePrincipalCard({ row, campusName, assignerName, readOnly, onEdit, tasks }) {
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
            <button className={`btn btn--sm ${a ? '' : 'btn--primary'}`} onClick={onEdit}>
              <UserCog size={15} /> {!a ? 'Phân công' : SCHOOL_CONFIG_API ? 'Đổi điểm trường' : 'Đổi phân công'}
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
        tasks.error ? (
          <ErrorState error={tasks.error} onRetry={tasks.reload} />
        ) : tasks.loading ? (
          <LoadingState />
        ) : tasks.items?.length ? (
          <VpTaskPanel
            key={vpItemsKey(tasks.items)}
            staff={{ userId: row.user.id, fullName: row.user.fullName }}
            campusName={campusName(a.campusId)}
            items={tasks.items}
            readOnly={tasks.readOnly}
            onSaved={tasks.onSaved}
            onDirty={tasks.onDirty}
          />
        ) : (
          <p className="sc-vp-card__empty muted text-sm">Chưa có việc nào để giao cho người này.</p>
        )
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
