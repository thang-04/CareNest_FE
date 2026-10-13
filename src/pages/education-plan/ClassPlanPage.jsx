import { Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Save } from '@/components/ui/icons';
import { Card, EduStatusBadge, EmptyState, Notice, PageHead } from '@/components/education-plan/eduUi';
import { AiButton, AiDraftPanel, ReviewBar, setPath, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { useClasses } from '@/hooks/useSchool';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { ageGroupById } from '@/models/School';
import { ddmm, emptyBranchPlan, isEditableStatus, mondayOf, monthOf, todayIso, yearWeeks } from '@/models/education-plan/yearPlanModel';

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
 * Trang lớp: bảng dự kiến chủ đề nhánh và thời gian (35 tuần), mỗi dòng mở giáo án tuần,
 * mỗi chủ đề mở kế hoạch chủ đề. Theo file "Dự kiến chủ đề nhánh" của Trường MN Thái Dương.
 */
export default function ClassPlanPage() {
  const { classId } = useParams();
  // Đổi lớp/tuần thì dựng lại trang để bỏ bản sửa dở của trang trước
  return <ClassPlanPageInner key={classId} />;
}

function ClassPlanPageInner() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { branchPlans, themePlans, weekPlans, savePlanDoc, actOnPlanDoc, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { classes: visible } = useClasses();
  const { cls, yearPlan, teachers, isClassTeacher } = ctx;
  const saved = yearPlan ? branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id) : null;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [ai, setAi] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(saved || (yearPlan ? emptyBranchPlan({ classId, yearPlanId: yearPlan.id }) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.status, saved?.history?.length, yearPlan?.id, classId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls) return <EmptyState title="Không tìm thấy lớp hoặc bạn không có quyền xem" />;

  const group = ageGroupById(cls.ageGroupId);
  const head = (
    <PageHead
      crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: `Kế hoạch ${cls.name}` }]}
      title={`Kế hoạch giáo dục ${cls.name}`}
      desc={`${group?.name || ''} · Giáo viên: ${teachers.map((t) => t.fullName).join(', ') || 'chưa phân công'}`}
      actions={
        visible.length > 1 && (
          <select className="select" aria-label="Chọn lớp" value={classId} onChange={(e) => navigate(`/education/class/${e.target.value}`)}>
            {visible.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({ageGroupById(c.ageGroupId)?.shortName})
              </option>
            ))}
          </select>
        )
      }
    />
  );

  if (!yearPlan || yearPlan.status !== EDU_STATUS.APPROVED) {
    return (
      <div className="page">
        {head}
        <Notice tone="warn">
          Kế hoạch giáo dục năm học của khối {group?.shortName} chưa được ban hành nên lớp chưa lập được chủ đề nhánh và giáo án.{' '}
          {yearPlan && <Link to={`/education/year-plans/${yearPlan.id}`}>Xem kế hoạch năm</Link>}
        </Notice>
      </div>
    );
  }
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = isClassTeacher && isEditableStatus(status);
  const rows = yearWeeks(yearPlan);
  const weeksOf = (themeId) => rows.filter((r) => r.type === 'week' && r.theme.id === themeId);
  const thisWeek = mondayOf(todayIso());
  const empty = rows.filter((r) => r.type === 'week' && !draft.names[r.start]?.trim()).length;

  const save = async () => {
    const res = await savePlanDoc('branch', draft);
    if (res) {
      setDirty(false);
      setDraft(res);
      toast('Đã lưu chủ đề nhánh');
    }
  };
  const setName = (start, name) => {
    setDraft((d) => ({ ...d, names: { ...d.names, [start]: name } }));
    setDirty(true);
  };

  // Ô chủ đề gộp các dòng tuần (và dòng nghỉ) của chủ đề đó, như bảng của trường.
  const spanOf = (themeId) => rows.filter((r) => r.theme.id === themeId).length;
  let lastMonth = null;

  return (
    <div className="page">
      {head}
      <ReviewBar
        title="Dự kiến chủ đề nhánh và thời gian thực hiện"
        doc={saved}
        dirty={dirty}
        {...ctx}
        onAct={async (action, body) => {
          const res = await actOnPlanDoc('branch', draft.id, { action, ...body });
          if (res) toast('Đã cập nhật trạng thái');
          return res;
        }}
      />
      <Card
        title="Chủ đề nhánh từng tuần"
        bodyClass={null}
        actions={
          editable && (
            <div className="row row--wrap">
              <AiButton onClick={() => setAi(true)}>Gợi ý tên nhánh bằng AI</AiButton>
              <button type="button" className="btn btn--primary btn--sm" disabled={!dirty} onClick={save}>
                <Save size={16} /> {dirty ? 'Lưu' : 'Đã lưu'}
              </button>
            </div>
          )
        }
      >
        {editable && empty > 0 && (
          <div className="card__body">
            <Notice>Còn {empty} tuần chưa đặt tên chủ đề nhánh. Lưu bản nháp rồi gửi duyệt khi đủ.</Notice>
          </div>
        )}
        <div className="table-wrap">
          <table className="table ga-plan-table table--compact">
            <thead>
              <tr>
                <th>Tháng</th>
                <th>Chủ đề</th>
                <th>Chủ đề nhánh</th>
                <th>Tuần</th>
                <th>Thời gian</th>
                <th>Giáo án tuần</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const month = monthOf(r.start);
                const showMonth = month !== lastMonth;
                lastMonth = month;
                const firstOfTheme = rows.find((x) => x.theme.id === r.theme.id) === r;
                const tp = themePlans.find((t) => t.classId === classId && t.themeId === r.theme.id);
                const themeCell = firstOfTheme && (
                  <td rowSpan={spanOf(r.theme.id)}>
                    <div className="ga-cell-title">{r.theme.name}</div>
                    <div className="ga-cell-sub">
                      {weeksOf(r.theme.id).length} tuần · {ddmm(r.theme.startDate)} → {ddmm(r.theme.endDate)}
                    </div>
                    <div className="row row--wrap mt-8">
                      {tp ? <EduStatusBadge status={tp.status} /> : <span className="chip chip--gray">Chưa lập</span>}
                      <Link className="btn btn--ghost btn--sm" to={`/education/class/${classId}/themes/${r.theme.id}`}>
                        Kế hoạch chủ đề
                      </Link>
                    </div>
                  </td>
                );
                if (r.type === 'break') {
                  return (
                    <tr key={`b-${r.start}`}>
                      <td>{showMonth ? `Tháng ${month}` : ''}</td>
                      {themeCell}
                      <td colSpan={4} className="muted">
                        {r.label} ({ddmm(r.start)} → {ddmm(r.end)})
                      </td>
                    </tr>
                  );
                }
                const wp = weekPlans.find((w) => w.classId === classId && w.weekStart === r.start);
                return (
                  <Fragment key={r.start}>
                    <tr>
                      <td>{showMonth ? `Tháng ${month}` : ''}</td>
                      {themeCell}
                      <td>
                        {editable ? (
                          <input
                            className="input"
                            value={draft.names[r.start] || ''}
                            aria-label={`Chủ đề nhánh tuần ${r.no}`}
                            onChange={(e) => setName(r.start, e.target.value)}
                          />
                        ) : (
                          draft.names[r.start] || <span className="muted">Chưa đặt tên</span>
                        )}
                      </td>
                      <td>
                        Tuần {r.no} {r.start === thisWeek && <span className="chip chip--blue">Tuần này</span>}
                      </td>
                      <td>
                        {ddmm(r.start)} → {ddmm(r.end)}
                      </td>
                      <td>
                        <div className="row row--wrap">
                          {wp ? <EduStatusBadge status={wp.status} /> : <span className="chip chip--gray">Chưa soạn</span>}
                          <Link className="btn btn--ghost btn--sm" to={`/education/class/${classId}/weeks/${r.start}`}>
                            Mở
                          </Link>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <AiDraftPanel
        open={ai}
        title="Gợi ý tên chủ đề nhánh"
        type="branch-names"
        context={{ themes: yearPlan.themes.map((t) => ({ abbr: t.abbr, name: t.name, weeks: weeksOf(t.id) })) }}
        isFilled={(key) => !!draft.names[key.slice('names.'.length)]?.trim()}
        onClose={() => setAi(false)}
        onApply={(items) => {
          setDraft((d) => items.reduce((acc, it) => setPath(acc, it.key, it.value), d));
          setDirty(true);
          toast(`Đã đưa ${items.length} tên nhánh vào bảng (nháp AI, nhớ kiểm tra rồi lưu)`, 'info');
        }}
      />
    </div>
  );
}
