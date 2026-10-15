import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Eye, FileDown, PenLine, Plus, Printer } from '@/components/ui/icons';
import { Card, EduStatusBadge, EmptyState, Notice, PageHead, fmtDate, fmtDateTime } from '@/components/education-plan/eduUi';
import { SignPanel, WeekApproval, isMyReviewTurn, useClassPlanContext } from '@/components/education-plan/planUi';
import { ThemePlanBody, themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { DayTab, WeekTab } from '@/components/education-plan/WeekPlanBody';
import { LoadingState } from '@/components/ui/States';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { numberGoals } from '@/models/education-plan/goalTable';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { SIGN_ROLES, getEduConfig } from '@/models/education-plan/eduConfig';
import { ROLES } from '@/models/User';
import {
  dossierSummary,
  dossierWeekDocs,
  dueState,
  isEditableStatus,
  themeActivities,
  themeGoalBlocks,
  themeNumber,
} from '@/models/education-plan/classPlan';
import { exportThemeFile } from '@/utils/education-plan/classPlanDoc';

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';
const noop = () => {};

/**
 * Hồ sơ chủ đề theo file MN Thái Dương: kế hoạch giáo dục chủ đề + giáo án từng chủ đề nhánh. Giáo viên gửi cả hồ sơ
 * một lần (cuối trang); người duyệt (Tổ trưởng → Phó HT) mở từng tuần, ký khung "Duyệt giáo án từ ngày … đến ngày …"
 * ngay dưới nội dung tuần đó; kế hoạch chủ đề duyệt cùng khung tuần 1. Trả lại chỉ tuần đó.
 */
export default function ThemeDossierPage() {
  const { classId, themeId } = useParams();
  const [params] = useSearchParams();
  const { user, classThemePlans, branchPlans, weekPlans, actOnClassDoc, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, isClassTeacher, skipLeader } = ctx;
  const [tab, setTab] = useState(params.get('week') || 'theme');

  if (ctx.loading) return <LoadingState />;
  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  if (!cls || !yearPlan || !theme) return <EmptyState title="Không tìm thấy chủ đề trong kế hoạch năm đã ban hành của lớp" />;

  const base = `/education/class/${classId}`;
  const themeDoc = classThemePlans.find((t) => t.classId === classId && t.themeId === themeId) || null;
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const themeNo = themeNumber(yearPlan, themeId);
  const weeks = dossierWeekDocs(themeDoc || { classId, yearPlanId: yearPlan.id, themeId }, yearPlan, weekPlans).map((x, i) => ({
    ...x,
    branchNo: i + 1,
    branchName: branch?.names?.[x.week.start] || '',
  }));
  const sum = dossierSummary(themeDoc, weeks);
  const blocks = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId);
  const goals = blocks.flatMap((b) => b.goals);
  // Hoạt động của kế hoạch chủ đề chưa được chọn vào ô nào của các tuần (chỉ nhắc, không chặn gửi)
  const activities = themeActivities(blocks, (g) => themeRowOf(themeDoc, g));
  const used = new Set(
    weeks.flatMap((w) =>
      Object.values(w.doc?.picks || {})
        .flat()
        .map((p) => p.id),
    ),
  );
  const unused = activities.filter((a) => !used.has(a.id));
  const chain = getEduConfig().signers.week.filter((r) => r !== ROLES.TEAM_LEADER || !skipLeader);
  const lastReject = (d) => [...(d?.history || [])].reverse().find((h) => h.tone === 'err');
  const exportArgs = {
    themeDoc,
    theme,
    themeNo,
    cls,
    weeks: weeks.map((w) => w.week),
    blocks,
    rowOf: (g) => themeRowOf(themeDoc, g),
    weekDocs: weeks.filter((w) => w.doc),
  };
  const current = weeks.find((w) => w.week.start === tab);
  const due = !sum.sent ? dueState(themeDoc, theme.start) : null;
  const open = (key) => {
    setTab(key);
    requestAnimationFrame(() => document.getElementById('ga-dossier-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Một nút mỗi dòng theo việc cần làm: đến lượt duyệt → Duyệt; giáo viên còn sửa được → Sửa / Tạo; còn lại → Xem
  const rowAction = (doc, key, editTo, createLabel) => {
    if (isMyReviewTurn(doc, ctx, user))
      return (
        <button type="button" className="btn btn--success btn--sm" onClick={() => open(key)}>
          <Check size={16} aria-hidden /> Duyệt
        </button>
      );
    if (isClassTeacher && (!doc || isEditableStatus(doc.status)))
      return (
        <Link className={`btn btn--sm ${doc ? 'btn--outline-primary' : 'btn--primary'}`} to={editTo}>
          {doc ? <PenLine size={16} aria-hidden /> : <Plus size={16} aria-hidden />} {doc ? 'Sửa' : createLabel}
        </Link>
      );
    return (
      <button type="button" className="btn btn--outline-primary btn--sm" onClick={() => open(key)} disabled={!doc}>
        <Eye size={16} aria-hidden /> Xem
      </button>
    );
  };
  const signers = (doc) =>
    chain.map((r) => {
      const a = (doc?.approvals || []).find((x) => x.roleKey === r);
      return (
        <div key={r} className="text-sm">
          <span className="muted">{SIGN_ROLES[r]}: </span>
          {a ? <span className="fw-600">{`${a.name} (${fmtDateTime(a.at)})`}</span> : <span className="muted">chưa ký</span>}
        </div>
      );
    });
  const range = (w) => `${fmtDate(w.week.start)} đến ngày ${fmtDate(w.week.end)}`;

  return (
    <div className="page ga-page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: `Kế hoạch ${cls.name}`, to: base }, { label: `Hồ sơ chủ đề ${themeNo}` }]}
        title={`Hồ sơ chủ đề ${themeNo}: ${theme.name}`}
        desc={`${cls.name} · ${weeks.length} tuần, ${fmtDate(theme.start)} → ${fmtDate(theme.end)}`}
        actions={
          <>
            <button type="button" className="btn btn--outline-primary btn--sm" onClick={() => exportThemeFile(exportArgs, 'doc')}>
              <FileDown size={16} aria-hidden /> Xuất Word hồ sơ
            </button>
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              onClick={() => exportThemeFile(exportArgs, 'print') || toast(POPUP_BLOCKED, 'warn')}
            >
              <Printer size={16} aria-hidden /> In / Lưu PDF
            </button>
          </>
        }
      />

      {/* Bảng hồ sơ cùng kiểu bảng mục tiêu: mỗi dòng một phần của hồ sơ, trạng thái và chữ ký người duyệt từng tuần */}
      <Card title="Nội dung hồ sơ và duyệt từng tuần" bodyClass={null}>
        <div className="card__body stack">
          <div className="row row--wrap gap-2">
            {sum.sent ? (
              <>
                <span className="chip chip--green">
                  Đã duyệt {sum.approved}/{sum.total} tuần
                </span>
                {sum.pending > 0 && <span className="chip chip--purple">Đang chờ duyệt {sum.pending} tuần</span>}
                {sum.rejected > 0 && <span className="chip chip--red">Bị trả lại {sum.rejected} tuần</span>}
              </>
            ) : (
              <>
                <span className="chip chip--gray">Chưa gửi</span>
                <span className="muted text-sm">Hạn gửi: trước {fmtDate(theme.start)}</span>
                {due === 'late' && <span className="chip chip--red">Quá hạn</span>}
                {due === 'soon' && <span className="chip chip--orange">Sắp đến hạn</span>}
              </>
            )}
          </div>
          {unused.length > 0 && (
            <Notice tone="warn">
              Còn {unused.length} hoạt động trong kế hoạch chủ đề chưa xếp vào tuần nào.
              <details>
                <summary className="text-sm">Xem danh sách</summary>
                <ul>
                  {unused.map((a) => (
                    <li key={a.id} className="text-sm">
                      MT {a.goalNo}: {a.text}
                    </li>
                  ))}
                </ul>
              </details>
            </Notice>
          )}
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table">
              <colgroup>
                <col className="ga-goal-table__del" />
                <col />
                <col className="ga-goal-table__code" />
                <col className="ga-goal-table__group" />
                <col className="ga-goal-table__code" />
              </colgroup>
              <thead>
                <tr>
                  <th className="ga-goal-table__fixed center">STT</th>
                  <th>Nội dung</th>
                  <th className="ga-goal-table__fixed">Thời gian</th>
                  <th>Trạng thái, người duyệt</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="ga-goal-table__fixed center">
                    <div className="ga-goal-table__pad">1</div>
                  </td>
                  <td>
                    <div className="ga-goal-table__pad">
                      <div className="fw-600">Kế hoạch giáo dục chủ đề {themeNo}</div>
                      <div className="text-xs muted">I. Mục tiêu, nội dung, hoạt động · II. Môi trường giáo dục</div>
                    </div>
                  </td>
                  <td className="ga-goal-table__fixed">
                    <div className="ga-goal-table__pad">
                      {fmtDate(theme.start)} → {fmtDate(theme.end)}
                    </div>
                  </td>
                  <td>
                    <div className="ga-goal-table__pad stack">
                      <span>
                        {themeDoc ? <EduStatusBadge status={themeDoc.status} /> : <span className="chip chip--gray">Chưa lập</span>}
                      </span>
                      <span className="muted text-sm">Duyệt cùng khung tuần 1</span>
                    </div>
                  </td>
                  <td className="center">
                    <div className="ga-goal-table__pad">
                      {isClassTeacher && (!themeDoc || isEditableStatus(themeDoc.status)) ? (
                        <Link
                          className={`btn btn--sm ${themeDoc ? 'btn--outline-primary' : 'btn--primary'}`}
                          to={`${base}/themes/${themeId}`}
                        >
                          {themeDoc ? <PenLine size={16} aria-hidden /> : <Plus size={16} aria-hidden />} {themeDoc ? 'Sửa' : 'Lập'}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--outline-primary btn--sm"
                          onClick={() => open('theme')}
                          disabled={!themeDoc}
                        >
                          <Eye size={16} aria-hidden /> Xem
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {weeks.map((w) => {
                  const rej = w.doc?.status === EDU_STATUS.REJECTED ? lastReject(w.doc) : null;
                  return (
                    <tr key={w.week.start}>
                      <td className="ga-goal-table__fixed center">
                        <div className="ga-goal-table__pad">{w.branchNo + 1}</div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">
                          <div className="fw-600">
                            Chủ đề nhánh {w.branchNo}: {w.branchName || '…'}
                          </div>
                          <div className="text-xs muted">Kế hoạch tuần + 5 kế hoạch ngày · Duyệt giáo án từ ngày {range(w)}</div>
                          {rej?.note && <div className="text-sm text-danger">Lý do trả lại: {rej.note}</div>}
                        </div>
                      </td>
                      <td className="ga-goal-table__fixed">
                        <div className="ga-goal-table__pad">
                          Tuần {w.week.no}
                          <br />
                          {fmtDate(w.week.start)}
                        </div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad stack">
                          <span>
                            {w.doc ? <EduStatusBadge status={w.doc.status} /> : <span className="chip chip--gray">Chưa soạn</span>}
                          </span>
                          {signers(w.doc)}
                        </div>
                      </td>
                      <td className="center">
                        <div className="ga-goal-table__pad">{rowAction(w.doc, w.week.start, `${base}/weeks/${w.week.start}`, 'Tạo')}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div id="ga-dossier-view">
        <Card
          title={
            current
              ? `Chủ đề nhánh ${current.branchNo}: ${current.branchName || '…'} · Tuần ${current.week.no}`
              : `Kế hoạch giáo dục chủ đề ${themeNo}: ${theme.name}`
          }
          bodyClass={null}
        >
          <div className="card__body stack">
            {!current ? (
              themeDoc ? (
                <ThemePlanBody yearPlan={yearPlan} themeId={themeId} draft={themeDoc} />
              ) : (
                <span className="muted">Chưa lập kế hoạch chủ đề.</span>
              )
            ) : current.doc ? (
              <>
                <div className="section-title">KẾ HOẠCH TUẦN</div>
                <WeekTab draft={current.doc} week={current.week} editable={false} update={noop} />
                <div className="section-title">KẾ HOẠCH NGÀY</div>
                {current.doc.days.map((d, i) => (
                  <DayTab key={d.date} draft={current.doc} index={i} editable={false} canEvaluate={false} update={noop} goals={goals} />
                ))}
              </>
            ) : (
              <Notice tone="warn">Chưa soạn giáo án tuần này. Hồ sơ chủ đề cần đủ giáo án các nhánh mới gửi duyệt được.</Notice>
            )}
          </div>
        </Card>
      </div>

      {/* Khung duyệt của tuần đang xem: ký ngay tại đây (tuần 1 duyệt luôn kế hoạch chủ đề) */}
      {current?.doc && (
        <>
          <WeekApproval doc={current.doc} week={current.week} ctx={ctx} />
          <SignPanel
            kind="week"
            doc={current.doc}
            ctx={ctx}
            user={user}
            title={`Duyệt giáo án từ ngày ${range(current)}`}
            note={current.branchNo === 1 ? 'Khung duyệt tuần 1 duyệt luôn kế hoạch giáo dục chủ đề.' : null}
            onAct={(action, body) => actOnClassDoc('week', current.doc.id, { action, ...body })}
          />
        </>
      )}

      {/* Gửi cả hồ sơ một lần ở cuối trang */}
      {themeDoc && !current && (
        <SignPanel
          kind="theme"
          doc={themeDoc}
          ctx={ctx}
          user={user}
          title="Gửi duyệt hồ sơ chủ đề"
          note={`Gửi một lần kế hoạch chủ đề và giáo án ${weeks.length} nhánh. Mỗi tuần được duyệt riêng; tuần bị trả lại thì sửa và gửi lại riêng tuần đó.`}
          onAct={(action, body) => actOnClassDoc('theme', themeDoc.id, { action, ...body })}
        />
      )}
    </div>
  );
}
