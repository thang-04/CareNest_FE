import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, Notice, PageHead, YearPlanStatusBadge } from '@/components/education-plan/eduUi';
import { isMyReviewTurn, reviewLabel, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { Check, Eye, FileDown, PenLine, Plus } from '@/components/ui/icons';
import { themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { numberGoals } from '@/models/education-plan/goalTable';
import { exportThemeFile } from '@/utils/education-plan/classPlanDoc';
import { useClasses } from '@/hooks/useSchool';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import {
  createBlocker,
  ddmm,
  dueState,
  isEditableStatus,
  themeGoalBlocks,
  mondayOf,
  todayIso,
  yearWeeks,
} from '@/models/education-plan/classPlan';

/** /education/class, /education/branches: mở lớp đầu tiên người dùng được xem (lớp mình dạy trước). */
export function ClassPlanRedirect({ toOf = (id) => `/education/class/${id}` }) {
  const { user } = useEducationPlan();
  const { classes, loading } = useClasses();
  if (loading) return <LoadingState />;
  const own = classes.find((c) => (c.teacherIds || []).includes(user.id)) || classes[0];
  if (!own) return <EmptyState title="Bạn chưa được phân công lớp nào" />;
  return <Navigate to={toOf(own.id)} replace />;
}

/**
 * Mục "Kế hoạch chủ đề" trên sidebar: kế hoạch từng chủ đề + giáo án các tuần nhánh của lớp.
 * Chỉ lập được khi chủ đề nhánh cả năm (mục "Chủ đề nhánh") đã được duyệt.
 */
export default function ClassPlanPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user, branchPlans, classThemePlans, weekPlans, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan, pendingYearPlan, teachers, isClassTeacher } = ctx;

  if (ctx.loading) return <LoadingState />;
  if (!cls) return <EmptyState title="Không tìm thấy lớp hoặc bạn không có quyền xem" />;

  const base = `/education/class/${classId}`;
  const group = AGE_GROUPS.find((a) => a.id === cls.ageGroupId);
  const head = (
    <PageHead
      crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch chủ đề' }]}
      title={`Kế hoạch chủ đề ${cls.name}`}
      desc={`${group?.name || ''} · Giáo viên: ${teachers.map((t) => t.fullName).join(', ') || 'chưa phân công'}`}
      actions={
        <>
          {ctx.canPickClass && (
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
      <div className="page ga-page">
        {head}
        <Notice tone="warn">
          Kế hoạch giáo dục năm học của khối {group?.name} chưa được ban hành (Phó hiệu trưởng cần duyệt ban hành), nên lớp chưa lập được
          chủ đề nhánh và giáo án.
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

  const rows = yearWeeks(yearPlan);
  const thisWeek = mondayOf(todayIso());
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id) || null;
  const themes = [...yearPlan.themes].filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  const numbers = numberGoals(yearPlan.domains);
  // Xuất cả hồ sơ chủ đề (kế hoạch chủ đề + các tuần đã soạn) đúng thứ tự file của trường
  const exportTheme = (t, themeNo, doc, themeWeeks, mode) => {
    const ok = exportThemeFile(
      {
        themeDoc: doc,
        theme: t,
        themeNo,
        cls,
        weeks: themeWeeks,
        blocks: themeGoalBlocks(yearPlan.domains, numbers, t.id),
        rowOf: (g) => themeRowOf(doc, g),
        weekDocs: themeWeeks
          .map((w, i) => ({
            week: w,
            branchNo: i + 1,
            branchName: branch?.names?.[w.start] || '',
            doc: weekPlans.find((x) => x.classId === classId && x.weekStart === w.start),
          }))
          .filter((w) => w.doc),
      },
      mode,
    );
    if (!ok) toast('Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.', 'warn');
  };
  // Hạn gửi chỉ để nhắc: hồ sơ chủ đề gửi trước ngày bắt đầu chủ đề
  const due = (doc, dueIso) => {
    const st = dueState(doc, dueIso);
    return (
      <span className="row row--wrap gap-2">
        <span>Hạn gửi: {ddmm(dueIso)}</span>
        {st === 'late' && <span className="chip chip--red">Quá hạn</span>}
        {st === 'soon' && <span className="chip chip--orange">Sắp đến hạn</span>}
      </span>
    );
  };
  const status = (doc, none) => (doc ? <EduStatusBadge status={doc.status} /> : <span className="chip chip--gray">{none}</span>);
  const branchApproved = branch?.status === EDU_STATUS.APPROVED;
  // Giáo án tuần chỉ tạo được khi đã lưu kế hoạch chủ đề; dòng chưa tới lượt hiện lý do, không có nút tạo
  const lockOf = (kind, themeId) => createBlocker(kind, { classId, yearPlanId: yearPlan.id, themeId }, { branchPlans, classThemePlans });
  // Lý do để ở tooltip, không hiện thêm dòng chữ trong bảng
  const lockedStatus = (lock) => (
    <span className="chip chip--gray" title={lock.message}>
      Chưa thể bắt đầu
    </span>
  );
  /*
   * Một nút cho mỗi tài liệu, theo việc người dùng cần làm (gửi / duyệt nằm cuối trang của tài liệu):
   * đến lượt duyệt → Duyệt; giáo viên còn sửa được → Sửa / Tạo; còn lại → Xem.
   */
  const action = (doc, to, create, reviewTo = to) => {
    if (isMyReviewTurn(doc, ctx, user))
      return (
        <Link className="btn btn--success btn--sm" to={reviewTo}>
          <Check size={16} aria-hidden /> Duyệt
        </Link>
      );
    if (isClassTeacher && (!doc || isEditableStatus(doc.status)))
      return (
        <Link className={`btn btn--sm ${doc ? 'btn--outline-primary' : 'btn--primary'}`} to={to}>
          {doc ? <PenLine size={16} aria-hidden /> : <Plus size={16} aria-hidden />} {doc ? 'Sửa' : create}
        </Link>
      );
    if (!doc) return <span className="muted text-sm">Chưa lập</span>;
    return (
      <Link className="icon-btn" to={to} title="Xem" aria-label="Xem">
        <Eye size={16} aria-hidden />
      </Link>
    );
  };

  return (
    <div className="page ga-page">
      {head}
      {!branchApproved && (
        <Notice tone="warn">
          Cần duyệt chủ đề nhánh trước. Kế hoạch chủ đề và giáo án tuần dùng tên chủ đề nhánh đã duyệt.{' '}
          <Link to={`/education/branches/${classId}`}>Mở Chủ đề nhánh</Link>
        </Notice>
      )}

      {/* Mỗi chủ đề là một hồ sơ như file của trường: gửi, duyệt cả hồ sơ một lần; đã duyệt thì xuất để in, ký tay */}
      {branchApproved &&
        themes.map((t, ti) => {
          const doc = classThemePlans.find((x) => x.classId === classId && x.themeId === t.id) || null;
          const themeRows = rows.filter((r) => r.theme.id === t.id);
          const themeWeeks = themeRows.filter((r) => r.type === 'week');
          const sent = !!doc && doc.status !== EDU_STATUS.DRAFT;
          const to = `${base}/themes/${t.id}/review`;
          const weekLock = lockOf('week', t.id);
          return (
            <Card
              key={t.id}
              title={`Chủ đề ${ti + 1}: ${t.name}`}
              bodyClass={null}
              actions={
                <>
                  <span className="muted text-sm">
                    {ddmm(t.start)} → {ddmm(t.end)} · {themeWeeks.length} tuần
                  </span>
                  <button
                    type="button"
                    className="btn btn--outline-primary btn--sm"
                    onClick={() => exportTheme(t, ti + 1, doc, themeWeeks, 'doc')}
                  >
                    <FileDown size={16} aria-hidden /> Xuất Word
                  </button>
                </>
              }
            >
              <div className="card__body stack">
                <div className="row row--between row--wrap gap-3">
                  <div className="row row--wrap gap-2">
                    {sent ? <EduStatusBadge status={doc.status} /> : <span className="muted text-sm">{due(doc, t.start)}</span>}
                  </div>
                  {/* Gửi và duyệt ở cuối trang xem cả tập; nút nói rõ việc cần làm */}
                  {doc && (
                    <Link
                      className={`btn btn--sm ${reviewLabel(doc, ctx, user, 'theme') === 'Xem cả kế hoạch chủ đề' ? 'btn--outline-primary' : 'btn--primary'}`}
                      to={to}
                    >
                      {reviewLabel(doc, ctx, user, 'theme')}
                    </Link>
                  )}
                </div>
                <div className="table-wrap">
                  <table className="table ga-plan-table ga-goal-table">
                    <colgroup>
                      <col />
                      <col className="ga-goal-table__group" />
                      <col className="ga-goal-table__group" />
                      <col className="ga-goal-table__code" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Nội dung</th>
                        <th className="ga-goal-table__fixed">Thời gian</th>
                        <th>Trạng thái</th>
                        <th className="center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <div className="ga-goal-table__pad">
                            <div className="fw-600">Kế hoạch giáo dục chủ đề</div>
                          </div>
                        </td>
                        <td className="ga-goal-table__fixed">
                          <div className="ga-goal-table__pad">
                            {ddmm(t.start)} → {ddmm(t.end)}
                          </div>
                        </td>
                        <td>
                          <div className="ga-goal-table__pad">{status(doc, 'Chưa lập')}</div>
                        </td>
                        <td className="center">
                          <div className="ga-goal-table__pad">{action(doc, `${base}/themes/${t.id}`, 'Lập', to)}</div>
                        </td>
                      </tr>
                      {themeRows.map((r) => {
                        if (r.type === 'break')
                          return (
                            <tr key={`b-${r.start}`}>
                              <td colSpan={4} className="ga-goal-table__fixed">
                                <div className="ga-goal-table__pad">
                                  Nghỉ: {r.label || 'Đợt nghỉ'} ({ddmm(r.start)} → {ddmm(r.end)})
                                </div>
                              </td>
                            </tr>
                          );
                        const wdoc = weekPlans.find((w) => w.classId === classId && w.weekStart === r.start) || null;
                        const name = branch?.names?.[r.start]?.trim();
                        const lock = !wdoc && weekLock;
                        return (
                          <tr key={r.start}>
                            <td>
                              <div className="ga-goal-table__pad">
                                <div className={name ? 'fw-600' : 'muted'}>
                                  Chủ đề nhánh {themeWeeks.indexOf(r) + 1}: {name || 'chưa đặt tên'}
                                </div>
                              </div>
                            </td>
                            <td className="ga-goal-table__fixed">
                              <div className="ga-goal-table__pad">
                                Tuần {r.no}: {ddmm(r.start)} → {ddmm(r.end)}
                                {r.start === thisWeek && <span className="chip chip--blue"> Tuần này</span>}
                              </div>
                            </td>
                            <td>
                              <div className="ga-goal-table__pad">{lock ? lockedStatus(lock) : status(wdoc, 'Chưa soạn')}</div>
                            </td>
                            <td className="center">
                              <div className="ga-goal-table__pad">
                                {!lock && action(wdoc, `${base}/weeks/${r.start}`, 'Tạo', `${to}?week=${r.start}`)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          );
        })}
    </div>
  );
}
