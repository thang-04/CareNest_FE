import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Card,
  DocAvailabilityBadge,
  EduStatusBadge,
  EmptyState,
  FoldAllButton,
  Notice,
  PageHead,
  YearPlanStatusBadge,
} from '@/components/education-plan/eduUi';
import { ClassFilterBar, ClassPageEmpty, docReview, useClassPlanContext } from '@/components/education-plan/planUi';
import { RejectedNotice, ReviewActions, ReviewHistory } from '@/components/education-plan/reviewUi';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { BlockedNotice, DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { LoadingState } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Copy, Eye, FileDown, Pencil, Plus } from '@/components/ui/icons';
import { themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { numberGoals } from '@/models/education-plan/goalTable';
import { leaderNameOf, themeFile } from '@/utils/education-plan/classPlanDoc';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { usePolling } from '@/hooks/usePolling';
import {
  coverageOf,
  createBlocker,
  ddmm,
  isEditableStatus,
  normalizeTheme,
  themeGoalBlocks,
  todayIso,
  yearWeeks,
} from '@/models/education-plan/classPlan';

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
  const {
    user,
    branchPlans,
    classThemePlans,
    weekPlans,
    semesterPackages,
    semesterConfigMissing,
    staff,
    actOnClassDoc,
    eduConfig,
    refreshClassDocs,
  } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const [confirmRevise, setConfirmRevise] = useState(false);
  // Điều kiện còn thiếu chỉ hiện (chữ đỏ) sau khi bấm Gửi duyệt (Tiền 11/11/2026)
  const [showMissing, setShowMissing] = useState(false);
  // Thẻ đang thu gọn: 'hk' = khối học kỳ, còn lại là id chủ đề
  const [folded, setFolded] = useState(() => new Set());
  const toggleFold = (key) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan, branchPlan, pendingYearPlan, canComposeClassDocs } = ctx;
  // Người khác gửi/duyệt/trả lại học kỳ thì trang tự cập nhật
  usePolling(() => refreshClassDocs?.().catch(() => {}));

  if (ctx.loading) return <LoadingState />;
  if (!cls)
    return (
      <ClassPageEmpty
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục chủ đề' }]}
        title="Kế hoạch giáo dục chủ đề"
        classes={classes}
        classId={classId}
        onPick={(id) => navigate(`/education/theme-plans/${id}`)}
        emptyTitle="Không tìm thấy lớp"
        emptyDesc="Chọn nhóm tuổi và lớp ở hàng lọc phía trên."
      />
    );

  const base = `/education/class/${classId}`;
  // Khung chung các trang kế hoạch giáo dục (Tiền 12/11/2026): đường dẫn → hàng lọc → tab học kỳ → hàng nút (chỉ hàng nút dính)
  const headOf = (extra, tabs = null, toolbar = null) => (
    <div className="ga-sticky-head">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục chủ đề' }]}
        title={`Kế hoạch giáo dục chủ đề ${cls.name}`}
      />
      <ClassFilterBar
        classes={classes}
        classId={classId}
        canPick={ctx.canPickClass}
        onPick={(id) => navigate(`/education/theme-plans/${id}`)}
      >
        {extra}
      </ClassFilterBar>
      {tabs && <div className="mb-16">{tabs}</div>}
      {toolbar}
    </div>
  );
  const head = headOf(null);

  if (!yearPlan) {
    return (
      <div className="page ga-page">
        {head}
        {canComposeClassDocs && pendingYearPlan && (
          <Notice>
            Trạng thái kế hoạch giáo dục tổ: <YearPlanStatusBadge status={pendingYearPlan.status} doc={pendingYearPlan} />
          </Notice>
        )}
        <EmptyState title="Kế hoạch giáo dục tổ của nhóm tuổi này chưa được ban hành" />
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
  const themeArgs = (t, themeNo, doc, themeWeeks) => ({
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
  });
  const exportTheme = (t, themeNo, doc, themeWeeks) => setPreview(themeFile(themeArgs(t, themeNo, doc, themeWeeks)));
  // Người chỉ xem (không soạn được hồ sơ lớp): thấy khung trang, phần chưa ban hành chỉ một nhãn "Chưa ban hành", không nút Xem
  const viewer = !canComposeClassDocs;
  const status = (doc, noneStatus) =>
    doc ? <EduStatusBadge status={doc.status} doc={doc} /> : <DocAvailabilityBadge status={viewer ? 'UNRELEASED' : noneStatus} />;
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
    if (!doc) return viewer ? null : <span className="muted text-sm nowrap">Chưa lập</span>;
    return (
      <Link className="btn btn--outline-primary btn--sm" to={to} title={`Xem ${name}`}>
        <Eye size={16} aria-hidden /> Xem
      </Link>
    );
  };
  const review = pkg ? docReview('branch', pkg, ctx, user, eduConfig) : null;
  const act = (action, note, _saved, extra) =>
    actOnClassDoc('semester', pkg.id, { action, note, ...extra }, user, { version: pkg.version });
  // EDU-80 (FR-031): gói học kỳ thiếu MT chỉ cảnh báo trong hộp gửi; học kỳ cuối do BE chặn (7397)
  const untaught = themes.flatMap((t) => {
    const doc = classThemePlans.find((x) => x.classId === classId && x.themeId === t.id) || null;
    const gs = themeGoalBlocks(yearPlan.domains, numbers, t.id, doc?.customTicks).flatMap((b) => b.goals);
    const weeksOfTheme = rows
      .filter((r) => r.type === 'week' && r.theme.id === t.id)
      .map((w) => ({
        start: w.start,
        offDays: w.offDays,
        doc: weekPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start),
      }));
    return coverageOf(
      gs,
      normalizeTheme(
        doc,
        gs.map((g) => g.id),
      ),
      weeksOfTheme,
    ).missing.map((g) => `MT${g.no}`);
  });
  const allMissing = pkg && pkg.status !== 'APPROVED' ? pkg.missing || [] : [];
  const missing = showMissing ? allMissing : [];
  const themeName = (id) => allThemes.find((t) => String(t.id) === String(id))?.name || 'Chủ đề';
  // Mục thiếu ghi chữ đỏ ngay ở dòng tương ứng (FR-023); mục không có dòng trên trang thì nêu ở dòng tổng
  const missingAt = (themeId, weekStart) =>
    missing.filter((m) => String(m.themeId) === String(themeId) && (weekStart ? m.weekStart === weekStart : !m.weekStart));
  const shownThemes = new Set(themes.map((t) => String(t.id)));
  const orphan = missing.filter((m) => !shownThemes.has(String(m.themeId)));
  const MissingNote = ({ items }) =>
    items.length > 0 && <p className="field__error">Thiếu {items.map((m) => MISSING_LABEL[m.kind]).join(', ')}</p>;

  // Thu gọn tất cả / Mở rộng tất cả: nút phụ bên trái hàng nút, dùng chung mọi trang (Tiền 12/11/2026)
  const foldAll = themes.length > 0 && <FoldAllButton />;
  return (
    <div className="page ga-page">
      {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
      {headOf(
        null,
        packages.length > 0 && (
          <Tabs
            ariaLabel="Học kỳ"
            value={hk}
            onChange={(key) => setParams({ hk: key }, { replace: true })}
            items={packages.map((p) => ({ key: String(p.semesterNo), label: `Học kỳ ${p.semesterNo}`, count: (p.themeIds || []).length }))}
          />
        ),
        (pkg || foldAll) && (
          <div className="ga-year-toolbar" role="group" aria-label={pkg ? `Trạng thái và thao tác học kỳ ${pkg.semesterNo}` : 'Thao tác'}>
            <div className="ga-year-toolbar__group">
              <span className="ga-year-toolbar__title">{cls.name}</span>
              {pkg?.unreleased ? (
                <DocAvailabilityBadge status="UNRELEASED" />
              ) : (
                pkg && (
                  <>
                    <EduStatusBadge status={pkg.status} doc={pkg} />
                    <DeadlineBadge doc={pkg} />
                  </>
                )
              )}
              {foldAll}
            </div>
            <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
              {pkg && !pkg.unreleased && (
                <>
                  <ReviewActions
                    name={`học kỳ ${pkg.semesterNo}`}
                    sendTo={review.sendTo}
                    sendLabel={`Gửi duyệt học kỳ ${pkg.semesterNo}`}
                    can={review.can}
                    beforeOpen={(next) => {
                      if (next !== 'submit' || !allMissing.length) return true;
                      setShowMissing(true);
                      return false;
                    }}
                    showSend={!!pkg.permissions?.canEdit || !!pkg.permissions?.canSubmit || (canComposeClassDocs && pkg.status === 'DRAFT')}
                    notes={untaught.length ? { submit: `MT chưa được dạy ngày nào: ${[...new Set(untaught)].join(', ')}.` } : {}}
                    onAct={act}
                    variant="btn--outline-primary"
                  />
                  {pkg.canRevise && (
                    <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setConfirmRevise(true)}>
                      <Copy size={16} aria-hidden /> Tạo phiên bản điều chỉnh
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ),
      )}
      {canComposeClassDocs && semesterConfigMissing && <Notice>Năm học chưa cấu hình học kỳ.</Notice>}
      {pkg && !pkg.unreleased && (
        <div className="stack">
          <RejectedNotice status={pkg.status} history={pkg.history} />
          {pkg.status === 'REVIEW' && submitEntryOf(pkg)?.note && (
            <Notice>{`Ghi chú khi gửi (${submitEntryOf(pkg).by || '—'}): ${submitEntryOf(pkg).note}`}</Notice>
          )}
          <BlockedNotice doc={pkg} author={canComposeClassDocs} />
          {pkg.timeLocked && pkg.status === 'APPROVED' && canComposeClassDocs && (
            <Notice>Học kỳ đã bắt đầu, không điều chỉnh được nữa.</Notice>
          )}
          {missing.length > 0 && (
            <p className="field__error" role="alert">
              Còn thiếu {missing.length} mục trước khi gửi:{' '}
              {Object.entries(MISSING_LABEL)
                .map(([kind, label]) => [missing.filter((m) => m.kind === kind).length, label])
                .filter(([n]) => n > 0)
                .map(([n, label]) => `${n} ${label}`)
                .join(', ')}
              {orphan.length > 0 &&
                ` (${orphan.map((m) => `${MISSING_LABEL[m.kind]} · ${themeName(m.themeId)}${m.weekStart ? ` · tuần ${ddmm(m.weekStart)}` : ''}`).join('; ')})`}
              .
            </p>
          )}
        </div>
      )}
      {themes.length === 0 && <EmptyState title="Học kỳ chưa có chủ đề" />}
      {themes.map((t) => {
        const ti = allThemes.indexOf(t);
        const doc = classThemePlans.find((x) => x.classId === classId && x.themeId === t.id) || null;
        const themeRows = rows.filter((r) => r.theme.id === t.id);
        const themeWeeks = themeRows.filter((r) => r.type === 'week');
        const to = `${base}/themes/${t.id}`;
        const weekLock = lockOf('week', t.id);
        const docOfWeek = (start) =>
          weekPlans.find((w) => w.classId === classId && w.yearPlanId === yearPlan.id && w.weekStart === start) || null;
        // Người chỉ xem mà chủ đề chưa có tài liệu nào: không có thao tác ⇒ ẩn cột Thao tác trống (Tiền 12/11/2026)
        const showActions = !viewer || !!doc || themeWeeks.some((r) => docOfWeek(r.start));
        return (
          <Card
            key={t.id}
            title={`Chủ đề ${ti + 1}: ${t.name}`}
            bodyClass={null}
            className="mt-16"
            collapsed={folded.has(t.id)}
            onToggle={() => toggleFold(t.id)}
            actions={
              <div className="row row--wrap row--middle gap-2">
                <span className="muted text-sm nowrap">
                  {ddmm(t.start)} → {ddmm(t.end)} · {themeWeeks.length} tuần
                </span>
                <button
                  type="button"
                  className="btn btn--outline-primary btn--sm nowrap"
                  onClick={() => exportTheme(t, ti + 1, doc, themeWeeks)}
                >
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
                    {showActions && <col className="ga-col-theme-actions" />}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Nội dung</th>
                      <th>Thời gian</th>
                      <th className="center ga-col-theme-status">Trạng thái</th>
                      {showActions && <th className="cell--actions ga-col-theme-actions">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className="ga-goal-table__pad">
                          <div className="fw-600">Kế hoạch giáo dục chủ đề</div>
                          <MissingNote items={missingAt(t.id)} />
                        </div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">
                          {ddmm(t.start)} → {ddmm(t.end)}
                        </div>
                      </td>
                      <td className="center ga-theme-status-cell">
                        <div className="ga-goal-table__pad">{status(doc, 'NOT_PLANNED')}</div>
                      </td>
                      {showActions && (
                        <td className="center cell--actions">
                          <div className="ga-goal-table__pad">{action(doc, to, 'Lập', `kế hoạch chủ đề ${t.name}`, 'theme')}</div>
                        </td>
                      )}
                    </tr>
                    {themeRows.map((r) => {
                      if (r.type === 'break')
                        return (
                          <tr key={`b-${r.start}`}>
                            <td colSpan={showActions ? 4 : 3}>
                              <div className="ga-goal-table__pad muted">
                                Nghỉ: {r.label || 'Đợt nghỉ'} ({ddmm(r.start)} → {ddmm(r.end)})
                              </div>
                            </td>
                          </tr>
                        );
                      const wdoc = docOfWeek(r.start);
                      const name = branch?.names?.[r.start]?.trim();
                      const lock = !wdoc && !viewer && weekLock;
                      return (
                        <tr key={r.start}>
                          <td>
                            <div className="ga-goal-table__pad">
                              <div className={name ? 'fw-600' : 'muted'}>
                                Kế hoạch tuần · nhánh {themeWeeks.indexOf(r) + 1}: {name || 'chưa đặt tên'}
                              </div>
                              <MissingNote items={missingAt(t.id, r.start)} />
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
                          {showActions && (
                            <td className="center cell--actions">
                              <div className="ga-goal-table__pad">
                                {!lock && action(wdoc, `${base}/weeks/${r.start}`, 'Tạo', `kế hoạch tuần ${r.no}`, 'week')}
                              </div>
                            </td>
                          )}
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
      {pkg?.history?.length > 0 && <ReviewHistory items={pkg.history} />}
    </div>
  );
}
