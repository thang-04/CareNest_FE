import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle, Copy } from '@/components/ui/icons';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { DataTable } from '@/components/ui/DataTable';
import { Card, EduStatusBadge, Notice } from '@/components/education-plan/eduUi';
import { docReview, useClassPlanContext } from '@/components/education-plan/planUi';
import { ReviewActions } from '@/components/education-plan/reviewUi';
import { DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { numberGoals } from '@/models/education-plan/goalTable';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { classPlanVersionPath } from '@/models/education-plan/planVersions.mjs';
import { coverageOf, ddmm, normalizeTheme, themeBranchGroups, themeGoalBlocks, yearWeeks } from '@/models/education-plan/classPlan';

const MISSING_LABEL = { branch: 'tên chủ đề nhánh', theme: 'kế hoạch chủ đề', week: 'kế hoạch tuần' };

/**
 * Tiến độ học kỳ ở đầu trang kế hoạch giáo dục chủ đề: gửi/duyệt gói học kỳ một lần (cùng đơn vị với trang danh sách),
 * và danh sách từng chủ đề, từng tuần với phần còn thiếu để làm theo thứ tự. Mục thiếu do BE trả (`pkg.missing`).
 */
export function SemesterProgress({ classId, themeId, weekStart = null }) {
  const { user, classThemePlans, weekPlans, semesterPackages, actOnClassDoc, eduConfig } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { yearPlan, canComposeClassDocs, branchPlan } = ctx;
  const [confirmRevise, setConfirmRevise] = useState(false);
  // Chỉ nêu phần còn thiếu chi tiết sau khi bấm Gửi duyệt (Tiền 11/11/2026); danh sách bên dưới luôn hiện trạng thái từng mục
  const [showMissing, setShowMissing] = useState(false);
  const [folded, setFolded] = useState(false);
  const pkg =
    semesterPackages.find(
      (p) => p.classId === classId && p.yearPlanId === yearPlan?.id && (p.themeIds || []).map(String).includes(String(themeId)),
    ) || null;
  if (!yearPlan || !pkg || pkg.unreleased) return null;

  const path = (to) => classPlanVersionPath(to, ctx.superseded ? yearPlan.id : null);
  const themeIds = (pkg.themeIds || []).map(String);
  const themes = yearPlan.themes
    .filter((t) => t.start && t.end && themeIds.includes(String(t.id)))
    .sort((a, b) => a.start.localeCompare(b.start));
  const allThemes = [...yearPlan.themes].filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  const numbers = numberGoals(yearPlan.domains);
  const rows = yearWeeks(yearPlan);
  const branch = branchPlan;
  const review = docReview('branch', pkg, ctx, user, eduConfig);
  const act = (action, note, _saved, extra) =>
    actOnClassDoc('semester', pkg.id, { action, note, ...extra }, user, { version: pkg.version });
  const docOfTheme = (id) => classThemePlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.themeId === id) || null;
  const docOfWeek = (start) =>
    weekPlans.find((w) => w.classId === classId && w.yearPlanId === yearPlan.id && w.weekStart === start) || null;

  // EDU-80 (FR-031): kế hoạch giáo dục chủ đề thiếu MT chỉ cảnh báo trong hộp gửi; học kỳ cuối do BE chặn (7397)
  const untaught = themes.flatMap((t) => {
    const gs = themeGoalBlocks(yearPlan.domains, numbers, t.id, docOfTheme(t.id)?.customTicks).flatMap((b) => b.goals);
    const weeksOfTheme = rows
      .filter((r) => r.type === 'week' && r.theme.id === t.id)
      .map((w) => ({ start: w.start, offDays: w.offDays, doc: docOfWeek(w.start) }));
    return coverageOf(
      gs,
      normalizeTheme(
        docOfTheme(t.id),
        gs.map((g) => g.id),
      ),
      weeksOfTheme,
    ).missing.map((g) => `MT${g.no}`);
  });

  const allMissing = pkg.status !== 'APPROVED' ? pkg.missing || [] : [];
  const themeNo = (id) => allThemes.findIndex((t) => String(t.id) === String(id)) + 1;
  const themeName = (id) => allThemes.find((t) => String(t.id) === String(id))?.name || 'Chủ đề';
  const missingOf = (id, start) =>
    allMissing.filter((m) => String(m.themeId) === String(id) && (start ? m.weekStart === start : !m.weekStart));
  const linkOfMissing = (m) =>
    m.weekStart ? path(`/education/class/${classId}/weeks/${m.weekStart}`) : path(`/education/class/${classId}/themes/${m.themeId}`);
  const labelOfMissing = (m) =>
    `Chủ đề ${themeNo(m.themeId)}: ${themeName(m.themeId)} › ${MISSING_LABEL[m.kind] || m.kind}${m.weekStart ? ` (tuần ${ddmm(m.weekStart)})` : ''}`;

  const Status = ({ missing, done }) =>
    missing.length > 0 ? (
      <span className="field__error nowrap">
        <AlertTriangle size={14} aria-hidden /> Thiếu {missing.map((m) => MISSING_LABEL[m.kind]).join(', ')}
      </span>
    ) : done ? (
      <span className="text-success text-sm nowrap">
        <CheckCircle2 size={14} aria-hidden /> Đã có nội dung
      </span>
    ) : (
      <span className="muted text-sm nowrap">
        <Circle size={14} aria-hidden /> Chưa soạn
      </span>
    );

  // Một dòng mỗi chủ đề (kế hoạch chủ đề) và mỗi nhánh/tuần của chủ đề, theo thứ tự làm
  const items = themes.flatMap((t) => [
    {
      key: `t-${t.id}`,
      head: true,
      here: String(t.id) === String(themeId) && !weekStart,
      to: path(`/education/class/${classId}/themes/${t.id}`),
      label: `Chủ đề ${themeNo(t.id)}: ${t.name} · Kế hoạch chủ đề`,
      time: `${ddmm(t.start)} → ${ddmm(t.end)}`,
      missing: missingOf(t.id),
      done: !!docOfTheme(t.id),
    },
    ...themeBranchGroups(yearPlan, branch, t.id).map((g) => {
      const first = g.weeks[0];
      const last = g.weeks[g.weeks.length - 1];
      return {
        key: `w-${t.id}-${first.start}`,
        muted: !g.name,
        here: g.weeks.some((w) => w.start === weekStart),
        to: path(`/education/class/${classId}/weeks/${first.start}`),
        label: `Kế hoạch tuần · nhánh ${g.no}: ${g.name || 'chưa đặt tên'}`,
        time: `Tuần ${g.weeks.map((w) => w.no).join('+')}: ${ddmm(first.start)} → ${ddmm(last.end)}`,
        missing: g.weeks.flatMap((w) => missingOf(t.id, w.start)),
        done: g.weeks.every((w) => !!docOfWeek(w.start)),
      };
    }),
  ]);

  return (
    <>
      <Card
        title={`Học kỳ ${pkg.semesterNo}: ${themes.length} chủ đề`}
        bodyClass={null}
        className="mb-16"
        collapsed={folded}
        onToggle={() => setFolded((f) => !f)}
        actions={
          <div className="row row--wrap row--middle gap-2">
            <EduStatusBadge status={pkg.status} doc={pkg} />
            <DeadlineBadge doc={pkg} />
            {allMissing.length > 0 && <span className="field__error text-sm nowrap">Còn thiếu {allMissing.length} mục</span>}
            <ReviewActions
              name={`học kỳ ${pkg.semesterNo}`}
              sendTo={review.sendTo}
              sendLabel={`Gửi duyệt học kỳ ${pkg.semesterNo}`}
              can={review.can}
              approveLabel={review.approveLabel}
              approveAction={review.approveAction}
              beforeOpen={(next) => {
                if (next !== 'submit' || !allMissing.length) return true;
                setShowMissing(true);
                return false;
              }}
              showSend={
                !review.principalPublish &&
                (!!pkg.permissions?.canEdit || !!pkg.permissions?.canSubmit || (canComposeClassDocs && pkg.status === 'DRAFT'))
              }
              notes={untaught.length ? { submit: `MT chưa được dạy ngày nào: ${[...new Set(untaught)].join(', ')}.` } : {}}
              onAct={act}
              variant="btn--outline-primary"
              menu={{
                after: pkg.canRevise ? [{ label: 'Tạo phiên bản điều chỉnh', icon: Copy, onClick: () => setConfirmRevise(true) }] : [],
              }}
            />
          </div>
        }
      >
        <div className="card__body">
          <div className="stack">
            {pkg.status === 'REVIEW' && submitEntryOf(pkg)?.note && (
              <Notice tone="info">{`Ghi chú khi gửi (${submitEntryOf(pkg).by || '—'}): ${submitEntryOf(pkg).note}`}</Notice>
            )}
            {pkg.timeLocked && pkg.status === 'APPROVED' && canComposeClassDocs && (
              <Notice tone="info">Học kỳ đã bắt đầu, không điều chỉnh được nữa.</Notice>
            )}
            {showMissing && allMissing.length > 0 && (
              <div className="ga-plan-error-summary field__error" role="alert">
                <p>Chưa gửi duyệt được: còn thiếu {allMissing.length} mục. Bấm vào từng mục để mở đúng chỗ cần làm.</p>
                {allMissing.map((m) => (
                  <div key={`${m.kind}-${m.themeId}-${m.weekStart || ''}`}>
                    <Link to={linkOfMissing(m)}>{labelOfMissing(m)}</Link>
                  </div>
                ))}
              </div>
            )}
            <DataTable
              className="ga-plan-table ga-class-plan-table"
              rowKey="key"
              rows={items}
              columns={[
                {
                  key: 'what',
                  header: 'Nội dung',
                  render: (r) => (
                    <div className={r.head ? 'fw-600' : r.muted ? 'muted' : undefined} aria-current={r.here ? 'page' : undefined}>
                      <Link to={r.to}>{r.label}</Link>
                    </div>
                  ),
                },
                { key: 'time', header: 'Thời gian', className: 'nowrap', render: (r) => r.time },
                { key: 'status', header: 'Tình trạng', render: (r) => <Status missing={r.missing} done={r.done} /> },
              ]}
            />
          </div>
        </div>
      </Card>
      <ConfirmationModal
        open={confirmRevise}
        title={`Tạo phiên bản điều chỉnh học kỳ ${pkg.semesterNo}?`}
        message="Bản đã ban hành vẫn hiệu lực tới khi phiên bản mới được duyệt."
        confirmLabel="Tạo phiên bản"
        onConfirm={async () => {
          setConfirmRevise(false);
          await act('revise');
        }}
        onClose={() => setConfirmRevise(false)}
      />
    </>
  );
}
