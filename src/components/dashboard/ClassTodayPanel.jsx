import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenCheck, CalendarCheck, CheckCircle2, HeartPulse, School, Star } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useWidget, useLunchToday } from '@/hooks/dashboard/useDashboard';
import { SelectField } from '@/components/form/Field';
import { SegmentedProgress } from '@/components/ui/SegmentedProgress';
import { Spinner } from '@/components/ui/States';
import { Widget, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { DayProgress } from '@/components/dashboard/DayProgress';
import { AttentionWidget, LunchWidget } from '@/components/dashboard/TodayWidgets';
import { buildClassDay } from '@/services/dashboard/dashboardSummaryService';
import { getAttendanceClasses, getClassAttendance } from '@/services/attendance/attendanceService';
import { isClassTeacher } from '@/utils/attendance/attendancePermissions';
import { getPickupBoard } from '@/services/pickup/pickupService';
import { getEducationLessons } from '@/services/education-plan/educationPlanService';
import { getDailyAssessment, getEvaluations } from '@/services/assessment/assessmentService';
import { EDU_STATUS, isEduReviewPending } from '@/models/education-plan/educationPlanConstants';
import { EVAL_KIND, EVAL_STATUS, PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { todayInput } from '@/utils/format';

const endOf = (q, count) =>
  q.loading && q.data == null ? <Spinner small deferred /> : q.error ? <span className="muted">—</span> : <TaskCount value={count} />;
const metaOf = (q, text) => (q.error ? 'Không tải được – mở chức năng để xem' : text);

/** "Lớp X hôm nay": số có mặt, thanh chia, bên phải danh sách việc trong ngày (đánh dấu bước đã xong). */
function ClassTodayCard({ day, loading, error, onRetry }) {
  const att = day?.attendance;
  return (
    <Widget
      title={`${day?.className || 'Lớp'} hôm nay`}
      icon={CalendarCheck}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!att?.total}
      emptyTitle="Lớp chưa có trẻ"
      emptyText="Trẻ được xếp vào lớp sẽ hiện ở đây."
    >
      {att?.total > 0 && (
        <div className="db-today db-today--class">
          <div className="db-today__main">
            <p className="db-today__value">
              {att.present}
              <span className="db-today__unit"> / {att.total} trẻ có mặt</span>
            </p>
            <SegmentedProgress
              label="Điểm danh của lớp hôm nay"
              total={att.total}
              segments={[
                { key: 'present', label: 'Có mặt', value: att.present, tone: 'green' },
                { key: 'excused', label: 'Nghỉ có phép', value: att.excused, tone: 'orange' },
                { key: 'unexcused', label: 'Nghỉ không phép', value: att.unexcused, tone: 'red' },
                { key: 'missing', label: 'Chưa điểm danh', value: att.missing, tone: 'gray' },
              ]}
            />
            {day.allergic > 0 && <p className="db-today__campus-meta">{day.allergic} trẻ dị ứng thực phẩm</p>}
          </div>
          <div className="db-today__tasks">
            <b>Việc của bạn hôm nay</b>
            <ul>
              {day.steps.map((s) => (
                <li key={s.key} className={s.status === 'done' ? 'is-done' : ''}>
                  <Link to={s.to}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>{s.label}</span>
                    <span className="sr-only">{s.status === 'done' ? ' (đã xong)' : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Widget>
  );
}

/**
 * Trang chủ theo lớp (phương án A) của Giáo viên (#12) và phần lớp của Tổ trưởng (#13): lớp hôm nay → tiến độ 5 bước
 * → cần chú ý + việc khác của lớp · cột phải (`aside` của trang gọi) + bữa trưa + kế hoạch tuần.
 * Chỉ lớp được phân công (SRS 4.4 chú thích ²); số tính ở service buildClassDay, mỗi nguồn một lần gọi.
 */
export function ClassTodayPanel({ aside = null }) {
  const { user } = useAuth();
  const date = todayInput();
  const { schoolYear } = useSchoolYear();
  // Lớp được phân công lấy từ module điểm danh (BE: GET /attendance/classes, cờ teaches) — cùng nguồn màn Điểm danh
  const classesQ = useWidget(
    (u) => getAttendanceClasses(u, schoolYear).then((list) => list.filter((c) => isClassTeacher(c, u))),
    [schoolYear],
  );
  const classes = classesQ.data || [];
  const [picked, setPicked] = useState('');
  const classId = picked || classes[0]?.id || '';
  const enabled = { enabled: !!classId };
  const attendanceQ = useWidget((u) => getClassAttendance(classId, date, u), [classId, date], enabled);
  const pickupQ = useWidget((u) => getPickupBoard({ classId, date }, u).catch(() => null), [classId, date], enabled);
  const dailyQ = useWidget(
    (u) => getDailyAssessment({ classId, date, schoolYear }, u).catch(() => null),
    [classId, date, schoolYear],
    enabled,
  );
  const lessonsQ = useWidget(() => getEducationLessons().then((d) => d.lessons.filter((l) => l.classId === user.classId)), [user.classId]);
  const evaluationsQ = useWidget(
    (u) =>
      Promise.all([getEvaluations(EVAL_KIND.SEMESTER, { classId }, u), getEvaluations(EVAL_KIND.YEAR_END, { classId }, u)]).then((lists) =>
        lists.flat(),
      ),
    [classId],
    enabled,
  );
  const lunchQ = useLunchToday();

  if (classesQ.loading && !classesQ.data) return <Widget title="Lớp của bạn hôm nay" icon={School} loading />;
  if (classesQ.error) return <Widget title="Lớp của bạn hôm nay" icon={School} error={classesQ.error} onRetry={classesQ.reload} />;
  if (!classes.length) {
    return (
      <>
        <Widget
          title="Lớp của bạn hôm nay"
          icon={School}
          empty
          emptyTitle="Bạn chưa được phân công lớp"
          emptyText="Phó hiệu trưởng phân công lớp cho giáo viên. Khi có lớp, việc hằng ngày của lớp sẽ hiện ở đây."
        />
        {aside && <div className="db-board mt-16">{aside}</div>}
      </>
    );
  }

  const day = buildClassDay({ sheet: attendanceQ.data, pickup: pickupQ.data, daily: dailyQ.data });
  const loading = attendanceQ.loading && attendanceQ.data == null;
  const reload = () => {
    attendanceQ.reload();
    pickupQ.reload();
    dailyQ.reload();
  };
  const progressQ = {
    steps: day?.steps || [],
    loading: loading || (pickupQ.loading && pickupQ.data === undefined) || (dailyQ.loading && dailyQ.data === undefined),
    error: attendanceQ.error,
    reload,
  };
  const lessons = lessonsQ.data || [];
  const lessonsToFix = lessons.filter((l) => [EDU_STATUS.DRAFT, EDU_STATUS.REJECTED].includes(l.status)).length;
  const lessonsWaiting = lessons.filter((l) => isEduReviewPending(l.status)).length;
  const pendingEvaluations = (evaluationsQ.data || []).filter((e) => e.status !== EVAL_STATUS.CONFIRMED);
  const evaluationPath = pendingEvaluations.some((e) => e.periodType === PERIOD_TYPE.YEAR) ? 'year-end' : 'semester';
  const lesson = day?.lesson;

  return (
    <>
      {classes.length > 1 && (
        <div className="db-class-pick">
          <SelectField
            label="Lớp"
            value={classId}
            onChange={(e) => setPicked(e.target.value)}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      )}
      <div className="db-day">
        <ClassTodayCard day={day} loading={loading} error={attendanceQ.error} onRetry={reload} />
        <DayProgress q={progressQ} />
      </div>
      <div className="db-board">
        <div className="db-board__main">
          <AttentionWidget q={{ data: day, loading, error: attendanceQ.error, reload }} />
          <Widget title="Việc khác của lớp" icon={BookOpenCheck}>
            <ShortList
              rows={[
                {
                  key: 'lessons',
                  to: '/education/theme-plans',
                  icon: BookOpenCheck,
                  title: 'Kế hoạch giáo dục ngày của lớp',
                  meta: metaOf(lessonsQ, `Nháp hoặc bị từ chối cần hoàn thiện · ${lessonsWaiting} kế hoạch giáo dục ngày đang chờ duyệt`),
                  end: endOf(lessonsQ, lessonsToFix),
                },
                {
                  key: 'evaluations',
                  to: `/assessment/${evaluationPath}`,
                  icon: Star,
                  title: 'Đánh giá học kỳ / cuối năm',
                  meta: metaOf(evaluationsQ, 'Bản nháp AI chờ giáo viên duyệt hoặc chưa có bản nháp'),
                  end: endOf(evaluationsQ, pendingEvaluations.length),
                },
                {
                  key: 'health',
                  to: '/children/health-trends',
                  icon: HeartPulse,
                  title: 'Sức khỏe của trẻ',
                  meta: 'Ghi số đo, theo dõi xu hướng cân nặng – chiều cao',
                },
              ]}
            />
          </Widget>
        </div>
        <div className="db-board__aside">
          {aside}
          {/* Thực đơn đã công bố chỉ mở cho BGH (route /kitchen/published-menu): vai trò khác không đọc được thì ẩn khối */}
          {lunchQ.lunch?.menuLoaded && <LunchWidget q={lunchQ} />}
          <Widget
            title="Kế hoạch tuần này"
            icon={BookOpenCheck}
            loading={dailyQ.loading && dailyQ.data === undefined}
            empty={!lesson}
            emptyTitle="Chưa có kế hoạch tuần cho hôm nay"
            emptyText="Kế hoạch tuần đã duyệt của lớp sẽ hiện ở đây."
          >
            {lesson && (
              <ShortList
                rows={[
                  {
                    key: lesson.classDocId,
                    to: '/education/theme-plans',
                    icon: BookOpenCheck,
                    title: lesson.weekLabel,
                    meta: `${(lesson.activities || []).length} hoạt động hôm nay`,
                  },
                ]}
              />
            )}
          </Widget>
        </div>
      </div>
    </>
  );
}
