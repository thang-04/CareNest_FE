import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Save } from '@/components/ui/icons';
import { Card, EmptyState, Notice, PageHead } from '@/components/education-plan/eduUi';
import { AiButton, AiDraftPanel, CellInput, ReviewBar, getPath, setPath, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { ddmm, emptyThemePlan, isEditableStatus, themeGoals, yearWeeks } from '@/models/education-plan/yearPlanModel';

/**
 * Kế hoạch giáo dục chủ đề của lớp: bảng Mục tiêu (giữ số MT của kế hoạch năm) | Nội dung | Hoạt động giáo dục,
 * rồi Môi trường giáo dục trong lớp / ngoài lớp. Mục tiêu lấy từ các nội dung đã tích vào chủ đề ở kế hoạch năm.
 */
export default function ClassThemePlanPage() {
  const { classId, themeId } = useParams();
  // Đổi lớp/tuần thì dựng lại trang để bỏ bản sửa dở của trang trước
  return <ClassThemePlanPageInner key={`${classId}/${themeId}`} />;
}

function ClassThemePlanPageInner() {
  const { classId, themeId } = useParams();
  const { themePlans, branchPlans, savePlanDoc, actOnPlanDoc, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, isClassTeacher } = ctx;
  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  const saved = themePlans.find((t) => t.classId === classId && t.themeId === themeId) || null;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [ai, setAi] = useState(false);

  useEffect(() => {
    if (!dirty && yearPlan) setDraft(saved || emptyThemePlan({ classId, yearPlanId: yearPlan.id, themeId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.status, saved?.history?.length, yearPlan?.id, classId, themeId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !theme) return <EmptyState title="Không tìm thấy chủ đề của lớp" />;
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = isClassTeacher && isEditableStatus(status);
  const goals = themeGoals(yearPlan, themeId);
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const weeks = yearWeeks(yearPlan).filter((w) => w.type === 'week' && w.theme.id === themeId);
  // Nội dung mặc định = các nội dung đã tích vào chủ đề ở kế hoạch năm; lớp được viết lại cho cụ thể.
  const rowOf = (g) => draft.rows[g.id] || { contents: g.contents.map((c) => c.text).join('\n'), activities: '' };
  const patch = (path, value) => {
    setDraft((d) => setPath(d, path, value));
    setDirty(true);
  };
  const setRow = (g, field, value) => patch(`rows.${g.id}`, { ...rowOf(g), [field]: value });
  const save = async () => {
    // Lưu cả các dòng chưa sửa để bảng đã duyệt giữ nguyên nội dung dù kế hoạch năm đổi sau này
    const rows = Object.fromEntries(goals.map((g) => [g.id, rowOf(g)]));
    const res = await savePlanDoc('theme', { ...draft, rows });
    if (res) {
      setDirty(false);
      setDraft(res);
      toast('Đã lưu kế hoạch chủ đề');
    }
  };

  let lastDomain = null;
  return (
    <div className="page">
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          { label: `Kế hoạch ${cls.name}`, to: `/education/class/${classId}` },
          { label: theme.name },
        ]}
        title={`Kế hoạch giáo dục chủ đề: ${theme.name}`}
        desc={`${cls.name} · ${weeks.length} tuần, ${ddmm(theme.startDate)} → ${ddmm(theme.endDate)} · Nhánh: ${weeks.map((w) => branch?.names?.[w.start] || `Tuần ${w.no}`).join('; ')}`}
        actions={
          editable && (
            <>
              <AiButton onClick={() => setAi(true)}>Tạo nháp hoạt động bằng AI</AiButton>
              <button type="button" className="btn btn--primary" disabled={!dirty && !!saved} onClick={save}>
                <Save size={16} /> {dirty || !saved ? 'Lưu' : 'Đã lưu'}
              </button>
            </>
          )
        }
      />
      <ReviewBar
        title="Duyệt kế hoạch chủ đề"
        doc={saved}
        dirty={dirty}
        {...ctx}
        onAct={async (action, body) => {
          const res = await actOnPlanDoc('theme', draft.id, { action, ...body });
          if (res) toast('Đã cập nhật trạng thái');
          return res;
        }}
      />
      {goals.length === 0 && <Notice tone="warn">Kế hoạch năm chưa tích nội dung nào vào chủ đề này.</Notice>}
      <Card title="I. Mục tiêu, nội dung và hoạt động giáo dục" num={null} bodyClass={null}>
        <div className="table-wrap">
          <table className="table ga-plan-table">
            <thead>
              <tr>
                <th>TT</th>
                <th>Mục tiêu giáo dục</th>
                <th>Nội dung giáo dục</th>
                <th>Hoạt động giáo dục</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => {
                const showDomain = g.domainId !== lastDomain;
                lastDomain = g.domainId;
                const row = rowOf(g);
                return (
                  <Fragment key={g.id}>
                    {showDomain && (
                      <tr>
                        <td colSpan={4} className="fw-600">
                          {g.domain.roman}. {g.domain.name.toUpperCase()}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="fw-600">{g.no}</td>
                      <td>
                        {g.no}. {g.text}
                      </td>
                      <td>
                        <CellInput
                          editable={editable}
                          value={row.contents}
                          rows={4}
                          label={`Nội dung của MT ${g.no}`}
                          onChange={(v) => setRow(g, 'contents', v)}
                        />
                      </td>
                      <td>
                        <CellInput
                          editable={editable}
                          value={row.activities}
                          rows={4}
                          placeholder="Chơi, học, lao động, ăn, ngủ, vệ sinh… ghi theo loại giờ: TDS, HĐ học, ngoài trời, góc, buổi chiều"
                          label={`Hoạt động giáo dục của MT ${g.no}`}
                          onChange={(v) => setRow(g, 'activities', v)}
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="II. Môi trường giáo dục">
        <div className="ga-plan-grid">
          <div className="stack">
            <div className="fw-600">1. Trong lớp</div>
            <CellInput editable={editable} value={draft.envIn} rows={6} label="Môi trường trong lớp" onChange={(v) => patch('envIn', v)} />
          </div>
          <div className="stack">
            <div className="fw-600">2. Ngoài lớp</div>
            <CellInput
              editable={editable}
              value={draft.envOut}
              rows={6}
              label="Môi trường ngoài lớp"
              onChange={(v) => patch('envOut', v)}
            />
          </div>
        </div>
      </Card>
      <p className="muted text-sm">
        Giáo án từng tuần của chủ đề:{' '}
        {weeks.map((w, i) => (
          <Fragment key={w.start}>
            {i > 0 && ' · '}
            <Link to={`/education/class/${classId}/weeks/${w.start}`}>
              Tuần {w.no}: {branch?.names?.[w.start] || ddmm(w.start)}
            </Link>
          </Fragment>
        ))}
      </p>
      <AiDraftPanel
        open={ai}
        title={`Nháp hoạt động: ${theme.name}`}
        type="theme-activities"
        context={{
          themeName: theme.name,
          rows: goals.map((g) => ({ goalId: g.id, no: g.no, text: g.text, domainKey: g.domain.key, contents: rowOf(g).contents })),
        }}
        isFilled={(key) =>
          !!(key.startsWith('rows.') ? rowOf({ id: key.split('.')[1], contents: [] }).activities : getPath(draft, key))?.trim()
        }
        onClose={() => setAi(false)}
        onApply={(items) => {
          setDraft((d) =>
            items.reduce((acc, it) => {
              if (!it.key.startsWith('rows.')) return setPath(acc, it.key, it.value);
              const g = goals.find((x) => x.id === it.key.split('.')[1]);
              const cur = acc.rows[g.id] || { contents: g.contents.map((c) => c.text).join('\n'), activities: '' };
              return setPath(acc, `rows.${g.id}`, { ...cur, activities: it.value });
            }, d),
          );
          setDirty(true);
          toast(`Đã đưa ${items.length} mục nháp AI vào bảng, nhớ kiểm tra rồi lưu`, 'info');
        }}
      />
    </div>
  );
}
