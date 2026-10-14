import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileDown, Printer, Save } from '@/components/ui/icons';
import { Card, EmptyState, PageHead } from '@/components/education-plan/eduUi';
import { DocStatusStrip, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { numberGoals } from '@/models/education-plan/goalTable';
import { ddmm, emptyThemePlan, isEditableStatus, themeNumber, themeGoalBlocks, yearWeeks } from '@/models/education-plan/classPlan';
import { exportThemeFile } from '@/utils/education-plan/classPlanDoc';
import { ThemePlanBody, themeRowOf } from '@/components/education-plan/ThemePlanBody';

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';

/**
 * Kế hoạch giáo dục chủ đề của lớp theo mẫu MN Thái Dương: TT | Mục tiêu (giữ số MT năm) | Nội dung | Hoạt động giáo dục,
 * nhóm theo lĩnh vực / lĩnh vực con; II. Môi trường giáo dục. Mục tiêu và nội dung lấy sẵn từ phần đã tích cho chủ đề ở kế hoạch năm.
 */
export default function ClassThemePlanPage() {
  const { classId, themeId } = useParams();
  return <ThemePlanInner key={`${classId}/${themeId}`} />;
}

function ThemePlanInner() {
  const { classId, themeId } = useParams();
  const navigate = useNavigate();
  const { user, classThemePlans, branchPlans, weekPlans, saveClassDoc, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, isClassTeacher } = ctx;
  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  const saved = classThemePlans.find((t) => t.classId === classId && t.themeId === themeId) || null;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty && yearPlan) setDraft(saved || emptyThemePlan({ classId, yearPlanId: yearPlan.id, themeId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.status, saved?.history?.length, yearPlan?.id, classId, themeId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !theme) return <EmptyState title="Không tìm thấy chủ đề trong kế hoạch năm đã ban hành của lớp" />;
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = isClassTeacher && isEditableStatus(status);
  const base = `/education/class/${classId}`;
  const numbers = numberGoals(yearPlan.domains);
  const blocks = themeGoalBlocks(yearPlan.domains, numbers, themeId);
  const goals = blocks.flatMap((b) => b.goals);
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const weeks = yearWeeks(yearPlan).filter((w) => w.type === 'week' && w.theme.id === themeId);
  // Nội dung mặc định = các nội dung đã tích cho chủ đề ở kế hoạch năm; lớp được viết lại cho cụ thể
  const rowOf = (g) => themeRowOf(draft, g);
  const setRow = (g, field, value) => {
    setDraft((d) => ({ ...d, rows: { ...d.rows, [g.id]: { ...rowOf(g), [field]: value } } }));
    setDirty(true);
  };
  const setField = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
  };
  const save = async () => {
    // Lưu cả các dòng chưa sửa để bản đã duyệt giữ nguyên nội dung dù kế hoạch năm đổi sau này
    const res = await saveClassDoc('theme', { ...draft, rows: Object.fromEntries(goals.map((g) => [g.id, rowOf(g)])) });
    if (res) {
      setDirty(false);
      setDraft(res);
      toast('Đã lưu kế hoạch chủ đề');
    }
  };
  // Hồ sơ chủ đề như file của trường: kế hoạch chủ đề rồi từng tuần nhánh đã soạn (kèm khung duyệt của tuần)
  const exportArgs = {
    themeDoc: draft,
    theme,
    themeNo: themeNumber(yearPlan, themeId),
    cls,
    weeks,
    blocks,
    rowOf,
    weekDocs: weeks
      .map((w, i) => ({
        week: w,
        branchNo: i + 1,
        branchName: branch?.names?.[w.start] || '',
        doc: weekPlans.find((x) => x.classId === classId && x.weekStart === w.start),
      }))
      .filter((w) => w.doc),
  };

  return (
    <div className="page ga-page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: `Kế hoạch ${cls.name}`, to: base }, { label: theme.name }]}
        title={`Kế hoạch giáo dục chủ đề: ${theme.name}`}
        desc={`${cls.name} · ${weeks.length} tuần, ${ddmm(theme.start)} → ${ddmm(theme.end)}`}
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => exportThemeFile(exportArgs, 'doc')}>
              <FileDown size={16} aria-hidden /> Xuất Word hồ sơ chủ đề
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => exportThemeFile(exportArgs, 'print') || toast(POPUP_BLOCKED, 'warn')}
            >
              <Printer size={16} aria-hidden /> In / Lưu PDF
            </button>
            {editable && (
              <button type="button" className="btn btn--primary" disabled={!dirty && !!saved} onClick={save}>
                <Save size={16} aria-hidden /> {dirty || !saved ? 'Lưu' : 'Đã lưu'}
              </button>
            )}
          </>
        }
      />
      {/* Gửi / duyệt cả hồ sơ chủ đề (kế hoạch chủ đề + giáo án các nhánh) ở trang hồ sơ */}
      <DocStatusStrip
        kind="theme"
        doc={saved}
        ctx={ctx}
        user={user}
        dirty={dirty}
        reviewTo={`${base}/themes/${themeId}/review`}
        onGo={navigate}
      />
      <Card title="Chủ đề nhánh" bodyClass={null}>
        <div className="card__body">
          {weeks.length ? (
            <ul className="stack">
              {weeks.map((w) => (
                <li key={w.start}>
                  <Link to={`/education/class/${classId}/weeks/${w.start}`}>
                    Tuần {w.no} ({ddmm(w.start)} → {ddmm(w.end)}): {branch?.names?.[w.start] || 'chưa đặt tên nhánh'}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="muted">Chủ đề chưa có tuần học.</span>
          )}
        </div>
      </Card>
      <ThemePlanBody yearPlan={yearPlan} themeId={themeId} draft={draft} editable={editable} setRow={setRow} setField={setField} />
    </div>
  );
}
