import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save } from '@/components/ui/icons';
import { Card, EmptyState, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import {
  AiButton,
  AiDraftPanel,
  CellInput,
  CellText,
  ReviewBar,
  getPath,
  setPath,
  useClassPlanContext,
} from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import {
  DAY_STEPS,
  WEEKDAY_LABELS,
  WEEK_ROWS,
  ddmm,
  emptyWeekPlan,
  isEditableStatus,
  todayIso,
  yearWeeks,
} from '@/models/education-plan/yearPlanModel';

const AIMS = [
  { key: 'knowledge', label: '1. Kiến thức' },
  { key: 'skills', label: '2. Kỹ năng' },
  { key: 'attitude', label: '3. Thái độ' },
];

/**
 * Giáo án một tuần của lớp = kế hoạch tuần (mục đích, chuẩn bị, bảng 8 hoạt động × Thứ 2–6)
 * + 5 kế hoạch ngày. Gửi duyệt và duyệt cả tuần một lần ("Duyệt giáo án từ ngày … đến ngày …").
 */
export default function WeekPlanPage() {
  const { classId, weekStart } = useParams();
  // Đổi lớp/tuần thì dựng lại trang để bỏ bản sửa dở của trang trước
  return <WeekPlanPageInner key={`${classId}/${weekStart}`} />;
}

function WeekPlanPageInner() {
  const { classId, weekStart } = useParams();
  const { weekPlans, branchPlans, savePlanDoc, actOnPlanDoc, toast, user } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, teachers, isClassTeacher, nameOf } = ctx;
  const saved = weekPlans.find((w) => w.classId === classId && w.weekStart === weekStart) || null;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('week');
  const [ai, setAi] = useState(null);

  const weeks = yearPlan ? yearWeeks(yearPlan).filter((w) => w.type === 'week') : [];
  const idx = weeks.findIndex((w) => w.start === weekStart);
  const week = weeks[idx];
  const branch = yearPlan ? branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id) : null;

  useEffect(() => {
    if (dirty || !week) return;
    setDraft(
      saved ||
        emptyWeekPlan({
          classId,
          yearPlanId: yearPlan.id,
          weekStart,
          weekNo: week.no,
          themeId: week.theme.id,
          branchName: branch?.names?.[weekStart] || '',
        }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.status, saved?.history?.length, week?.start, classId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !week) return <EmptyState title="Không tìm thấy tuần học này trong kế hoạch năm của lớp" />;
  if (!draft || draft.weekStart !== weekStart) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = isClassTeacher && isEditableStatus(status);
  const branchName = branch?.names?.[weekStart] || draft.branchName;
  const today = todayIso();
  const patch = (path, value) => {
    setDraft((d) => setPath(d, path, value));
    setDirty(true);
  };
  const save = async () => {
    const res = await savePlanDoc('week', { ...draft, branchName });
    if (res) {
      setDirty(false);
      setDraft(res);
      toast(isEditableStatus(status) ? 'Đã lưu giáo án tuần' : 'Đã lưu đánh giá cuối ngày');
    }
  };
  const missingDays = draft.days.filter((d) => !d.steps.hoc.teacher.trim()).length;
  const prev = weeks[idx - 1];
  const next = weeks[idx + 1];
  const dayIndex = tab === 'week' ? -1 : Number(tab);

  return (
    <div className="page">
      <div className="ga-sticky-head">
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
                  <ArrowLeft size={16} /> Tuần {prev.no}
                </Link>
              )}
              {next && (
                <Link className="btn btn--ghost btn--sm" to={`/education/class/${classId}/weeks/${next.start}`}>
                  Tuần {next.no} <ArrowRight size={16} />
                </Link>
              )}
              {editable && (
                <AiButton onClick={() => setAi(tab === 'week' ? 'week' : 'day')}>
                  {tab === 'week' ? 'Điền tuần bằng AI' : 'Soạn kế hoạch ngày bằng AI'}
                </AiButton>
              )}
              {isClassTeacher && (
                <button type="button" className="btn btn--primary" disabled={!dirty && !!saved} onClick={save}>
                  <Save size={16} /> {dirty || !saved ? 'Lưu' : 'Đã lưu'}
                </button>
              )}
            </>
          }
        />
        <div className="tabs" role="tablist">
          <button
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
              role="tab"
              aria-selected={tab === String(i)}
              className={`tab ${tab === String(i) ? 'tab--active' : ''}`}
              onClick={() => setTab(String(i))}
            >
              {WEEKDAY_LABELS[i]} · {ddmm(d.date)}
              {d.assigneeId && <span className="tab__count">{nameOf(d.assigneeId).split(' ').pop()}</span>}
            </button>
          ))}
        </div>
      </div>

      <ReviewBar
        title={`Duyệt giáo án từ ngày ${fmtDate(week.start)} đến ngày ${fmtDate(week.end)}`}
        doc={saved}
        dirty={dirty}
        {...ctx}
        onAct={async (action, body) => {
          const res = await actOnPlanDoc('week', draft.id, { action, ...body });
          if (res) toast('Đã cập nhật trạng thái');
          return res;
        }}
      />
      {editable && missingDays > 0 && (
        <Notice>Còn {missingDays} ngày chưa soạn tiến trình hoạt động học. Giáo án được duyệt cả tuần một lần.</Notice>
      )}
      {!editable && isClassTeacher && status === EDU_STATUS.APPROVED && (
        <Notice tone="ok">
          Giáo án đã duyệt. Sau mỗi buổi dạy, ghi "Đánh giá trẻ trong ngày" và "Kế hoạch điều chỉnh" ở thẻ của ngày đó.
        </Notice>
      )}

      {tab === 'week' ? (
        <WeekTab draft={draft} editable={editable} patch={patch} />
      ) : (
        <DayTab
          day={draft.days[dayIndex]}
          index={dayIndex}
          hocCell={draft.grid.hoc.days[dayIndex] || draft.grid.hoc.common}
          editable={editable}
          canEvaluate={isClassTeacher}
          today={today}
          teachers={teachers}
          nameOf={nameOf}
          patch={patch}
          userId={user.id}
        />
      )}

      <AiDraftPanel
        open={!!ai}
        title={ai === 'week' ? `Nháp kế hoạch tuần ${week.no}` : `Nháp kế hoạch ${WEEKDAY_LABELS[dayIndex] || ''}`}
        type={ai === 'week' ? 'week-fill' : 'day-plan'}
        context={{
          branchName,
          themeName: week.theme.name,
          dayIndex,
          topic: dayIndex >= 0 ? (draft.grid.hoc.days[dayIndex] || '').split('\n').join(' – ') : '',
        }}
        isFilled={(key) => !!getPath(draft, key)?.trim?.()}
        onClose={() => setAi(null)}
        onApply={(items) => {
          setDraft((d) => items.reduce((acc, it) => setPath(acc, it.key, it.value), d));
          setDirty(true);
          toast(`Đã đưa ${items.length} mục nháp AI vào giáo án, nhớ kiểm tra rồi lưu`, 'info');
        }}
      />
    </div>
  );
}

