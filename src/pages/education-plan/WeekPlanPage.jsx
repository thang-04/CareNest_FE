import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileDown, Printer, Save } from '@/components/ui/icons';
import { Card, EmptyState, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { Cell, DocSignatures, ReviewBar, focusCell, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import {
  DAY_SECTIONS,
  WEEKDAY_LABELS,
  addDays,
  ddmm,
  emptyWeekPlan,
  isEditableStatus,
  longDay,
  rowCell,
  weekRows,
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { exportWeekPlan } from '@/utils/education-plan/classPlanDoc';

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';
const AIMS = [
  { key: 'knowledge', label: '1. Kiến thức' },
  { key: 'skills', label: '2. Kỹ năng' },
  { key: 'attitude', label: '3. Thái độ' },
];

/**
 * Giáo án một tuần của lớp = kế hoạch tuần (mục đích, chuẩn bị, bảng 8 hoạt động × Thứ 2–6) + 5 kế hoạch ngày.
 * Gửi duyệt và duyệt cả tuần một lần ("Duyệt giáo án từ ngày … đến ngày …").
 */
export default function WeekPlanPage() {
  const { classId, weekStart } = useParams();
  return <WeekPlanInner key={`${classId}/${weekStart}`} />;
}

function WeekPlanInner() {
  const { classId, weekStart } = useParams();
  const { user, weekPlans, branchPlans, saveClassDoc, actOnClassDoc, toast } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, teachers, isClassTeacher } = ctx;
  const saved = weekPlans.find((w) => w.classId === classId && w.weekStart === weekStart) || null;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('week');

  const weeks = yearPlan ? yearWeeks(yearPlan).filter((w) => w.type === 'week') : [];
  const idx = weeks.findIndex((w) => w.start === weekStart);
  const week = weeks[idx];

  useEffect(() => {
    if (dirty || !week) return;
    setDraft(saved || emptyWeekPlan({ classId, yearPlanId: yearPlan.id, weekStart, weekNo: week.no, themeId: week.theme.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.status, saved?.history?.length, week?.start, classId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !week) return <EmptyState title="Không tìm thấy tuần học này trong kế hoạch năm của lớp" />;
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = isClassTeacher && isEditableStatus(status);
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const branchName = branch?.names?.[weekStart] || '';
  const update = (fn) => {
    setDraft((d) => fn(structuredClone(d)));
    setDirty(true);
  };
  const save = async () => {
    const res = await saveClassDoc('week', draft);
    if (res) {
      setDirty(false);
      setDraft(res);
      toast(isEditableStatus(status) ? 'Đã lưu giáo án tuần' : 'Đã lưu đánh giá cuối ngày');
    }
  };
  const prev = weeks[idx - 1];
  const next = weeks[idx + 1];
  const day = tab === 'week' ? -1 : Number(tab);
  const exportArgs = { doc: draft, week, cls, theme: week.theme, branchName, teachers };

  return (
    <div className="page">
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          { label: `Kế hoạch ${cls.name}`, to: `/education/class/${classId}` },
          { label: `Tuần ${week.no}` },
        ]}
        title={`Tuần ${week.no}: ${branchName || 'chưa đặt tên nhánh'}`}
        desc={`${cls.name} · Chủ đề ${week.theme.name} · ${fmtDate(week.start)} → ${fmtDate(week.end)}`}
        actions={
          <>
            {prev && (
              <Link className="btn btn--ghost btn--sm" to={`/education/class/${classId}/weeks/${prev.start}`}>
                <ArrowLeft size={16} aria-hidden /> Tuần {prev.no}
              </Link>
            )}
            {next && (
              <Link className="btn btn--ghost btn--sm" to={`/education/class/${classId}/weeks/${next.start}`}>
                Tuần {next.no} <ArrowRight size={16} aria-hidden />
              </Link>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => exportWeekPlan(exportArgs, 'doc')}>
              <FileDown size={16} aria-hidden /> Xuất Word
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => exportWeekPlan(exportArgs, 'print') || toast(POPUP_BLOCKED, 'warn')}
            >
              <Printer size={16} aria-hidden /> In / Lưu PDF
            </button>
            {isClassTeacher && (
              <button type="button" className="btn btn--primary" disabled={!dirty && !!saved} onClick={save}>
                <Save size={16} aria-hidden /> {dirty || !saved ? 'Lưu' : 'Đã lưu'}
              </button>
            )}
          </>
        }
      />
      <ReviewBar
        kind="week"
        title={`Duyệt giáo án từ ngày ${fmtDate(week.start)} đến ngày ${fmtDate(week.end)}`}
        doc={saved}
        dirty={dirty}
        ctx={ctx}
        user={user}
        onAct={(action, body) => actOnClassDoc('week', draft.id, { action, ...body })}
      />
      {!editable && isClassTeacher && status === EDU_STATUS.APPROVED && (
        <Notice tone="ok">
          Giáo án đã duyệt. Sau mỗi buổi dạy, ghi "Đánh giá trẻ trong ngày" và "Kế hoạch điều chỉnh" ở thẻ của ngày đó rồi bấm Lưu.
        </Notice>
      )}
      <Card bodyClass={null}>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'week'}
            className={`tab ${tab === 'week' ? 'tab--active' : ''}`}
            onClick={() => setTab('week')}
          >
            Kế hoạch tuần
          </button>
          {draft.days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={tab === String(i)}
              className={`tab ${tab === String(i) ? 'tab--active' : ''}`}
              onClick={() => setTab(String(i))}
            >
              {WEEKDAY_LABELS[i]} · {ddmm(d.date)}
            </button>
          ))}
        </div>
        <div className="card__body stack">
          {day < 0 ? (
            <WeekTab draft={draft} week={week} editable={editable} update={update} />
          ) : (
            <DayTab draft={draft} index={day} editable={editable} canEvaluate={isClassTeacher} update={update} />
          )}
        </div>
      </Card>
      <DocSignatures doc={saved} teachers={teachers} />
    </div>
  );
}

/** Bảng nhãn | nội dung dùng cho Mục đích yêu cầu, Chuẩn bị. */
function LabelTable({ rows }) {
  return (
    <div className="table-wrap">
      <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
        <colgroup>
          <col className="ga-goal-table__group" />
          <col />
        </colgroup>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="ga-goal-table__fixed">
                <div className="ga-goal-table__pad fw-600">{r.label}</div>
              </td>
              <td>{r.cell}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeekTab({ draft, week, editable, update }) {
  return (
    <>
      <div className="section-title">I. Mục đích yêu cầu</div>
      <LabelTable
        rows={AIMS.map((a) => ({
          label: a.label,
          cell: (
            <Cell editable={editable} value={draft.aims[a.key]} label={a.label} onChange={(v) => update((d) => ((d.aims[a.key] = v), d))} />
          ),
        }))}
      />
      <div className="section-title">II. Chuẩn bị</div>
      <LabelTable
        rows={[
          {
            label: 'Chuẩn bị',
            cell: <Cell editable={editable} value={draft.prep} label="Chuẩn bị" onChange={(v) => update((d) => ((d.prep = v), d))} />,
          },
        ]}
      />
      <div className="section-title">III. Tổ chức hoạt động</div>
      <div className="table-wrap">
        <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
          <colgroup>
            <col className="ga-goal-table__group" />
            {WEEKDAY_LABELS.map((l) => (
              <col key={l} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="ga-goal-table__fixed">Tên hoạt động</th>
              {WEEKDAY_LABELS.map((l, i) => (
                <th key={l} className="center">
                  {l} · {ddmm(addDays(week.start, i))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekRows().map((r) => {
              const g = rowCell(draft, r);
              const merged = r.canMerge && g.allWeek;
              return (
                <tr key={r.key}>
                  <td className="ga-goal-table__fixed">
                    <div className="ga-goal-table__pad stack">
                      <span className="fw-600">{r.label}</span>
                      {r.canMerge && editable && (
                        <label className="row gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={g.allWeek}
                            onChange={(e) => update((d) => (((d.grid[r.key] ||= rowCell(d, r)).allWeek = e.target.checked), d))}
                          />
                          Cả tuần
                        </label>
                      )}
                    </div>
                  </td>
                  {merged ? (
                    <td colSpan={5}>
                      <Cell
                        editable={editable}
                        value={g.common}
                        label={`${r.label} cả tuần`}
                        onChange={(v) => update((d) => (((d.grid[r.key] ||= rowCell(d, r)).common = v), d))}
                      />
                    </td>
                  ) : (
                    g.days.map((v, i) => (
                      <td key={i}>
                        {r.key === 'hoc' ? (
                          <>
                            <Cell
                              editable={editable}
                              value={v.subject}
                              label={`Môn ${WEEKDAY_LABELS[i]}`}
                              placeholder="Môn / lĩnh vực"
                              onChange={(x) => update((d) => ((d.grid.hoc.days[i].subject = x), d))}
                            />
                            <Cell
                              editable={editable}
                              value={v.topic}
                              label={`Đề tài ${WEEKDAY_LABELS[i]}`}
                              placeholder="Đề tài"
                              onChange={(x) => update((d) => ((d.grid.hoc.days[i].topic = x), d))}
                            />
                          </>
                        ) : (
                          <Cell
                            editable={editable}
                            value={v}
                            label={`${r.label} ${WEEKDAY_LABELS[i]}`}
                            onChange={(x) => update((d) => (((d.grid[r.key] ||= rowCell(d, r)).days[i] = x), d))}
                          />
                        )}
                      </td>
                    ))
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DayTab({ draft, index, editable, canEvaluate, update }) {
  const d = draft.days[index];
  const hoc = draft.grid.hoc.days[index] || {};
  const setDay = (field, v) => update((x) => ((x.days[index][field] = v), x));
  const setStep = (key, field, v) => update((x) => ((x.days[index].steps[key][field] = v), x));
  return (
    <>
      <div className="section-title center">{longDay(d.date, index)}</div>
      <div className="section-title">I. Mục đích yêu cầu</div>
      <LabelTable
        rows={[
          {
            label: 'Mục đích yêu cầu',
            cell: <Cell editable={editable} value={d.aims} label="Mục đích yêu cầu" onChange={(v) => setDay('aims', v)} />,
          },
        ]}
      />
      <div className="section-title">II. Chuẩn bị</div>
      <LabelTable
        rows={[
          {
            label: 'Chuẩn bị',
            cell: <Cell editable={editable} value={d.prep} label="Chuẩn bị của ngày" onChange={(v) => setDay('prep', v)} />,
          },
        ]}
      />
      <div className="section-title">III. Tiến trình hoạt động</div>
      <div className="table-wrap">
        <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
          <colgroup>
            <col />
            <col />
            <col className="ga-goal-table__group" />
          </colgroup>
          <thead>
            <tr>
              <th>Hoạt động của cô</th>
              <th>Hoạt động của trẻ</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {DAY_SECTIONS.map((s) => (
              <Fragment key={s.key}>
                <tr>
                  <td colSpan={3} className="ga-goal-table__fixed">
                    <div className="ga-goal-table__pad fw-600">
                      {s.label}
                      {s.key === 'hoc' && (hoc.subject || hoc.topic) ? `: ${[hoc.subject, hoc.topic].filter(Boolean).join(' – ')}` : ''}
                    </div>
                  </td>
                </tr>
                {s.parts.map((p) => {
                  const key = `${s.key}.${p.key}`;
                  const st = d.steps[key];
                  return (
                    <Fragment key={key}>
                      {p.label && (
                        <tr>
                          <td colSpan={3}>
                            <div className="ga-goal-table__pad">
                              <i>{p.label}</i>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td>
                          <Cell
                            editable={editable}
                            value={st.teacher}
                            label={`${s.label} ${p.label} – hoạt động của cô`}
                            onChange={(v) => setStep(key, 'teacher', v)}
                          />
                        </td>
                        <td>
                          <Cell
                            editable={editable}
                            value={st.child}
                            label={`${s.label} ${p.label} – hoạt động của trẻ`}
                            onChange={(v) => setStep(key, 'child', v)}
                          />
                        </td>
                        <td>
                          <Cell
                            editable={editable}
                            value={st.note}
                            label={`${s.label} ${p.label} – ghi chú`}
                            onChange={(v) => setStep(key, 'note', v)}
                          />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-title">Sau buổi dạy</div>
      <LabelTable
        rows={[
          {
            label: 'Đánh giá trẻ trong ngày',
            cell: (
              <Cell editable={canEvaluate} value={d.evaluation} label="Đánh giá trẻ trong ngày" onChange={(v) => setDay('evaluation', v)} />
            ),
          },
          {
            label: 'Kế hoạch điều chỉnh và bổ sung',
            cell: (
              <Cell
                editable={canEvaluate}
                value={d.adjustment}
                label="Kế hoạch điều chỉnh và bổ sung"
                onChange={(v) => setDay('adjustment', v)}
              />
            ),
          },
        ]}
      />
    </>
  );
}
