import { useState } from 'react';
import { CalendarDays, UserRound, ListChecks, Building2, UtensilsCrossed, BookOpenCheck, School, ShieldAlert, Wrench } from 'lucide-react';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useWidget, usePendingApprovals } from '@/hooks/dashboard/useDashboard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, KpiCard, Shortcuts, ShortList } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { IssueStatusBadge } from '@/components/facility/FacilityBadges';
import { getChildren } from '@/services/children/childrenService';
import { getCampusesWithStats } from '@/services/school-config/schoolConfigService';
import { getMealCounts } from '@/services/attendance/attendanceService';
import { getIssues } from '@/services/facility/facilityService';
import { getPublishedMenu } from '@/services/kitchen/kitchenService';
import { getEducationPlans } from '@/services/education-plan/educationPlanService';
import { CHILD_STATUS } from '@/models/School';
import { ISSUE_STATUS, ISSUE_TYPE_LABELS } from '@/models/facility/facilityConstants';
import { MEAL_SESSION_LABELS, MENU_TYPE } from '@/models/kitchen/kitchenConstants';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import '@/styles/modules/dashboard.css';

const firstLoad = (q) => q.loading && q.data == null;

/** Present / total of one campus today, from the first meal session count (attendance is shared by both sessions). */
const attendanceOf = (counts, campusId) => {
  const first = counts.find((c) => c.campusId === campusId && c.session === 'LUNCH') || counts.find((c) => c.campusId === campusId);
  if (!first) return null;
  const t = first.totals;
  return { present: t.present, total: t.present + t.absent + t.missing };
};

const SHORTCUTS = [
  { to: '/school/years', label: 'Cấu hình trường', icon: CalendarDays },
  { to: '/children', label: 'Quản lý trẻ', icon: UserRound },
  { to: '/approvals', label: 'Chờ duyệt', icon: ListChecks },
  { to: '/facility/issues', label: 'Giám sát cơ sở vật chất', icon: Building2 },
  { to: '/menu/plans', label: 'Kế hoạch thực đơn', icon: UtensilsCrossed },
];

/**
 * #10 Principal Dashboard (UC 3.1 View School-wide Dashboard): school-wide indicators with a campus filter
 * (the school year is the one chosen in the header) and entries to children, menu plans, facility issues
 * and lesson plans. Read-only: nothing is changed from here.
 */
