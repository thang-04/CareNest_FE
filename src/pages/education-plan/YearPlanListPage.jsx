import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@/components/ui/icons';
import { Card, EduStatusBadge, Field, Modal, Notice, PageHead, fmtDateTime } from '@/components/education-plan/eduUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { ROLES } from '@/models/User';
import { AGE_GROUPS } from '@/models/School';
import { copyYearPlan, emptyYearPlan, numberedGoals, yearWeeks } from '@/models/education-plan/yearPlanModel';

const yearDiff = (a, b) => Number(a.slice(0, 4)) - Number(b.slice(0, 4));

/** Danh sách kế hoạch giáo dục năm học theo khối (Phó HT và tổ trưởng cùng xây dựng, Phó HT ban hành). */
export default function YearPlanListPage() {
  const { yearPlans, yearId, schoolYear, user, savePlanDoc, historyEntry } = useEducationPlan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(null);
  const [source, setSource] = useState('');
  const canCreate = (groupId) => user.role === ROLES.VICE_PRINCIPAL || (user.role === ROLES.TEAM_LEADER && user.ageGroupId === groupId);

  const rows = AGE_GROUPS.map((g) => ({ group: g, plan: yearPlans.find((p) => p.ageGroupId === g.id && p.schoolYear === yearId) }));
  const sources = creating ? yearPlans.filter((p) => p.schoolYear !== yearId || p.ageGroupId !== creating.id) : [];
  const groupName = (id) => AGE_GROUPS.find((g) => g.id === id)?.shortName || id;

  const create = async () => {
    const id = `yp_${creating.id}_${yearId}`;
    const src = yearPlans.find((p) => p.id === source);
    const base = src
      ? copyYearPlan(src, { id, schoolYear: yearId, ageGroupId: creating.id, shiftDays: yearDiff(yearId, src.schoolYear) * 364 })
      : emptyYearPlan({ id, schoolYear: yearId, ageGroupId: creating.id });
    const saved = await savePlanDoc('year', {
      ...base,
      history: [historyEntry(src ? `Lập từ kế hoạch ${groupName(src.ageGroupId)} ${src.schoolYear}` : 'Lập kế hoạch mới')],
    });
    if (saved) navigate(`/education/year-plans/${saved.id}`);
  };

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch năm học' }]}
        title={`Kế hoạch giáo dục năm học ${schoolYear}`}
        desc="Mỗi khối một kế hoạch: mục tiêu đánh số liên tục cả năm, nội dung được tích vào chủ đề sẽ dạy. Phó hiệu trưởng và tổ trưởng cùng xây dựng, Phó hiệu trưởng ký ban hành."
      />
      <Card bodyClass={null}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Khối</th>
                <th>Trạng thái</th>
                <th>Mục tiêu</th>
                <th>Chủ đề</th>
                <th>Tuần học</th>
                <th>Cập nhật gần nhất</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ group, plan }) => {
                const last = plan?.history?.[plan.history.length - 1];
                return (
                  <tr
                    key={group.id}
                    className={plan ? 'row-click' : undefined}
                    onClick={plan ? () => navigate(`/education/year-plans/${plan.id}`) : undefined}
                  >
                    <td>
                      <div className="ga-cell-title">{group.shortName}</div>
                      <div className="ga-cell-sub">{group.name}</div>
                    </td>
                    <td>{plan ? <EduStatusBadge status={plan.status} /> : <span className="chip chip--gray">Chưa lập</span>}</td>
                    <td>{plan ? numberedGoals(plan).length : '—'}</td>
                    <td>{plan ? plan.themes.length : '—'}</td>
                    <td>{plan ? yearWeeks(plan).filter((w) => w.type === 'week').length : '—'}</td>
                    <td>{last ? `${last.action} · ${last.by} · ${fmtDateTime(last.at)}` : '—'}</td>
                    <td className="ga-text-right">
                      {plan ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => navigate(`/education/year-plans/${plan.id}`)}
                        >
                          Mở
                        </button>
                      ) : (
                        canCreate(group.id) && (
                          <button
                            type="button"
                            className="btn btn--outline-primary btn--sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSource(yearPlans.find((p) => p.ageGroupId === group.id)?.id || '');
                              setCreating(group);
                            }}
                          >
                            <Plus size={16} /> Lập kế hoạch
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {creating && (
        <Modal
          title={`Lập kế hoạch năm học ${schoolYear}: ${creating.shortName}`}
          onClose={() => setCreating(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setCreating(null)}>
                Hủy
              </button>
              <button type="button" className="btn btn--primary" onClick={create}>
                Tạo bản nháp
              </button>
            </>
          }
        >
          <Field label="Bắt đầu từ" hint="Sao chép giữ nguyên mục tiêu, nội dung, dấu tích chủ đề; ngày chủ đề được dời sang năm học này.">
            <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Kế hoạch trống (5 lĩnh vực)</option>
              {sources.map((p) => (
                <option key={p.id} value={p.id}>
                  Sao chép kế hoạch {groupName(p.ageGroupId)} năm {p.schoolYear}
                </option>
              ))}
            </select>
          </Field>
          <Notice>
            Bản nháp mới chỉ Phó hiệu trưởng và tổ trưởng của khối sửa được. Phó hiệu trưởng phân công lĩnh vực cho từng người trong bảng
            mục tiêu.
          </Notice>
        </Modal>
      )}
    </div>
  );
}
