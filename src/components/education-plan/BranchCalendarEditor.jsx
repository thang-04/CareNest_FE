import { useRef, useState } from 'react';
import { branchWeeks, projectCalendar, teachingWeeks, takeTemplate } from '@/models/education-plan/branchCalendar.mjs';
import { previewClassCalendar } from '@/services/education-plan/educationPlanService';
import { durationRangeIssue } from '@/models/education-plan/goalTable';

export function BranchCalendarEditor({ plan, doc, editable, onChange, toast }) {
  const [busy, setBusy] = useState(false);
  const latest = useRef(doc);
  latest.current = doc;
  const patch = (key, fields) =>
    onChange(projectCalendar({ ...doc, branches: doc.branches.map((b) => (b.key === key ? { ...b, ...fields } : b)) }, plan));
  const remove = (key) => onChange(projectCalendar({ ...doc, branches: doc.branches.filter((b) => b.key !== key) }, plan));
  const limits = doc.durationPolicySnapshot;
  const schedules = [...(doc.themeSchedules || [])].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const move = async (index, delta) => {
    const order = schedules.map((s) => s.themeId);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    const snapshot = doc;
    setBusy(true);
    try {
      const result = await previewClassCalendar(
        { classId: doc.classId, yearPlanId: plan.id, expectedBranchVersion: doc.version ?? -1, draftCalendar: doc, orderedThemeIds: order },
        plan,
      );
      if (latest.current !== snapshot) return toast('Nội dung đã thay đổi trong lúc tính lịch. Vui lòng thử lại.', 'warn');
      onChange(projectCalendar({ ...doc, ...result.calendar }, plan));
    } catch (e) {
      toast(e.message || 'Chưa đổi được lịch', 'warn');
    } finally {
      setBusy(false);
    }
  };
  const resize = (branch, field, value) => {
    const parent = schedules.find((s) => String(s.themeId) === String(branch.themeId));
    if (value && (!parent || value < parent.startDate || value > parent.endDate))
      return toast('Ngày của nhánh phải nằm trong thời gian chủ đề lớn.', 'warn');
    patch(branch.key, { [field]: value });
  };
  return (
    <div className="stack">
      <p className="muted text-sm">
        {limits?.mode === 'BOUNDED'
          ? `Giới hạn hồ sơ: chủ đề ${limits.theme.minWeeks}–${limits.theme.maxWeeks} tuần; nhánh ${limits.branch.minWeeks}–${limits.branch.maxWeeks} tuần. `
          : 'Hồ sơ cũ giữ giới hạn đã áp dụng. '}
        Đổi thứ tự sẽ dời cả chủ đề và nhánh theo, giữ số tuần. Tên và nội dung chủ đề lớn lấy từ kế hoạch giáo dục tổ.
      </p>
      {schedules.map((schedule, i) => {
        const theme = plan.themes.find((t) => String(t.id) === String(schedule.themeId));
        if (!theme) return null;
        const templates = (plan.branchTemplates || []).filter((t) => String(t.themeId) === String(theme.id));
        const themeDuration =
          limits?.mode === 'BOUNDED'
            ? durationRangeIssue({ start: schedule.startDate, end: schedule.endDate }, plan.breaks || [], limits.theme, 'Chủ đề')
            : null;
        return (
          <section key={theme.id} className="stack">
            <div className="row gap-2">
              <strong>{theme.name}</strong>
              <span className="muted">
                {schedule.startDate || 'Chưa có ngày'} – {schedule.endDate || 'Chưa có ngày'}
              </span>
              {editable && (
                <>
                  <button
                    type="button"
                    className="btn btn--sm"
                    aria-label={`Dạy ${theme.name} sớm hơn`}
                    disabled={busy || i === 0 || schedules.some((s) => !s.startDate || !s.endDate)}
                    onClick={() => move(i, -1)}
                  >
                    Lên trước
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm"
                    aria-label={`Dạy ${theme.name} muộn hơn`}
                    disabled={busy || i === schedules.length - 1 || schedules.some((s) => !s.startDate || !s.endDate)}
                    onClick={() => move(i, 1)}
                  >
                    Xuống sau
                  </button>
                </>
              )}
            </div>
            {editable && (
              <div className="row gap-2">
                <label>
                  Từ ngày chủ đề
                  <input
                    className="input"
                    type="date"
                    value={schedule.startDate || ''}
                    onChange={(e) =>
                      onChange(
                        projectCalendar(
                          {
                            ...doc,
                            themeSchedules: doc.themeSchedules.map((s) =>
                              s.themeId === schedule.themeId ? { ...s, startDate: e.target.value } : s,
                            ),
                          },
                          plan,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Đến ngày chủ đề
                  <input
                    className="input"
                    type="date"
                    value={schedule.endDate || ''}
                    onChange={(e) =>
                      onChange(
                        projectCalendar(
                          {
                            ...doc,
                            themeSchedules: doc.themeSchedules.map((s) =>
                              s.themeId === schedule.themeId ? { ...s, endDate: e.target.value } : s,
                            ),
                          },
                          plan,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            )}
            {editable && themeDuration && (
              <div className="field__error" role="alert">
                {themeDuration}
              </div>
            )}
            {editable && (
              <div className="row gap-2">
                {templates.map((t) => {
                  const selected = doc.branches.find((b) => String(b.sourceTemplateId) === String(t.id));
                  return (
                    <label key={t.id} className="checkbox">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => {
                          if (selected) return remove(selected.key);
                          try {
                            onChange(takeTemplate(doc, plan, t));
                          } catch (e) {
                            toast(e.message, 'warn');
                          }
                        }}
                      />{' '}
                      Lấy mẫu: {t.name}
                    </label>
                  );
                })}
              </div>
            )}
            {editable && (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  const week = teachingWeeks(plan, doc).find(
                    (w) =>
                      String(w.theme.id) === String(theme.id) && !doc.branches.some((b) => w.start >= b.startDate && w.start <= b.endDate),
                  );
                  if (!week) return toast('Chủ đề đã đủ nhánh cho các tuần học. Bạn có thể chỉnh hoặc bỏ nhánh đang có.', 'warn');
                  const startDate = week.start;
                  const endDate = week.end;
                  onChange(
                    projectCalendar(
                      {
                        ...doc,
                        branches: [
                          ...doc.branches,
                          {
                            key: crypto.randomUUID(),
                            themeId: theme.id,
                            sourceTemplateId: null,
                            name: '',
                            startDate,
                            endDate,
                            weekNotes: {},
                          },
                        ],
                      },
                      plan,
                    ),
                  );
                }}
              >
                Thêm nhánh của lớp
              </button>
            )}
            {editable && (
              <div className="ga-branch-calendar-controls row row--wrap gap-2">
                {doc.branches
                  .filter((b) => String(b.themeId) === String(theme.id))
                  .map((b) => (
                    <div key={b.key} className="stack">
                      <span className="ga-branch-range-label">
                        {b.name || 'Nhánh chưa đặt tên'} · {branchWeeks(b, plan, doc).length} tuần
                      </span>
                      <div className="row gap-2">
                        <label>
                          Từ ngày
                          <input
                            className="input"
                            type="date"
                            aria-label={`Bắt đầu nhánh ${b.name}`}
                            min={schedule.startDate || undefined}
                            max={schedule.endDate || undefined}
                            value={b.startDate || ''}
                            onChange={(e) => resize(b, 'startDate', e.target.value)}
                          />
                        </label>
                        <label>
                          Đến ngày
                          <input
                            className="input"
                            type="date"
                            aria-label={`Kết thúc nhánh ${b.name}`}
                            min={b.startDate || schedule.startDate || undefined}
                            max={schedule.endDate || undefined}
                            value={b.endDate || ''}
                            onChange={(e) => resize(b, 'endDate', e.target.value)}
                          />
                        </label>
                        <button type="button" className="btn btn--sm" onClick={() => remove(b.key)}>
                          Bỏ nhánh
                        </button>
                      </div>
                      {limits?.mode === 'BOUNDED' &&
                        durationRangeIssue({ start: b.startDate, end: b.endDate }, plan.breaks || [], limits.branch, 'Nhánh') && (
                          <div className="field__error" role="alert">
                            {durationRangeIssue({ start: b.startDate, end: b.endDate }, plan.breaks || [], limits.branch, 'Nhánh')}
                          </div>
                        )}
                    </div>
                  ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
