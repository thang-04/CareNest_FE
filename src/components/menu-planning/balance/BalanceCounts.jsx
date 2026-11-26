import { DataTable } from '@/components';
import { NumberCell } from '@/components/menu-planning/balance/NumberCell';
import { childrenOfCampus } from '@/utils/menu-planning/dayBalance';

/** Số trẻ theo điểm trường × nhóm tuổi; lần 1 nhập được, `onChange` không truyền thì chỉ xem. */
export function BalanceCounts({ title, view, busy, onChange }) {
  const columns = [
    { key: 'name', header: title, render: (campus) => <b>{campus.name}</b> },
    ...view.ageGroups.map((group) => ({
      key: `ag-${group.ageGroupId}`,
      header: group.name,
      className: 'num',
      render: (campus) => {
        const cell = view.counts.find(
          (c) => String(c.campusId) === String(campus.campusId) && String(c.ageGroupId) === String(group.ageGroupId),
        );
        if (!onChange) return cell?.children ?? 0;
        return (
          <NumberCell
            value={cell?.children ?? 0}
            max={5000}
            disabled={busy}
            label={`Số trẻ ${group.name} ${campus.name}`}
            onCommit={(children) => onChange({ campusId: campus.campusId, ageGroupId: group.ageGroupId, children: Math.round(children) })}
          />
        );
      },
    })),
    {
      key: 'total',
      header: 'Tổng',
      className: 'num',
      render: (campus) => <b>{childrenOfCampus(view.counts, campus.campusId)}</b>,
    },
  ];
  return (
    <section className="card">
      <DataTable columns={columns} rows={view.campuses} rowKey="campusId" empty={{ title: 'Chưa có điểm trường có lớp' }} />
    </section>
  );
}
