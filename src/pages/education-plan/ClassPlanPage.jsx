import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Save } from '@/components/ui/icons';
import { Card, EduStatusBadge, EmptyState, Notice, PageHead, YearPlanStatusBadge } from '@/components/education-plan/eduUi';
import { Cell, DocSignatures, ReviewBar, focusCell, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { useClasses } from '@/hooks/useSchool';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { ddmm, emptyBranchPlan, isEditableStatus, mondayOf, monthOf, todayIso, yearWeeks } from '@/models/education-plan/classPlan';

/** /education/class: mở lớp đầu tiên người dùng được xem (lớp mình dạy trước). */
export function ClassPlanRedirect() {
  const { user } = useEducationPlan();
  const { classes, loading } = useClasses();
  if (loading) return <LoadingState />;
  const own = classes.find((c) => (c.teacherIds || []).includes(user.id)) || classes[0];
  if (!own) return <EmptyState title="Bạn chưa được phân công lớp nào" />;
  return <Navigate to={`/education/class/${own.id}`} replace />;
}

/**
 * Trang lớp: "Dự kiến chủ đề nhánh và thời gian thực hiện" theo mẫu MN Thái Dương.
 * Tháng | Chủ đề (gộp dòng) | Chủ đề nhánh (giáo viên gõ) | Tuần (đánh số cả năm, dòng nghỉ) | Ghi chú | Giáo án tuần.
 */
export default function ClassPlanPage() {
  const { classId } = useParams();
  // Đổi lớp thì dựng lại trang để bỏ bản sửa dở của lớp trước
  return <ClassPlanInner key={classId} />;
}

function ClassPlanInner() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user, branchPlans, classThemePlans, weekPlans, saveClassDoc, actOnClassDoc, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan, pendingYearPlan, teachers, isClassTeacher } = ctx;
  const saved = yearPlan ? branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id) || null : null;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(saved || (yearPlan ? emptyBranchPlan({ classId, yearPlanId: yearPlan.id }) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.status, saved?.history?.length, yearPlan?.id, classId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls) return <EmptyState title="Không tìm thấy lớp hoặc bạn không có quyền xem" />;

  const group = AGE_GROUPS.find((a) => a.id === cls.ageGroupId);
  const head = (
    <PageHead
      crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: `Kế hoạch ${cls.name}` }]}
      title={`Kế hoạch giáo dục ${cls.name}`}
      desc={`${group?.name || ''} · Giáo viên: ${teachers.map((t) => t.fullName).join(', ') || 'chưa phân công'}`}
      actions={
        <>
          {yearPlan && (
            <Link className="btn btn--ghost" to={`/education/goals/${yearPlan.id}`}>
              Kế hoạch năm học
            </Link>
          )}
          {classes.length > 1 && (
            <select
              className="select"
              aria-label="Chọn lớp"
              value={classId}
              onChange={(e) => navigate(`/education/class/${e.target.value}`)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </>
      }
    />
  );

  if (!yearPlan) {
    return (
      <div className="page">
        {head}
        <Notice tone="warn">
          Kế hoạch giáo dục năm học của khối {group?.name} chưa được ban hành (cần chữ ký của Tổ trưởng và Phó hiệu trưởng), nên lớp chưa
          lập được chủ đề nhánh và giáo án.
          {pendingYearPlan && (
            <>
              {' '}
              Trạng thái hiện tại: <YearPlanStatusBadge status={pendingYearPlan.status} />
            </>
          )}
        </Notice>
      </div>
    );
  }
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = isClassTeacher && isEditableStatus(status);
  const rows = yearWeeks(yearPlan);
  const thisWeek = mondayOf(todayIso());
  const empty = rows.filter((r) => r.type === 'week' && !draft.names[r.start]?.trim()).length;
  const set = (field, key, value) => {
    setDraft((d) => ({ ...d, [field]: { ...d[field], [key]: value } }));
    setDirty(true);
  };
  const save = async () => {
    const res = await saveClassDoc('branch', draft);
    if (res) {
      setDirty(false);
      setDraft(res);
      toast('Đã lưu chủ đề nhánh');
    }
  };
  // Ô tháng và ô chủ đề gộp các dòng liên tiếp cùng tháng / cùng chủ đề như bảng của trường
  const spanFrom = (i, same) => {
    let n = 1;
    while (i + n < rows.length && same(rows[i + n], rows[i])) n += 1;
    return n;
  };
  const sameMonth = (a, b) => monthOf(a.start) === monthOf(b.start);
  const sameTheme = (a, b) => a.theme.id === b.theme.id;

  return (
    <div className="page">
      {head}
      <ReviewBar
        kind="branch"
        title="Dự kiến chủ đề nhánh và thời gian thực hiện"
        doc={saved}
        dirty={dirty}
        ctx={ctx}
        user={user}
        onAct={(action, body) => actOnClassDoc('branch', draft.id, { action, ...body })}
      />
      <Card
        title="Chủ đề nhánh từng tuần"
        bodyClass={null}
        actions={
          editable && (
            <button type="button" className="btn btn--primary btn--sm" disabled={!dirty && !!saved} onClick={save}>
              <Save size={16} aria-hidden /> {dirty || !saved ? 'Lưu' : 'Đã lưu'}
            </button>
          )
        }
      >
        <div className="card__body stack">
          {editable && empty > 0 && <Notice>Còn {empty} tuần chưa đặt tên chủ đề nhánh.</Notice>}
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-goal-table__del" />
                <col className="ga-goal-table__group" />
                <col />
                <col className="ga-goal-table__group" />
                <col />
                <col className="ga-goal-table__code" />
              </colgroup>
              <thead>
                <tr>
                  <th className="ga-goal-table__fixed">Tháng</th>
                  <th className="ga-goal-table__fixed">Chủ đề</th>
                  <th>Chủ đề nhánh</th>
                  <th className="ga-goal-table__fixed">Tuần</th>
                  <th>Ghi chú</th>
                  <th className="center">Giáo án tuần</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const monthCell = (i === 0 || !sameMonth(rows[i - 1], r)) && (
                    <td className="ga-goal-table__fixed" rowSpan={spanFrom(i, sameMonth)}>
                      <div className="ga-goal-table__pad">Tháng {monthOf(r.start)}</div>
                    </td>
                  );
                  const tp = classThemePlans.find((t) => t.classId === classId && t.themeId === r.theme.id);
                  const themeCell = (i === 0 || !sameTheme(rows[i - 1], r)) && (
                    <td className="ga-goal-table__fixed" rowSpan={spanFrom(i, sameTheme)}>
                      <div className="ga-goal-table__pad stack">
                        <span className="fw-600">{r.theme.name}</span>
                        <span className="text-xs">
                          {ddmm(r.theme.start)} → {ddmm(r.theme.end)}
                        </span>
                        <span>{tp ? <EduStatusBadge status={tp.status} /> : <span className="chip chip--gray">Chưa lập</span>}</span>
                        <Link className="btn btn--ghost btn--sm" to={`/education/class/${classId}/themes/${r.theme.id}`}>
                          Kế hoạch chủ đề
                        </Link>
                      </div>
                    </td>
                  );
                  if (r.type === 'break')
                    return (
                      <tr key={`b-${r.start}`}>
                        {monthCell}
                        {themeCell}
                        <td colSpan={4} className="ga-goal-table__fixed">
                          <div className="ga-goal-table__pad">
                            Nghỉ: {r.label || 'Đợt nghỉ'} ({ddmm(r.start)} → {ddmm(r.end)})
                          </div>
                        </td>
                      </tr>
                    );
                  const wp = weekPlans.find((w) => w.classId === classId && w.weekStart === r.start);
                  return (
                    <tr key={r.start}>
                      {monthCell}
                      {themeCell}
                      <td>
                        <Cell
                          editable={editable}
                          value={draft.names[r.start]}
                          label={`Chủ đề nhánh tuần ${r.no}`}
                          placeholder="Nhập tên chủ đề nhánh"
                          onChange={(v) => set('names', r.start, v)}
                        />
                      </td>
                      <td className="ga-goal-table__fixed">
                        <div className="ga-goal-table__pad">
                          Tuần {r.no}: {ddmm(r.start)} → {ddmm(r.end)}
                          {r.start === thisWeek && <span className="chip chip--blue"> Tuần này</span>}
                        </div>
                      </td>
                      <td>
                        <Cell
                          editable={editable}
                          value={draft.notes?.[r.start]}
                          label={`Ghi chú tuần ${r.no}`}
                          onChange={(v) => set('notes', r.start, v)}
                        />
                      </td>
                      <td className="center">
                        <div className="ga-goal-table__pad stack">
                          {wp ? <EduStatusBadge status={wp.status} /> : <span className="chip chip--gray">Chưa soạn</span>}
                          <Link className="btn btn--ghost btn--sm" to={`/education/class/${classId}/weeks/${r.start}`}>
                            Mở
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="ga-goal-table__pad muted">Kế hoạch năm chưa có chủ đề nào có ngày bắt đầu và kết thúc.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <DocSignatures doc={saved} teachers={teachers} />
    </div>
  );
}
