import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileDown, Printer, Save } from '@/components/ui/icons';
import { Card, EmptyState, Notice, PageHead } from '@/components/education-plan/eduUi';
import { Cell, DocSignatures, ReviewBar, focusCell, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { EDU_STATUS, domainLabel } from '@/models/education-plan/educationPlanConstants';
import { domainRoman, numberGoals } from '@/models/education-plan/goalTable';
import { ddmm, emptyThemePlan, isEditableStatus, themeGoalBlocks, yearWeeks } from '@/models/education-plan/classPlan';
import { exportThemePlan } from '@/utils/education-plan/classPlanDoc';

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
  const { user, classThemePlans, branchPlans, saveClassDoc, actOnClassDoc, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, teachers, isClassTeacher } = ctx;
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
  const numbers = numberGoals(yearPlan.domains);
  const blocks = themeGoalBlocks(yearPlan.domains, numbers, themeId);
  const goals = blocks.flatMap((b) => b.goals);
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const weeks = yearWeeks(yearPlan).filter((w) => w.type === 'week' && w.theme.id === themeId);
  // Nội dung mặc định = các nội dung đã tích cho chủ đề ở kế hoạch năm; lớp được viết lại cho cụ thể
  const rowOf = (g) => draft.rows[g.id] || { contents: g.contents.map((c) => `- ${c}`).join('\n'), activities: '' };
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
  const exportArgs = { doc: draft, theme, cls, weeks, branchNames: branch?.names || {}, blocks, rowOf, teachers };

  return (
    <div className="page">
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          { label: `Kế hoạch ${cls.name}`, to: `/education/class/${classId}` },
          { label: theme.name },
        ]}
        title={`Kế hoạch giáo dục chủ đề: ${theme.name}`}
        desc={`${cls.name} · ${weeks.length} tuần, ${ddmm(theme.start)} → ${ddmm(theme.end)}`}
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => exportThemePlan(exportArgs, 'doc')}>
              <FileDown size={16} aria-hidden /> Xuất Word
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => exportThemePlan(exportArgs, 'print') || toast(POPUP_BLOCKED, 'warn')}
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
      <ReviewBar
        kind="theme"
        title="Duyệt kế hoạch chủ đề"
        doc={saved}
        dirty={dirty}
        ctx={ctx}
        user={user}
        onAct={(action, body) => actOnClassDoc('theme', draft.id, { action, ...body })}
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
      {goals.length === 0 && <Notice tone="warn">Kế hoạch năm chưa tích nội dung nào vào chủ đề này.</Notice>}
      <Card title="I. Mục tiêu, nội dung và hoạt động giáo dục" bodyClass={null}>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-goal-table__del" />
                <col className="ga-goal-table__goaltext" />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className="ga-goal-table__fixed">TT</th>
                  <th className="ga-goal-table__fixed">Mục tiêu giáo dục</th>
                  <th>Nội dung giáo dục</th>
                  <th>Hoạt động giáo dục</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b, i) => (
                  <Fragment key={`${b.domain}-${b.sub}-${i}`}>
                    {(i === 0 || blocks[i - 1].domain !== b.domain) && (
                      <tr>
                        <td colSpan={4} className="ga-goal-table__domain">
                          <div className="ga-goal-table__pad">
                            <h3>
                              {domainRoman(b.domain)}. {domainLabel(b.domain).toUpperCase()}
                            </h3>
                          </div>
                        </td>
                      </tr>
                    )}
                    {b.sub && (
                      <tr>
                        <td colSpan={4} className="ga-goal-table__subband">
                          <div className="ga-goal-table__subname">{b.sub}</div>
                        </td>
                      </tr>
                    )}
                    {b.goals.map((g) => (
                      <tr key={g.id}>
                        <td className="ga-goal-table__fixed">
                          <div className="ga-goal-table__pad">
                            <span className="ga-goal-code">MT {g.no}</span>
                          </div>
                        </td>
                        <td className="ga-goal-table__fixed">
                          <div className="ga-goal-table__pad">{g.text}</div>
                        </td>
                        <td>
                          <Cell
                            editable={editable}
                            value={rowOf(g).contents}
                            label={`Nội dung của MT ${g.no}`}
                            onChange={(v) => setRow(g, 'contents', v)}
                          />
                        </td>
                        <td>
                          <Cell
                            editable={editable}
                            value={rowOf(g).activities}
                            label={`Hoạt động giáo dục của MT ${g.no}`}
                            placeholder="Ghi theo loại giờ: TDS, HĐ học, Chơi HĐ ngoài trời, Chơi ở các góc, Chơi buổi chiều…"
                            onChange={(v) => setRow(g, 'activities', v)}
                          />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <Card title="II. Môi trường giáo dục" bodyClass={null}>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <thead>
                <tr>
                  <th>1. Trong lớp</th>
                  <th>2. Ngoài lớp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Cell
                      editable={editable}
                      value={draft.envIn}
                      label="Môi trường trong lớp"
                      placeholder="Trang trí, góc chơi, đồ dùng…"
                      onChange={(v) => setField('envIn', v)}
                    />
                  </td>
                  <td>
                    <Cell
                      editable={editable}
                      value={draft.envOut}
                      label="Môi trường ngoài lớp"
                      placeholder="Sân chơi, khu vực ngoài lớp…"
                      onChange={(v) => setField('envOut', v)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <DocSignatures doc={saved} teachers={teachers} />
    </div>
  );
}
