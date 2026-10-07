import { useState } from 'react';
import { ClipboardCheck, UtensilsCrossed, Baby, BookOpenCheck, Star, HeartPulse, Building2, CalendarCheck, School } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWidget } from '@/hooks/dashboard/useDashboard';
import { Spinner } from '@/components/ui/States';
import { Widget, KpiCard, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { getClasses, getChildren } from '@/services/schoolService';
import { getClassAttendance, getMealHandovers } from '@/services/attendance/attendanceService';
import { getPickupBoard } from '@/services/pickup/pickupService';
import { getEducationPlans } from '@/services/education-plan/educationPlanService';
import { getEvaluations } from '@/services/assessment/assessmentService';
import { getMyReports } from '@/services/facility/facilityService';
import { ATTENDANCE_STATUS, HANDOVER_STATUS } from '@/models/attendance/attendanceConstants';
import { PICKUP_STATUS } from '@/models/pickup/pickupConstants';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { EVAL_KIND, EVAL_STATUS } from '@/models/assessment/assessmentConstants';
import { ISSUE_STATUS, REQUEST_STATUS } from '@/models/facility/facilityConstants';
import { todayInput } from '@/utils/format';

const OPEN_REPORT = [ISSUE_STATUS.SUBMITTED, REQUEST_STATUS.SUBMITTED, REQUEST_STATUS.PENDING_PRINCIPAL];

/** Value at the end of a task row: spinner while loading, dash on error, else the count. */
const endOf = (q, count) =>
  q.loading && q.data == null ? <Spinner small /> : q.error ? <span className="muted">—</span> : <TaskCount value={count} />;
const metaOf = (q, text) => (q.error ? 'Không tải được – mở chức năng để xem' : text);

/**
 * Today's class tasks of a Teacher (#12) and of a Team Leader for their own class (#13):
 * attendance & meals, meal handover, pickup, lesson plans, evaluations, health, facilities.
 * Only classes the user teaches (SRS 4.4 footnote ²); each figure comes from its own service call.
 */
export function ClassTodayPanel() {
  const { user } = useAuth();
  const date = todayInput();
  const classesQ = useWidget((u) => getClasses({}, u).then((list) => list.filter((c) => (c.teacherIds || []).includes(u.id))));
  const classes = classesQ.data || [];
  const [picked, setPicked] = useState('');
  const classId = picked || classes[0]?.id || '';
  const cls = classes.find((c) => c.id === classId);

  const attendanceQ = useWidget((u) => getClassAttendance(classId, date, u), [classId, date], { enabled: !!classId });
  const handoverQ = useWidget((u) => getMealHandovers({ date }, u), [date], { enabled: !!classId });
  const pickupQ = useWidget((u) => getPickupBoard({ classId, date }, u), [classId, date], { enabled: !!classId });
  const childrenQ = useWidget((u) => getChildren({ classId, status: 'ACTIVE' }, u), [classId], { enabled: !!classId });
  const lessonsQ = useWidget(() => getEducationPlans().then((d) => d.lessons.filter((l) => l.classId === user.classId)), [user.classId]);
  const evaluationsQ = useWidget(
    (u) =>
      Promise.all([getEvaluations(EVAL_KIND.PERIODIC, { classId }, u), getEvaluations(EVAL_KIND.YEAR_END, { classId }, u)]).then(
        ([a, b]) => [...a, ...b],
      ),
    [classId],
    { enabled: !!classId },
  );
  const reportsQ = useWidget((u) => getMyReports(u));

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
  const toReceive = (handoverQ.data?.handovers || []).filter(
    (h) => h.classId === classId && [HANDOVER_STATUS.READY, HANDOVER_STATUS.SUPPLEMENTED].includes(h.status),
  ).length;
  const waitingPickup = (pickupQ.data?.rows || []).filter((r) => r.status === PICKUP_STATUS.WAITING).length;
  const lessons = lessonsQ.data || [];
  const lessonsToFix = lessons.filter((l) => [EDU_STATUS.DRAFT, EDU_STATUS.REJECTED].includes(l.status)).length;
  const lessonsWaiting = lessons.filter((l) => [EDU_STATUS.PENDING_TL, EDU_STATUS.PENDING_VP].includes(l.status)).length;
  const evaluationsToReview = (evaluationsQ.data || []).filter((e) => e.status !== EVAL_STATUS.CONFIRMED).length;
  const allergic = (childrenQ.data || []).filter((c) => (c.allergies || []).length).length;
  const reports = reportsQ.data ? [...reportsQ.data.issues, ...reportsQ.data.requests] : [];
  const openReports = reports.filter((r) => OPEN_REPORT.includes(r.status)).length;

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
          to="/attendance/meal-handover"
          tone={toReceive ? 'orange' : 'green'}
          label="Suất ăn chờ lớp nhận"
          value={toReceive}
          loading={handoverQ.loading && !handoverQ.data}
          error={handoverQ.error}
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
          hint={cls ? `Lớp ${cls.name}` : undefined}
          loading={childrenQ.loading && !childrenQ.data}
          error={childrenQ.error}
        />
      </div>

      <Widget title={`Việc hôm nay của lớp ${cls?.name || ''}`} icon={CalendarCheck}>
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
              key: 'handover',
              to: '/attendance/meal-handover',
              icon: UtensilsCrossed,
              title: 'Nhận suất ăn từ bếp',
              meta: metaOf(handoverQ, 'Bữa ăn bếp đã sẵn sàng, chờ lớp xác nhận nhận'),
              end: endOf(handoverQ, toReceive),
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
              to: '/education/lessons',
              icon: BookOpenCheck,
              title: 'Giáo án của lớp',
              meta: metaOf(lessonsQ, `Nháp hoặc bị từ chối cần hoàn thiện · ${lessonsWaiting} giáo án đang chờ duyệt`),
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
              to: '/assessment/periodic',
              icon: Star,
              title: 'Đánh giá tuần / tháng / cuối năm',
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
            {
              key: 'facility',
              to: '/facility/my-reports',
              icon: Building2,
              title: 'Báo sự cố & đề nghị CSVC',
              meta: metaOf(reportsQ, 'Báo cáo, đề nghị của bạn đang chờ xử lý'),
              end: endOf(reportsQ, openReports),
            },
          ]}
        />
      </Widget>
    </>
  );
}