export default function PrincipalDashboard() {
  const md = useMasterData();
  const { schoolYear } = useSchoolYear();
  const [campusId, setCampusId] = useState('');
  const date = todayInput();
  const approvals = usePendingApprovals();

  const childrenQ = useWidget((u) => getChildren({ schoolYear, campusId }, u), [schoolYear, campusId]);
  const campusesQ = useWidget((u) => getCampusesWithStats(schoolYear, u), [schoolYear]);
  const countsQ = useWidget((u) => getMealCounts({ date }, u), [date]);
  const issuesQ = useWidget((u) => getIssues({ campusId }, u), [campusId]);
  const menuQ = useWidget((u) => getPublishedMenu({ date, view: 'day' }, u), [date]);
  const eduQ = useWidget(() => getEducationPlans());

  const children = childrenQ.data || [];
  const active = children.filter((c) => c.status === CHILD_STATUS.ACTIVE).length;
  const allergyPending = children.filter((c) => c.allergyPending);
  const campuses = (campusesQ.data || []).filter((c) => !campusId || c.id === campusId);
  const classCount = campuses.reduce((n, c) => n + c.classCount, 0);
  const counts = countsQ.data?.counts || [];
  const attendance = campuses.map((c) => attendanceOf(counts, c.id)).filter(Boolean);
  const present = attendance.reduce((n, a) => n + a.present, 0);
  const expected = attendance.reduce((n, a) => n + a.total, 0);
  const issues = issuesQ.data || [];
  const openIssues = issues.filter((i) => i.status === ISSUE_STATUS.SUBMITTED).length;
  const approvalTotal = approvals.groups.reduce(
    (n, g) => n + g.items.filter((i) => !campusId || !i.campusId || i.campusId === campusId).length,
    0,
  );
  const lessons = eduQ.data?.lessons || [];
  const themes = eduQ.data?.themes || [];
  const sessionsMenu = (menuQ.data?.[0]?.sessions || []).filter((s) => s.menus.length);

  return (
    <div className="page">
      <DashboardHeader subtitle={`Toàn trường · Năm học ${String(schoolYear || '').replace('-', ' – ')}`}>
        <div className="field">
          <label className="field__label" htmlFor="db-campus">
            Điểm trường
          </label>
          <select id="db-campus" className="select" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            <option value="">Tất cả điểm trường</option>
            {md.campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </DashboardHeader>
      <Shortcuts links={SHORTCUTS} />

      <div className="stat-grid">
        <KpiCard to="/children" tone="blue" label="Trẻ đang học" value={active} loading={firstLoad(childrenQ)} error={childrenQ.error} />
        <KpiCard
          to="/school/classes"
          tone="blue"
          label="Lớp học"
          value={classCount}
          loading={firstLoad(campusesQ)}
          error={campusesQ.error}
        />
        <KpiCard
          to="/attendance/summary"
          tone="green"
          label="Có mặt hôm nay"
          value={expected ? `${present}/${expected}` : '—'}
          hint={expected ? undefined : 'Hôm nay chưa có số liệu điểm danh'}
          loading={firstLoad(countsQ) || firstLoad(campusesQ)}
          error={countsQ.error}
        />
        <KpiCard
          to="/approvals"
          tone="purple"
          label="Chờ bạn phê duyệt"
          value={approvalTotal}
          hint={approvals.failed.length ? `${approvals.failed.length} nhóm không tải được` : undefined}
          loading={approvals.loading && !approvals.groups.length}
          error={approvals.error}
        />
        <KpiCard
          to="/facility/issues"
          tone="red"
          label="Sự cố CSVC chờ xử lý"
          value={openIssues}
          loading={firstLoad(issuesQ)}
          error={issuesQ.error}
        />
        <KpiCard
          to="/children"
          tone="orange"
          label="Dị ứng chờ bạn xác nhận"
          value={allergyPending.length}
          loading={firstLoad(childrenQ)}
          error={childrenQ.error}
        />
      </div>

      <div className="db-grid db-grid--wide">
        <Widget
          title="Tổng quan điểm trường"
          icon={School}
          to="/school/campuses"
          linkLabel="Danh sách điểm trường"
          loading={firstLoad(campusesQ)}
          error={campusesQ.error}
          onRetry={campusesQ.reload}
          empty={!campuses.length}
          emptyTitle="Chưa có dữ liệu cho phạm vi đã chọn"
          emptyText="Đổi năm học ở thanh trên cùng hoặc chọn điểm trường khác."
        >
          <div className="table-wrap">
            <table className="table table--compact">
              <caption className="sr-only">Số lớp, số trẻ và tỷ lệ có mặt hôm nay theo điểm trường</caption>
              <thead>
                <tr>
                  <th scope="col">Điểm trường</th>
                  <th scope="col" className="right">
                    Lớp
                  </th>
                  <th scope="col" className="right">
                    Trẻ
                  </th>
                  <th scope="col">Có mặt hôm nay</th>
                  <th scope="col">Phó hiệu trưởng</th>
                </tr>
              </thead>
              <tbody>
                {campuses.map((c) => {
                  const a = attendanceOf(counts, c.id);
                  return (
                    <tr key={c.id}>
                      <td className="fw-600">{c.shortName || c.name}</td>
                      <td className="right">{c.classCount}</td>
                      <td className="right">{c.childCount}</td>
                      <td>
                        {countsQ.error ? (
                          <span className="muted">Không tải được</span>
                        ) : a && a.total ? (
                          <ProgressBar value={a.present} total={a.total} tone="green" />
                        ) : (
                          <span className="muted">Chưa có số liệu</span>
                        )}
                      </td>
                      <td>{c.vicePrincipals.map((v) => v.fullName).join(', ') || <span className="muted">Chưa phân công</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Widget>
        <ApprovalsWidget approvals={approvals} campusId={campusId} />
      </div>

      <div className="db-grid">
        <Widget
          title="Sự cố cơ sở vật chất mới nhất"
          icon={Wrench}
          to="/facility/issues"
          loading={firstLoad(issuesQ)}
          error={issuesQ.error}
          onRetry={issuesQ.reload}
          empty={!issues.length}
          emptyTitle="Chưa có báo cáo sự cố"
          emptyText="Báo cáo của giáo viên và nhân viên bếp sẽ hiện ở đây."
        >
          <ShortList
            rows={issues.slice(0, 5).map((i) => ({
              key: i.id,
              to: `/facility/issues/${i.id}`,
              code: i.code,
              title: `${ISSUE_TYPE_LABELS[i.type] || ''}: ${i.assetName}`,
              meta: `${md.campusById(i.campusId)?.shortName || ''} · ${formatDateTime(i.createdAt)}`,
              end: <IssueStatusBadge status={i.status} />,
            }))}
          />
        </Widget>

        <Widget
          title={`Thực đơn hôm nay, ${formatDate(date)}`}
          icon={UtensilsCrossed}
          to="/menu/plans"
          linkLabel="Xem kế hoạch thực đơn"
          loading={firstLoad(menuQ)}
          error={menuQ.error}
          onRetry={menuQ.reload}
          empty={!sessionsMenu.length}
          emptyTitle="Chưa có thực đơn công bố cho hôm nay"
        >
          {sessionsMenu.map((s) => {
            const normal = s.menus.filter((m) => m.type !== MENU_TYPE.ALLERGY);
            const dishes = [...new Set(normal.flatMap((m) => m.dishes.map((d) => d.name)))];
            const allergyMenus = s.menus.length - normal.length;
            return (
              <div key={s.session} className="db-session">
                <div className="db-session__head">
                  <span className="subsection-title">{MEAL_SESSION_LABELS[s.session] || s.session}</span>
                  {allergyMenus > 0 && <span className="chip chip--orange">{allergyMenus} thực đơn thay thế</span>}
                </div>
                <div className="db-dishes">
                  {dishes.map((name) => (
                    <span key={name} className="chip chip--gray">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </Widget>
      </div>

      <div className="db-grid">
        <Widget
          title="Kế hoạch giáo dục toàn trường"
          icon={BookOpenCheck}
          loading={firstLoad(eduQ)}
          error={eduQ.error}
          onRetry={eduQ.reload}
          to="/education/school"
          linkLabel="Xem kế hoạch"
        >
          <ShortList
            rows={[
              {
                key: 'themes',
                to: '/education/school',
                title: 'Kế hoạch chủ đề đã duyệt',
                meta: `${themes.filter((t) => t.status === EDU_STATUS.PENDING_VP).length} kế hoạch đang chờ Phó hiệu trưởng duyệt`,
                end: <span className="db-count">{themes.filter((t) => t.status === EDU_STATUS.APPROVED).length}</span>,
              },
              {
                key: 'lessons',
                to: '/education/school',
                title: 'Giáo án đã duyệt',
                meta: `${lessons.filter((l) => [EDU_STATUS.PENDING_TL, EDU_STATUS.PENDING_VP].includes(l.status)).length} giáo án đang chờ duyệt`,
                end: <span className="db-count">{lessons.filter((l) => l.status === EDU_STATUS.APPROVED).length}</span>,
              },
            ]}
          />
        </Widget>

        <Widget
          title="Khai báo dị ứng chờ xác nhận"
          icon={ShieldAlert}
          to="/children"
          linkLabel="Danh sách trẻ"
          loading={firstLoad(childrenQ)}
          error={childrenQ.error}
          onRetry={childrenQ.reload}
          empty={!allergyPending.length}
          emptyTitle="Không có khai báo dị ứng chờ xác nhận"
          emptyText="Dị ứng thực phẩm do Hiệu trưởng xác nhận trước khi bếp áp dụng thực đơn thay thế."
        >
          <ShortList
            rows={allergyPending.slice(0, 5).map((c) => ({
              key: c.id,
              to: `/children/${c.id}/health-declaration`,
              code: c.code,
              title: c.fullName,
              meta: `${c.className || 'Chưa xếp lớp'} · ${md.campusById(c.campusId)?.shortName || ''}`,
            }))}
          />
        </Widget>
      </div>
    </div>
  );
}
