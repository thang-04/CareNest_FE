import { Link, useParams } from 'react-router-dom';
import { Card, EduStatusBadge, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { docReview, useClassPlanContext } from '@/components/education-plan/planUi';
import { RejectedNotice, ReviewActions, ReviewHistory } from '@/components/education-plan/reviewUi';
import { BlockedNotice, DeadlineBadge, ExtendDeadlineButton } from '@/components/education-plan/DeadlineWidgets';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { ddmm, yearWeeks } from '@/models/education-plan/classPlan';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';

/**
 * Gói học kỳ của lớp (spec 003): lịch chủ đề nhánh của học kỳ + kế hoạch chủ đề/tuần của các chủ đề chọn "theo học kỳ";
 * gửi/duyệt một lần, hạn là ngày bắt đầu học kỳ. Trạng thái, hạn, quyền do BE trả.
 */
export default function SemesterPackagePage() {
  const { classId, no } = useParams();
  const { user, semesterPackages, classThemePlans, semesterConfigMissing, actOnClassDoc, eduConfig } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan } = ctx;
  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan) return <StatusPage kind="404" title="Không tìm thấy kế hoạch năm đã ban hành của lớp" />;
  const pkg = semesterPackages.find((p) => p.classId === classId && p.yearPlanId === yearPlan.id && String(p.semesterNo) === no);
  const base = `/education/class/${classId}`;
  const title = `Gói học kỳ ${no}`;
  const crumbs = [{ label: 'Kế hoạch giáo dục' }, { label: `Kế hoạch ${cls.name}`, to: base }, { label: title }];
  if (!pkg) {
    return (
      <div className="page ga-page">
        <PageHead crumbs={crumbs} title={title} desc={cls.name} />
        <Notice tone="warn">
          {semesterConfigMissing
            ? 'Năm học chưa cấu hình học kỳ. Hiệu trưởng đặt ngày học kỳ ở Cấu hình trường › Năm học.'
            : 'Chưa có gói học kỳ. Lưu lịch chủ đề nhánh của lớp trước.'}
        </Notice>
      </div>
    );
  }
  const themeIds = (pkg.themeIds || []).map(String);
  const weeks = yearWeeks(yearPlan).filter((w) => w.type === 'week' && themeIds.includes(String(w.theme.id)));
  const names = pkg.branchNames || {};
  const bySemester = classThemePlans.filter(
    (t) => t.classId === classId && themeIds.includes(String(t.themeId)) && t.submitMode === 'SEMESTER',
  );
  const review = docReview('branch', pkg, ctx, user, eduConfig);
  const act = (action, note, _saved, extra) =>
    actOnClassDoc('semester', pkg.id, { action, note, ...extra }, user, { version: pkg.version });

  return (
    <div className="page ga-page ga-class-editor">
      <div className="ga-sticky-head">
        <PageHead crumbs={crumbs} title={title} desc={cls.name} />
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác gói học kỳ">
          <div className="ga-year-toolbar__group">
            <EduStatusBadge status={pkg.status} doc={pkg} />
            <DeadlineBadge doc={pkg} />
          </div>
          <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
            <ReviewActions
              name="gói học kỳ"
              sendTo={review.sendTo}
              can={review.can}
              showSend={!!pkg.permissions?.canEdit || !!pkg.permissions?.canSubmit}
              notes={{
                submit: `Gửi lịch chủ đề nhánh học kỳ ${no} và ${bySemester.length} chủ đề gửi theo học kỳ. Gói bị khóa tới khi được duyệt hoặc bị trả lại.`,
                approve: 'Duyệt cả gói học kỳ.',
                reject: 'Trả lại để giáo viên sửa rồi gửi lại.',
              }}
              onAct={act}
              variant="btn--outline-primary"
            />
            <ExtendDeadlineButton doc={pkg} onExtend={(body) => act('extend', body.note, null, { deadline: body.deadline })} />
          </div>
        </div>
      </div>
      <RejectedNotice status={pkg.status} history={pkg.history} />
      <BlockedNotice doc={pkg} author={ctx.canComposeClassDocs} />
      {pkg.status === 'REVIEW' && submitEntryOf(pkg)?.note && (
        <Notice>{`Ghi chú khi gửi (${submitEntryOf(pkg).by || '—'}): ${submitEntryOf(pkg).note}`}</Notice>
      )}
      <Card title="Lịch chủ đề nhánh của học kỳ" bodyClass={null}>
        <div className="card__body">
          {weeks.length ? (
            <ul className="ga-theme-weeks">
              {weeks.map((w) => (
                <li key={w.start}>
                  <span>
                    Tuần {w.no} · {w.theme.name}: {names[w.start] || <span className="muted">chưa đặt tên nhánh</span>}
                  </span>
                  <span className="muted text-sm">
                    {ddmm(w.start)} → {ddmm(w.end)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="muted">Học kỳ chưa có tuần học.</span>
          )}
          {ctx.canComposeClassDocs && (
            <p className="mt-16">
              <Link to={`/education/branches/${classId}`}>Sửa lịch chủ đề nhánh</Link>
            </p>
          )}
        </div>
      </Card>
      <Card title="Chủ đề gửi theo học kỳ" className="mt-16">
        {bySemester.length ? (
          <ul className="stack">
            {bySemester.map((t) => (
              <li key={t.id}>
                <Link to={`${base}/themes/${t.themeId}`}>
                  {yearPlan.themes.find((x) => String(x.id) === String(t.themeId))?.name || 'Chủ đề'}
                </Link>{' '}
                <span className="muted text-sm">kế hoạch chủ đề và kế hoạch tuần</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted">
            Chưa có chủ đề nào gửi theo học kỳ. Mặc định kế hoạch chủ đề và kế hoạch tuần gửi cùng hồ sơ chủ đề.
          </span>
        )}
      </Card>
      {pkg.history?.length > 0 && <ReviewHistory items={pkg.history} open />}
      {pkg.releases?.length > 0 && (
        <Card title="Các bản đã ban hành" className="mt-16">
          <ul className="stack">
            {pkg.releases.map((r, i) => (
              <li key={r.id}>
                Bản ban hành {i + 1}{' '}
                <span className="muted text-sm">
                  {fmtDate(r.releasedAt)}
                  {r.approvedBy ? ` · ${r.approvedBy}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
