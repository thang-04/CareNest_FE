import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ClassFilterBar, ClassPageEmpty, FilterSelect, docReview, useClassPlanContext } from '@/components/education-plan/planUi';
import { Card, DocAvailabilityBadge, EduStatusBadge, EmptyCard, FoldAllButton, PageHead } from '@/components/education-plan/eduUi';
import { ReviewActions } from '@/components/education-plan/reviewUi';
import { DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { LoadingState } from '@/components/ui/States';
import { Eye, Pencil, Plus } from '@/components/ui/icons';
import { DocTable } from '@/components/ui/DocTable';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { usePolling } from '@/hooks/usePolling';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import {
  DAY_SECTIONS,
  ddmm,
  isEditableStatus,
  semesterChoices,
  themeBranchGroups,
  todayIso,
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { BLOCKED_TEXT } from '@/models/education-plan/deadline.mjs';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { WeekPlanInner } from '@/pages/education-plan/WeekPlanPage';

/** Đường dẫn cũ /education/class/:classId/weeks/:weekStart/days ⇒ trang Kế hoạch giáo dục ngày của tuần đó. */
export function DayPlansLegacyRedirect() {
  const { classId, weekStart } = useParams();
  return <Navigate to={`/education/day-plans/${classId}?week=${weekStart}`} replace />;
}

/**
 * Kế hoạch giáo dục ngày (spec 004): chưa chọn tuần ⇒ trang ngoài (danh sách chủ đề theo học kỳ); có ?week= hoặc ?theme= ⇒ giáo án
 * ngày của tuần đó; gửi/duyệt theo hồ sơ chủ đề.
 */
export default function DayPlansPage() {
  const { classId } = useParams();
  const [params] = useSearchParams();
  if (!params.get('week') && !params.get('theme')) return <DayPlansList key={classId} classId={classId} />;
  return <DayPlansWeek classId={classId} params={params} />;
}

function DayPlansWeek({ classId, params }) {
  const navigate = useNavigate();
  const ctx = useClassPlanContext(classId);
  if (ctx.loading) return <LoadingState />;
  const weeks = ctx.cls && ctx.yearPlan ? yearWeeks(ctx.yearPlan).filter((w) => w.type === 'week') : [];
  if (!weeks.length)
    return (
      <ClassPageEmpty
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục ngày' }]}
        title="Kế hoạch giáo dục ngày"
        classes={ctx.classes}
        classId={classId}
        onPick={(id) => navigate(`/education/day-plans/${id}`)}
        emptyTitle={ctx.cls ? 'Chưa có tuần học' : 'Không tìm thấy lớp'}
      />
    );
  const today = todayIso();
  const asked = params.get('week');
  const week =
    weeks.find((w) => w.start === asked) ||
    weeks.find((w) => String(w.theme.id) === params.get('theme')) ||
    weeks.find((w) => w.start <= today && today <= w.end) ||
    weeks[0];
  return <WeekPlanInner key={`${classId}/${week.start}`} mode="days" classId={classId} weekStart={week.start} dayPage />;
}

/**
 * Trang ngoài Kế hoạch giáo dục ngày (Tiền 12/11/2026): như trang Kế hoạch giáo dục chủ đề nhưng chỉ có giáo án ngày — tab Học kỳ
 * 1 / 2, mỗi chủ đề một thẻ có trạng thái hồ sơ chủ đề (ban hành theo chủ đề) và nút gửi duyệt riêng; mỗi dòng một tuần "Nhánh n: tên".
 * Không có dòng kế hoạch chủ đề, không có trạng thái / gửi duyệt chung của học kỳ. Quyền và điều kiện gửi do BE trả.
 */
function DayPlansList({ classId }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, branchPlans, dayPlans, themeDossiers, semesterPackages, actOnClassDoc, eduConfig, refreshClassDocs } = useEducationPlan();
  const { schoolYear: yearId, schoolYears } = useSchoolYear();
  const [folded, setFolded] = useState(() => new Set());
  // Lỗi BE trả khi gửi hồ sơ chủ đề (7390 mục trống, 7396/7397 MT chưa dạy), theo từng chủ đề
  const [sendErr, setSendErr] = useState({});
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan, canComposeClassDocs } = ctx;
  // Người khác gửi/duyệt/trả lại hồ sơ chủ đề thì trang tự cập nhật
  usePolling(() => refreshClassDocs?.().catch(() => {}));
  if (ctx.loading) return <LoadingState />;
  const head = (filters = null, extra = null) => (
    <div className="ga-sticky-head">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục ngày' }]}
        title={`Kế hoạch giáo dục ngày ${cls?.name || ''}`}
      />
      {/* Học kỳ nằm cùng hàng lọc lớp (Tiền 13/11/2026). */}
      <ClassFilterBar
        classes={classes}
        classId={classId}
        canPick={ctx.canPickClass}
        onPick={(id) => navigate(`/education/day-plans/${id}`)}
      >
        {filters}
      </ClassFilterBar>
      {extra && (
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác">
          <div className="ga-year-toolbar__group">
            <span className="ga-year-toolbar__title">{cls?.name}</span>
            {extra}
          </div>
        </div>
      )}
    </div>
  );
  if (!cls || !yearPlan)
    return (
      <div className="page ga-page">
        {head()}
        <EmptyCard title={cls ? 'Kế hoạch giáo dục tổ của nhóm tuổi này chưa được ban hành' : 'Không tìm thấy lớp'} />
      </div>
    );
  const packages = semesterPackages
    .filter((p) => p.classId === classId && p.yearPlanId === yearPlan.id)
    .sort((a, b) => a.semesterNo - b.semesterNo);
  // Mặc định học kỳ đang diễn ra, chưa vào năm học thì học kỳ 1 (như trang Kế hoạch giáo dục chủ đề)
  const today = todayIso();
  const allThemesForHk = [...yearPlan.themes].filter((t) => t.start && t.end);
  const choices = semesterChoices(
    schoolYears.find((y) => String(y.id) === String(yearId)),
    allThemesForHk,
    packages,
  );
  const current = [...choices].reverse().find((c) => c.deadline && c.deadline <= today) || choices[0];
  const hk = params.get('hk') || (current ? String(current.semesterNo) : '');
  const choice = choices.find((c) => String(c.semesterNo) === hk) || null;
  const rows = yearWeeks(yearPlan);
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id) || null;
  const allThemes = [...yearPlan.themes].filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  const themeIds = choice ? choice.themeIds : null;
  const themes = themeIds ? allThemes.filter((t) => themeIds.includes(String(t.id))) : allThemes;
  const viewer = !canComposeClassDocs;
  const dayUrl = (ws) => `/education/day-plans/${classId}?week=${ws}`;
  const toggle = (id) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Thu gọn tất cả / Mở rộng tất cả: bên trái hàng nút, dùng chung mọi trang (Tiền 12/11/2026)
  const foldAll = themes.length > 0 && <FoldAllButton />;
  return (
    <div className="page ga-page">
      {head(
        choices.length > 0 && (
          <FilterSelect
            label="Học kỳ"
            value={hk}
            onChange={(key) => setParams({ hk: key }, { replace: true })}
            options={choices.map((c) => ({ value: String(c.semesterNo), label: `Học kỳ ${c.semesterNo} (${c.themeIds.length})` }))}
          />
        ),
        foldAll,
      )}
      {themes.length === 0 && <EmptyCard title="Chưa có chủ đề trong học kỳ" />}
      {themes.map((t) => {
        const ti = allThemes.indexOf(t);
        const dossier = themeDossiers.find((d) => d.id === `ds_${classId}_${t.id}`) || null;
        const groups = themeBranchGroups(yearPlan, branch, t.id);
        const branchOf = (ws) => groups.find((g) => g.weeks.some((w) => w.start === ws));
        const themeRows = rows.filter((r) => r.theme.id === t.id);
        const review = dossier ? docReview('theme', dossier, ctx, user, eduConfig) : null;
        const act = async (action, note, _saved, extra) => {
          const out = await actOnClassDoc('dossier', dossier.id, { action, note, ...extra }, user, {
            version: dossier.version,
            onError: (err) => setSendErr((m) => ({ ...m, [t.id]: (err.details?.details || []).filter(Boolean) })),
          });
          if (out) setSendErr((m) => ({ ...m, [t.id]: [] }));
          return out;
        };
        const errs = sendErr[t.id] || [];
        const emptyErrs = errs.filter((x) => x.section && x.date);
        const goalErrs = errs.filter((x) => x.goalNo != null);
        const dayDoc = (ws) => dayPlans.find((d) => d.classId === classId && d.yearPlanId === yearPlan.id && d.weekStart === ws) || null;
        const savedWeek = (ws) => !!dayDoc(ws);
        // Người chỉ xem mà chủ đề chưa có kế hoạch ngày nào: ẩn cột Thao tác trống (Tiền 12/11/2026)
        const showActions = !viewer || themeRows.some((r) => r.type !== 'break' && savedWeek(r.start));
        return (
          <Card
            key={t.id}
            title={`Chủ đề ${ti + 1}: ${t.name}`}
            bodyClass={null}
            className="mt-16"
            collapsed={folded.has(t.id)}
            onToggle={() => toggle(t.id)}
            actions={
              <div className="row row--wrap row--middle gap-2">
                {/* Trạng thái riêng từng chủ đề: hồ sơ chủ đề (giáo án ngày) đã ban hành chưa */}
                {dossier ? (
                  <>
                    <EduStatusBadge status={dossier.status} doc={dossier} />
                    <DeadlineBadge doc={dossier} />
                  </>
                ) : (
                  <DocAvailabilityBadge status={viewer ? 'UNRELEASED' : 'NOT_DRAFTED'} />
                )}
                {review && (
                  <ReviewActions
                    name={`hồ sơ chủ đề ${t.name}`}
                    sendTo={review.sendTo}
                    sendLabel="Gửi duyệt"
                    can={review.can}
                    showSend={canComposeClassDocs && dossier.status === EDU_STATUS.DRAFT}
                    // Gói học kỳ chưa ban hành: không hiện dòng nhắc trên trang, bấm Gửi duyệt mới cảnh báo (Tiền 14/11/2026)
                    sendDisabledReason={BLOCKED_TEXT[dossier.blockedReason] || 'Chưa gửi được hồ sơ chủ đề này'}
                    onAct={act}
                    variant="btn--outline-primary"
                    menu={{}}
                  />
                )}
              </div>
            }
          >
            <div className="card__body">
              {goalErrs.length > 0 && (
                <p className="field__error" role="alert">
                  MT chưa được dạy ngày nào: {goalErrs.map((g) => `MT${g.goalNo}`).join(', ')}
                </p>
              )}
              {emptyErrs.length > 0 && (
                <p className="field__error" role="alert">
                  Còn {emptyErrs.length} mục chưa có nội dung:{' '}
                  {emptyErrs
                    .map(
                      (e) =>
                        `${ddmm(e.date)}: ${(DAY_SECTIONS.find((x) => x.key === e.section)?.label || e.section).replace(/^\d+\.\s*/, '')}`,
                    )
                    .join('; ')}
                  .
                </p>
              )}
              <DocTable className="ga-plan-table ga-goal-table ga-class-plan-table">
                <colgroup>
                  <col className="ga-col-main" />
                  <col className="ga-col-theme-time" />
                  {showActions && <col className="ga-col-theme-actions" />}
                </colgroup>
                <thead>
                  <tr>
                    <th>Nội dung</th>
                    <th>Thời gian</th>
                    {showActions && <th className="cell--actions ga-col-theme-actions">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {themeRows.map((r) => {
                    if (r.type === 'break')
                      return (
                        <tr key={`b-${r.start}`}>
                          <td colSpan={showActions ? 3 : 2}>
                            <div className="ga-goal-table__pad muted">
                              Nghỉ: {r.label || 'Đợt nghỉ'} ({ddmm(r.start)} → {ddmm(r.end)})
                            </div>
                          </td>
                        </tr>
                      );
                    const g = branchOf(r.start);
                    const name = g?.name?.trim();
                    const saved = dayDoc(r.start);
                    // Chữ thống nhất với trang chủ đề: chưa có ⇒ Soạn, sửa được ⇒ Chỉnh sửa, chỉ xem ⇒ Xem (Tiền 14/11/2026)
                    const canEdit = saved
                      ? saved.permissions
                        ? saved.permissions.canEdit
                        : canComposeClassDocs && isEditableStatus(dossier?.status || 'DRAFT')
                      : !viewer;
                    const [Icon, label] = !saved ? [Plus, 'Soạn'] : canEdit ? [Pencil, 'Chỉnh sửa'] : [Eye, 'Xem'];
                    return (
                      <tr key={r.start}>
                        <td>
                          <div className={`ga-goal-table__pad ${name ? 'fw-600' : 'muted'}`}>
                            Nhánh {g?.no || '—'}: {name || 'chưa đặt tên'}
                          </div>
                        </td>
                        <td className="cell--fixed">
                          <div className="ga-goal-table__pad">
                            Tuần {r.no}: {ddmm(r.start)} → {ddmm(r.end)}
                          </div>
                        </td>
                        {showActions && (
                          <td className="center cell--actions">
                            <div className="ga-goal-table__pad">
                              {(saved || !viewer) && (
                                <Link className="btn btn--outline-primary btn--sm" to={dayUrl(r.start)}>
                                  <Icon size={16} aria-hidden /> {label}
                                </Link>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </DocTable>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