function WeekTab({ draft, editable, patch }) {
  return (
    <>
      <Card title="I. Mục đích, yêu cầu" bodyClass={null}>
        <div className="table-wrap">
          <table className="table ga-plan-table">
            <tbody>
              {AIMS.map((a) => (
                <tr key={a.key}>
                  <td className="fw-600">{a.label}</td>
                  <td>
                    <CellInput
                      editable={editable}
                      value={draft.aims[a.key]}
                      rows={4}
                      label={a.label}
                      onChange={(v) => patch(`aims.${a.key}`, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="II. Chuẩn bị">
        <CellInput editable={editable} value={draft.prep} rows={5} label="Chuẩn bị" onChange={(v) => patch('prep', v)} />
      </Card>
      <Card title="III. Tổ chức hoạt động" bodyClass={null}>
        <div className="table-wrap">
          <table className="table ga-plan-table ga-week-table">
            <thead>
              <tr>
                <th>Tên hoạt động</th>
                {draft.days.map((d, i) => (
                  <th key={d.date}>
                    {WEEKDAY_LABELS[i]} ({ddmm(d.date)})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEK_ROWS.map((r) => {
                const cell = draft.grid[r.key];
                const showCommon = !cell.allWeek && (editable || cell.common?.trim());
                const label = (
                  <td rowSpan={showCommon ? 2 : 1}>
                    <div className="fw-600">{r.label}</div>
                    {editable && (
                      <label className="checkbox text-sm mt-8">
                        <input type="checkbox" checked={cell.allWeek} onChange={(e) => patch(`grid.${r.key}.allWeek`, e.target.checked)} />
                        Gộp cả tuần
                      </label>
                    )}
                  </td>
                );
                if (cell.allWeek) {
                  return (
                    <tr key={r.key}>
                      {label}
                      <td colSpan={5}>
                        <CellInput
                          editable={editable}
                          value={cell.common}
                          rows={4}
                          label={`${r.label} cả tuần`}
                          onChange={(v) => patch(`grid.${r.key}.common`, v)}
                        />
                      </td>
                    </tr>
                  );
                }
                return (
                  <Fragment key={r.key}>
                    <tr>
                      {label}
                      {cell.days.map((v, i) => (
                        <td key={i}>
                          <CellInput
                            editable={editable}
                            value={v}
                            rows={4}
                            label={`${r.label} ${WEEKDAY_LABELS[i]}`}
                            onChange={(val) => patch(`grid.${r.key}.days.${i}`, val)}
                          />
                        </td>
                      ))}
                    </tr>
                    {showCommon && (
                      <tr>
                        <td colSpan={5}>
                          <div className="muted text-sm">Chung cả tuần (chơi tự do, chơi tự chọn, nêu gương…)</div>
                          <CellInput
                            editable={editable}
                            value={cell.common}
                            rows={2}
                            label={`${r.label} chung cả tuần`}
                            onChange={(val) => patch(`grid.${r.key}.common`, val)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function DayTab({ day, index, hocCell, editable, canEvaluate, today, teachers, nameOf, patch, userId }) {
  const p = `days.${index}`;
  const taught = day.date <= today;
  return (
    <>
      <Card
        title={`${WEEKDAY_LABELS[index]}, ngày ${fmtDate(day.date)}`}
        actions={
          editable && teachers.length > 1 ? (
            <select
              className="select"
              aria-label="Người soạn"
              value={day.assigneeId || ''}
              onChange={(e) => patch(`${p}.assigneeId`, e.target.value || null)}
            >
              <option value="">Người soạn: chưa phân công</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  Người soạn: {t.fullName}
                  {t.id === userId ? ' (bạn)' : ''}
                </option>
              ))}
            </select>
          ) : (
            day.assigneeId && <span className="muted text-sm">Người soạn: {nameOf(day.assigneeId)}</span>
          )
        }
      >
        <div className="stack">
          <div className="muted text-sm">Hoạt động học trong kế hoạch tuần:</div>
          <CellText text={hocCell} empty="Chưa ghi ở kế hoạch tuần" />
          <div className="ga-plan-grid">
            <div className="stack">
              <div className="fw-600">I. Mục đích, yêu cầu</div>
              <CellInput editable={editable} value={day.aims} rows={5} label="Mục đích, yêu cầu" onChange={(v) => patch(`${p}.aims`, v)} />
            </div>
            <div className="stack">
              <div className="fw-600">II. Chuẩn bị</div>
              <CellInput editable={editable} value={day.prep} rows={5} label="Chuẩn bị" onChange={(v) => patch(`${p}.prep`, v)} />
            </div>
          </div>
        </div>
      </Card>
      <Card title="III. Tiến trình hoạt động" bodyClass={null}>
        <div className="table-wrap">
          <table className="table ga-plan-table">
            <thead>
              <tr>
                <th>Hoạt động</th>
                <th>Hoạt động của cô</th>
                <th>Hoạt động của trẻ</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {DAY_STEPS.map((s) => {
                const step = day.steps[s.key];
                return (
                  <tr key={s.key}>
                    <td>
                      <div className="fw-600">{s.label}</div>
                      {s.key === 'hoc' &&
                        (editable ? (
                          <input
                            className="input mt-8"
                            placeholder="Đề tài, ví dụ: Thơ “Bạn mới”"
                            aria-label="Đề tài hoạt động học"
                            value={step.title}
                            onChange={(e) => patch(`${p}.steps.hoc.title`, e.target.value)}
                          />
                        ) : (
                          step.title && <div className="mt-8">{step.title}</div>
                        ))}
                      {s.hint && <div className="muted text-sm mt-8">{s.hint}</div>}
                    </td>
                    <td>
                      <CellInput
                        editable={editable}
                        value={step.teacher}
                        rows={10}
                        label={`${s.label}: hoạt động của cô`}
                        onChange={(v) => patch(`${p}.steps.${s.key}.teacher`, v)}
                      />
                    </td>
                    <td>
                      <CellInput
                        editable={editable}
                        value={step.child}
                        rows={10}
                        label={`${s.label}: hoạt động của trẻ`}
                        onChange={(v) => patch(`${p}.steps.${s.key}.child`, v)}
                      />
                    </td>
                    <td>
                      <CellInput
                        editable={editable}
                        value={step.note}
                        rows={3}
                        label={`${s.label}: ghi chú`}
                        onChange={(v) => patch(`${p}.steps.${s.key}.note`, v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Sau khi dạy">
        {!taught && <Notice>Ghi sau buổi dạy ngày {fmtDate(day.date)}.</Notice>}
        <div className="ga-plan-grid mt-8">
          <div className="stack">
            <div className="fw-600">Đánh giá trẻ trong ngày</div>
            <CellInput
              editable={canEvaluate && taught}
              value={day.evaluation}
              rows={4}
              placeholder="Nhận xét chung về trẻ: trẻ hứng thú, thực hiện được…"
              label="Đánh giá trẻ trong ngày"
              onChange={(v) => patch(`${p}.evaluation`, v)}
            />
          </div>
          <div className="stack">
            <div className="fw-600">Kế hoạch điều chỉnh và bổ sung</div>
            <CellInput
              editable={canEvaluate && taught}
              value={day.adjustment}
              rows={4}
              label="Kế hoạch điều chỉnh và bổ sung"
              onChange={(v) => patch(`${p}.adjustment`, v)}
            />
          </div>
        </div>
      </Card>
    </>
  );
}
