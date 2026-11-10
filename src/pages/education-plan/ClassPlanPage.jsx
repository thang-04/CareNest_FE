import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, DocAvailabilityBadge, EduStatusBadge, EmptyState, Notice, PageHead, YearPlanStatusBadge } from '@/components/education-plan/eduUi';
import { ClassPicker, docReview, useClassPlanContext } from '@/components/education-plan/planUi';
import { RejectedNotice, ReviewActions, ReviewHistory } from '@/components/education-plan/reviewUi';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { BlockedNotice, DeadlineBadge, ExtendDeadlineButton } from '@/components/education-plan/DeadlineWidgets';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Copy, Eye, FileDown, Pencil, Plus } from '@/components/ui/icons';
import { themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { numberGoals } from '@/models/education-plan/goalTable';
import { leaderNameOf, themeFile } from '@/utils/education-plan/classPlanDoc';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { usePolling } from '@/hooks/usePolling';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { createBlocker, ddmm, isEditableStatus, themeGoalBlocks, todayIso, yearWeeks } from '@/models/education-plan/classPlan';

/** /education/theme-plans, /education/branches: mở lớp đầu tiên người dùng được xem (lớp mình dạy trước). */
export function ClassPlanRedirect({ toOf = (id) => `/education/theme-plans/${id}` }) {
  const { user, classes } = useEducationPlan();
  const own = classes.find((c) => (c.teacherIds || []).includes(user.id)) || classes[0];
  if (!own) return <EmptyState title="Bạn chưa được phân công lớp nào" />;
  return <Navigate to={toOf(own.id)} replace />;
}

/** Đường dẫn cũ /education/class/:classId ⇒ trang Kế hoạch giáo dục chủ đề. */
export function ClassPlanLegacyRedirect() {
  const { classId, no } = useParams();
  return <Navigate to={`/education/theme-plans/${classId}${no ? `?hk=${no}` : ''}`} replace />;
}

const MISSING_LABEL = { branch: 'tên chủ đề nhánh', theme: 'kế hoạch chủ đề', week: 'kế hoạch tuần' };

/**
 * Kế hoạch giáo dục chủ đề (spec 004): lọc theo học kỳ; gói học kỳ = lịch nhánh + kế hoạch chủ đề + kế hoạch tuần của mọi
 * chủ đề trong kỳ, gửi/duyệt một lần ở đầu trang. Giáo án ngày ở trang Kế hoạch giáo dục ngày. Quy tắc, quyền do BE trả.
 */
export default function ClassPlanPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, branchPlans, classThemePlans, weekPlans, semesterPackages, semesterConfigMissing, staff, actOnClassDoc, eduConfig, refreshClassDocs } =
    useEducationPlan();
  const [preview, setPreview] = useState(null);
  const [confirmRevise, setConfirmRevise] = useState(false);
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan, branchPlan, pendingYearPlan, teachers, canComposeClassDocs } = ctx;
  // Người khác gửi/duyệt/trả lại học kỳ thì trang tự cập nhật
  usePolling(() => refreshClassDocs?.().catch(() => {}));

  if (ctx.loading) return <LoadingState />;
  if (!cls) return <StatusPage kind="404" title="Không tìm thấy lớp hoặc bạn không có quyền xem" />;

  const base = `/education/class/${classId}`;
  const group = AGE_GROUPS.find((a) => a.id === cls.ageGroupId);
  const head = (
    <PageHead
      crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục chủ đề' }]}
      title={`Kế hoạch giáo dục chủ đề ${cls.name}`}
      desc={`${group?.name || ''} · Giáo viên: ${teachers.map((t) => t.fullName).join(', ') || 'chưa phân công'}`}
      actions={
        ctx.canPickClass && (
          <ClassPicker classes={classes} classId={classId} onPick={(id) => navigate(`/education/theme-plans/${id}`)} />
        )
      }
    />
  );

  if (!yearPlan) {
    return (
      <div className="page ga-page">
        {head}
        <Notice tone="warn">
          Kế hoạch giáo dục tổ của khối {group?.name} chưa được ban hành.
          {pendingYearPlan && (
            <>
              {' '}
              Trạng thái hiện tại: <YearPlanStatusBadge status={pendingYearPlan.status} doc={pendingYearPlan} />
            </>
          )}
        </Notice>
      </div>
    );
  }

  const packages = semesterPackages
    .filter((p) => p.classId === classId && p.yearPlanId === yearPlan.id)
    .sort((a, b) => a.semesterNo - b.semesterNo);
  // Mặc định học kỳ đang diễn ra (hạn = ngày bắt đầu học kỳ đã tới), chưa vào năm học thì học kỳ 1
  const today = todayIso();
  const current = [...packages].reverse().find((p) => p.deadline && p.deadline <= today) || packages[0];
  const hk = params.get('hk') || (current ? String(current.semesterNo) : '');
  const pkg = packages.find((p) => String(p.semesterNo) === hk) || null;
  const rows = yearWeeks(yearPlan);
  const branch = branchPlan;
  const allThemes = [...yearPlan.themes].filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  const themeIds = pkg ? (pkg.themeIds || []).map(String) : null;
  const themes = themeIds ? allThemes.filter((t) => themeIds.includes(String(t.id))) : allThemes;
  const numbers = numberGoals(yearPlan.domains);
  const exportTheme = (t, themeNo, doc, themeWeeks) =>
    setPreview(
      themeFile({
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
            doc: weekPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start),
          }))
          .filter((w) => w.doc),
        leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear),
      }),
    );
  const status = (doc, noneStatus) =>
    doc ? <EduStatusBadge status={doc.status} doc={doc} /> : <DocAvailabilityBadge status={noneStatus} />;
  const lockOf = (kind, themeId) => createBlocker(kind, { classId, yearPlanId: yearPlan.id, themeId }, { branchPlans, classThemePlans });
  // Một nút mỗi dòng: còn sửa được ⇒ Chỉnh sửa / Lập; còn lại ⇒ Xem (gửi, duyệt ở khối học kỳ phía trên)
  const action = (doc, to, create, name, kind) => {
    if (doc?.permissions ? doc.permissions.canEdit : doc ? canComposeClassDocs && isEditableStatus(doc.status) : ctx.canCreate(kind))
      return doc ? (
        <Link className="btn btn--outline-primary btn--sm" to={to} title={`Chỉnh sửa ${name}`}>
          <Pencil size={16} aria-hidden /> Chỉnh sửa
        </Link>
      ) : (
        <Link className="btn btn--outline-primary btn--sm" to={to}>
          <Plus size={16} aria-hidden /> {create}
        </Link>
      );
    if (!doc) return <span className="muted text-sm nowrap">Chưa lập</span>;
    return (
      <Link className="btn btn--outline-primary btn--sm" to={to} title={`Xem ${name}`}>
        <Eye size={16} aria-hidden /> Xem
      </Link>
    );
  };
  const review = pkg ? docReview('branch', pkg, ctx, user, eduConfig) : null;
  const act = (action, note, _saved, extra) =>
    actOnClassDoc('semester', pkg.id, { action, note, ...extra }, user, { version: pkg.version });
  const missing = pkg?.missing || [];
  const themeName = (id) => allThemes.find((t) => String(t.id) === String(id))?.name || 'Chủ đề';

  return (
    <div className="page ga-page">
      {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
      {head}
      {semesterConfigMissing && (
        <Notice tone="warn">
          Năm học chưa cấu hình học kỳ.
        </Notice>
      )}
      {packages.length > 0 && (
        <Tabs
          ariaLabel="Học kỳ"
          value={hk}
          onChange={(key) => setParams({ hk: key }, { replace: true })}
          items={packages.map((p) => ({ key: String(p.semesterNo), label: `Học kỳ ${p.semesterNo}`, count: (p.themeIds || []).length }))}
        />
      )}
      {pkg && (
        <Card
          title={`Học kỳ ${pkg.semesterNo}`}
          className="mt-16"
          actions={
            <span className="row row--wrap row--middle gap-2">
              <EduStatusBadge status={pkg.status} doc={pkg} />
              <DeadlineBadge doc={pkg} />
            </span>
          }
        >
          <div className="stack">
            <RejectedNotice status={pkg.status} history={pkg.history} />
            {pkg.status === 'REVIEW' && submitEntryOf(pkg)?.note && (
              <Notice>{`Ghi chú khi gửi (${submitEntryOf(pkg).by || '—'}): ${submitEntryOf(pkg).note}`}</Notice>
            )}
            <BlockedNotice doc={pkg} author={canComposeClassDocs} />
            {pkg.timeLocked && pkg.status === 'APPROVED' && canComposeClassDocs && (
              <Notice tone="warn">Học kỳ đã bắt đầu. Cần Hiệu trưởng hoặc Phó hiệu trưởng mở khóa để điều chỉnh.</Notice>
            )}
            {missing.length > 0 && pkg.status !== 'APPROVED' && (
              <details>
                <summary>
                  Còn thiếu {missing.length} mục trước khi gửi:{' '}
                  {Object.entries(MISSING_LABEL)
                    .map(([kind, label]) => [missing.filter((m) => m.kind === kind).length, label])
                    .filter(([n]) => n > 0)
                    .map(([n, label]) => `${n} ${label}`)
                    .join(', ')}
                </summary>
                <ul className="stack mt-8">
                  {missing.map((m) => (
                    <li key={`${m.kind}-${m.themeId}-${m.weekStart || ''}`}>
                      {MISSING_LABEL[m.kind]} · {themeName(m.themeId)}
                      {m.weekStart ? ` · tuần ${ddmm(m.weekStart)}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="row row--wrap gap-2">
              <ReviewActions
                name={`học kỳ ${pkg.semesterNo}`}
                sendTo={review.sendTo}
                sendLabel={`Gửi duyệt học kỳ ${pkg.semesterNo}`}
                can={{ ...review.can, send: review.can.send && missing.length === 0 }}
                sendDisabledReason={missing.length ? 'Soạn đủ các mục còn thiếu trước khi gửi' : undefined}
                showSend={!!pkg.permissions?.canEdit || !!pkg.permissions?.canSubmit || (canComposeClassDocs && pkg.status === 'DRAFT')}
                onAct={act}
                variant="btn--outline-primary"
              />
              {pkg.canRevise && (
                <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setConfirmRevise(true)}>
                  <Copy size={16} aria-hidden /> Tạo phiên bản điều chỉnh
                </button>
              )}
              <ExtendDeadlineButton doc={pkg} onExtend={(body) => act('extend', body.note, null, { deadline: body.deadline })} />
            </div>
          </div>
        </Card>
      )}
      {pkg?.history?.length > 0 && <ReviewHistory items={pkg.history} />}
      {themes.length === 0 && (
        <EmptyState title="Học kỳ chưa có chủ đề" />
      )}
      {themes.map((t) => {
        const ti = allThemes.indexOf(t);
        const doc = classThemePlans.find((x) => x.classId === classId && x.themeId === t.id) || null;
        const themeRows = rows.filter((r) => r.theme.id === t.id);
        const themeWeeks = themeRows.filter((r) => r.type === 'week');
        const to = `${base}/themes/${t.id}`;
        const weekLock = lockOf('week', t.id);
        return (
          <Card
            key={t.id}
            title={`Chủ đề ${ti + 1}: ${t.name}`}
            bodyClass={null}
            className="mt-16"
            actions={
              <div className="row row--wrap row--middle gap-2">
                <span className="muted text-sm nowrap">
                  {ddmm(t.start)} → {ddmm(t.end)} · {themeWeeks.length} tuần
                </span>
                <button type="button" className="btn btn--outline-primary btn--sm nowrap" onClick={() => exportTheme(t, ti + 1, doc, themeWeeks)}>
                  <FileDown size={16} aria-hidden /> Xuất file
                </button>
              </div>
            }
          >
            <div className="card__body">
              <div className="table-wrap">
                <table className="table ga-plan-table ga-goal-table ga-class-plan-table">
                  <colgroup>
                    <col className="ga-col-main" />
                    <col className="ga-col-theme-time" />
                    <col className="ga-col-theme-status" />
                    <col className="ga-col-theme-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Nội dung</th>
                      <th>Thời gian</th>
                      <th className="center ga-col-theme-status">Trạng thái</th>
                      <th className="cell--actions ga-col-theme-actions">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className="ga-goal-table__pad fw-600">Kế hoạch giáo dục chủ đề</div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">
                          {ddmm(t.start)} → {ddmm(t.end)}
                        </div>
                      </td>
                      <td className="center ga-theme-status-cell">
                        <div className="ga-goal-table__pad">{status(doc, 'NOT_PLANNED')}</div>
                      </td>
                      <td className="center cell--actions">
                        <div className="ga-goal-table__pad">{action(doc, to, 'Lập', `kế hoạch chủ đề ${t.name}`, 'theme')}</div>
                      </td>
                    </tr>
                    {themeRows.map((r) => {
                      if (r.type === 'break')
                        return (
                          <tr key={`b-${r.start}`}>
                            <td colSpan={4}>
                              <div className="ga-goal-table__pad muted">
                                Nghỉ: {r.label || 'Đợt nghỉ'} ({ddmm(r.start)} → {ddmm(r.end)})
                              </div>
                            </td>
                          </tr>
                        );
                      const wdoc = weekPlans.find((w) => w.classId === classId && w.yearPlanId === yearPlan.id && w.weekStart === r.start) || null;
                      const name = branch?.names?.[r.start]?.trim();
                      const lock = !wdoc && weekLock;
                      return (
                        <tr key={r.start}>
                          <td>
                            <div className="ga-goal-table__pad">
                              <div className={name ? 'fw-600' : 'muted'}>
                                Kế hoạch tuần · nhánh {themeWeeks.indexOf(r) + 1}: {name || 'chưa đặt tên'}
                              </div>
                            </div>
                          </td>
                          <td className="cell--fixed">
                            <div className="ga-goal-table__pad">
                              Tuần {r.no}: {ddmm(r.start)} → {ddmm(r.end)}
                            </div>
                          </td>
                          <td className="center ga-theme-status-cell">
                            <div className="ga-goal-table__pad" title={lock ? lock.message : undefined}>
                              {lock ? <DocAvailabilityBadge status="LOCKED" /> : status(wdoc, 'NOT_DRAFTED')}
                            </div>
                          </td>
                          <td className="center cell--actions">
                            <div className="ga-goal-table__pad">
                              {!lock && action(wdoc, `${base}/weeks/${r.start}`, 'Tạo', `kế hoạch tuần ${r.no}`, 'week')}
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
      <ConfirmationModal
        open={confirmRevise}
        title={`Tạo phiên bản điều chỉnh học kỳ ${pkg?.semesterNo || ''}?`}
        message="Bản đã ban hành vẫn hiệu lực tới khi phiên bản mới được duyệt."
        confirmLabel="Tạo phiên bản"
        onConfirm={async () => {
          setConfirmRevise(false);
          await act('revise');
        }}
        onClose={() => setConfirmRevise(false)}
      />
    </div>
  );
}
