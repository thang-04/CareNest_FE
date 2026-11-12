import { useState } from 'react';
import { ClipboardCheck, Baby, BookOpenCheck, Star, HeartPulse, CalendarCheck, School } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useWidget } from '@/hooks/dashboard/useDashboard';
import { Spinner } from '@/components/ui/States';
import { Widget, KpiCard, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { getChildren } from '@/services/schoolService';
import { getAttendanceClasses, getClassAttendance } from '@/services/attendance/attendanceService';
import { isClassTeacher } from '@/utils/attendance/attendancePermissions';
import { getPickupBoard } from '@/services/pickup/pickupService';
import { getEducationLessons } from '@/services/education-plan/educationPlanService';
import { getEvaluations } from '@/services/assessment/assessmentService';
import { ATTENDANCE_STATUS } from '@/models/attendance/attendanceConstants';
import { PICKUP_STATUS } from '@/models/pickup/pickupConstants';
import { EDU_STATUS, isEduReviewPending } from '@/models/education-plan/educationPlanConstants';
import { EVAL_KIND, EVAL_STATUS, PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { todayInput } from '@/utils/format';
import { needsDemoLabel } from '@/services/demoSource';
/** Value at the end of a task row: spinner while loading, dash on error, else the count. */
const endOf = (q, count) =>
  q.loading && q.data == null ? <Spinner small deferred /> : q.error ? <span className="muted">—</span> : <TaskCount value={count} />;
const metaOf = (q, text) => (q.error ? 'Không tải được – mở chức năng để xem' : text);

/**
 * Today's class tasks of a Teacher (#12) and of a Team Leader for their own class (#13):
 * attendance & meals, pickup, lesson plans, evaluations, health.
 * Only classes the user teaches (SRS 4.4 footnote ²); each figure comes from its own service call.
 */
export function ClassTodayPanel() {
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
  const cls = classes.find((c) => c.id === classId);
  const attendanceQ = useWidget((u) => getClassAttendance(classId, date, u), [classId, date], {
    enabled: !!classId,
  });
  const pickupQ = useWidget(
    (u) =>
      getPickupBoard(
        {
          classId,
          date,
        },
        u,
      ),
    [classId, date],
    {
      enabled: !!classId,
    },
  );
  const childrenQ = useWidget(
    (u) =>
      getChildren(
        {
          classId,
          status: 'ACTIVE',
        },
        u,
      ),
    [classId],
    {
      enabled: !!classId,
    },
  );
  const lessonsQ = useWidget(() => getEducationLessons().then((d) => d.lessons.filter((l) => l.classId === user.classId)), [user.classId]);
  const evaluationsQ = useWidget(
    (u) =>
      Promise.all([
        getEvaluations(
          EVAL_KIND.SEMESTER,
          {
            classId,
          },
          u,
        ),
        getEvaluations(
          EVAL_KIND.YEAR_END,
          {
            classId,
          },
          u,
        ),
      ]).then((lists) => lists.flat()),
    [classId],
    {
      enabled: !!classId,
    },
  );
  if (classesQ.loading && !classesQ.data) {
    return <Widget title="Việc hôm nay của lớp" icon={School} loading />;
  }
  if (classesQ.error) {
    return <Widget title="Việc hôm nay của lớp" icon={School} error={classesQ.error} onRetry={classesQ.reload} />;
  }
  if (!classes.length) {
    return (
      <Widget
        title="Việc hôm nay của lớp"
        icon={School}
        empty
        emptyTitle="Bạn chưa được phân công lớp"
        emptyText="Phó hiệu trưởng phân công lớp cho giáo viên. Khi có lớp, việc hằng ngày của lớp sẽ hiện ở đây."
      />
    );
  }
  const sheet = attendanceQ.data;
  const rows = sheet?.children || [];
  const recorded = rows.filter((r) => r.record).length;
  const present = rows.filter((r) => r.record?.status === ATTENDANCE_STATUS.PRESENT).length;
  const waitingPickup = (pickupQ.data?.rows || []).filter((r) => r.status === PICKUP_STATUS.WAITING).length;
  const lessons = lessonsQ.data || [];
  const lessonsToFix = lessons.filter((l) => [EDU_STATUS.DRAFT, EDU_STATUS.REJECTED].includes(l.status)).length;
  const lessonsWaiting = lessons.filter((l) => isEduReviewPending(l.status)).length;
  const pendingEvaluations = (evaluationsQ.data || []).filter((e) => e.status !== EVAL_STATUS.CONFIRMED);
  const evaluationsToReview = pendingEvaluations.length;
  // Chỉ dẫn tới các màn học kỳ và cuối năm còn sử dụng.
  const evaluationKind =
    [PERIOD_TYPE.YEAR, PERIOD_TYPE.SEMESTER].find((t) => pendingEvaluations.some((e) => e.periodType === t)) || PERIOD_TYPE.SEMESTER;
  const allergic = (childrenQ.data || []).filter((c) => (c.allergies || []).length).length;
  const schoolDay = sheet ? sheet.schoolDay : true;
  const attendanceHint = !sheet
    ? undefined
    : !schoolDay
      ? 'Hôm nay không phải ngày học'
      : sheet.locked
        ? `Đã chốt lúc ${sheet.cutoff}`
        : `Chốt điểm danh lúc ${sheet.cutoff}`;
  return (
    <>
      {needsDemoLabel('school-lookup') && (
        <div className="alert alert--warning mb-16" role="status">
          <span>
            <strong>Dữ liệu demo</strong> — số trẻ dị ứng, đón trẻ trong khung này là dữ liệu mẫu, chưa nối hệ thống CareNest.
          </span>
        </div>
      )}
      {classes.length > 1 && (
        <div className="db-head__filters mb-16">
          <div className="field">
            <label className="field__label" htmlFor="db-class">
              Lớp
            </label>
            <select id="db-class" className="select" value={classId} onChange={(e) => setPicked(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="stat-grid">
        <KpiCard
          to={`/attendance?classId=${classId}`}
          tone={schoolDay && rows.length && recorded < rows.length ? 'orange' : 'green'}
          label="Đã điểm danh"
          value={`${recorded}/${rows.length}`}
          hint={attendanceHint}
          loading={attendanceQ.loading && !sheet}
          error={attendanceQ.error}
        />
        <KpiCard
          to={`/attendance/summary?classId=${classId}`}
          tone="blue"
          label="Trẻ có mặt hôm nay"
          value={present}
          loading={attendanceQ.loading && !sheet}
          error={attendanceQ.error}
        />
        <KpiCard
          to={`/pickup?classId=${classId}`}
          tone={waitingPickup ? 'purple' : 'green'}
          label="Trẻ chờ đón"
          value={waitingPickup}
          loading={pickupQ.loading && !pickupQ.data}
          error={pickupQ.error}
        />
        <KpiCard
          to="/children"
          tone={allergic ? 'red' : 'blue'}
          label="Trẻ có dị ứng thực phẩm"
          value={allergic}
          hint={cls?.name}
          loading={childrenQ.loading && !childrenQ.data}
          error={childrenQ.error}
        />
      </div>

      <Widget title={`Việc hôm nay của ${cls?.name || 'lớp'}`} icon={CalendarCheck}>
        <ShortList
          rows={[
            {
              key: 'attendance',
              to: `/attendance?classId=${classId}`,
              icon: ClipboardCheck,
              title: 'Điểm danh & báo ăn',
              meta: metaOf(
                attendanceQ,
                schoolDay ? `Còn ${Math.max(rows.length - recorded, 0)} trẻ chưa điểm danh` : 'Hôm nay không phải ngày học',
              ),
              end: endOf(attendanceQ, Math.max(rows.length - recorded, 0)),
            },
            {
              key: 'pickup',
              to: `/pickup?classId=${classId}`,
              icon: Baby,
              title: 'Trả trẻ cho người đón',
              meta: metaOf(pickupQ, 'Trẻ có mặt chưa được đón'),
              end: endOf(pickupQ, waitingPickup),
            },
            {
              key: 'lessons',
              to: '/education/theme-plans',
              icon: BookOpenCheck,
              title: 'Kế hoạch giáo dục ngày của lớp',
              meta: metaOf(lessonsQ, `Nháp hoặc bị từ chối cần hoàn thiện · ${lessonsWaiting} kế hoạch giáo dục ngày đang chờ duyệt`),
              end: endOf(lessonsQ, lessonsToFix),
            },
            {
              key: 'daily',
              to: '/assessment/daily',
              icon: Star,
              title: 'Đánh giá hằng ngày',
              meta: 'Ghi nhận sức khỏe, cảm xúc và tiêu chí đạt của trẻ hôm nay',
            },
            {
              key: 'evaluations',
              to: `/assessment/${{ [PERIOD_TYPE.YEAR]: 'year-end', [PERIOD_TYPE.SEMESTER]: 'semester' }[evaluationKind] || 'semester'}`,
              icon: Star,
              title: 'Đánh giá học kỳ / cuối năm',
              meta: metaOf(evaluationsQ, 'Bản nháp AI chờ giáo viên duyệt hoặc chưa có bản nháp'),
              end: endOf(evaluationsQ, evaluationsToReview),
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
    </>
  );
}
