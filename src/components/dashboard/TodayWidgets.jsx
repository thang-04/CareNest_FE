import { AlertTriangle, BarChart3 } from '@/components/ui/icons';
import { Widget } from '@/components/dashboard/DashboardWidgets';
import { AttentionList } from '@/components/dashboard/AttentionList';
import { RankBars } from '@/components/charts/RankBars';
import { shortClassName } from '@/services/dashboard/dashboardSummaryService';

const firstLoad = (q) => q.loading && q.data == null;

/** Khối "Cần chú ý hôm nay" của dashboard BGH; q = useDashboardToday(). */
export function AttentionWidget({ q }) {
  const items = q.data?.attention || [];
  return (
    <Widget
      title="Cần chú ý hôm nay"
      icon={AlertTriangle}
      loading={firstLoad(q)}
      error={q.error}
      onRetry={q.reload}
      empty={!items.length}
      emptyTitle="Hôm nay chưa có gì cần chú ý"
      emptyText="Lớp chưa điểm danh, trẻ cần lưu ý khi khám đầu ngày và trẻ nghỉ không phép sẽ hiện ở đây."
    >
      <AttentionList items={items} />
    </Widget>
  );
}

/** Xếp hạng tỷ lệ có mặt theo lớp (lớp chưa điểm danh đứng đầu). `limit` = chỉ lấy n lớp thấp nhất, kèm tên điểm trường. */
export function ClassRankWidget({ q, limit, campusName }) {
  const date = q.data?.date;
  const classes = q.data?.classes || [];
  const shown = limit ? classes.slice(0, limit) : classes;
  const title = limit ? 'Lớp có tỷ lệ có mặt thấp nhất hôm nay' : 'Chuyên cần hôm nay theo lớp';
  return (
    <Widget
      title={title}
      icon={BarChart3}
      to="/attendance/summary"
      linkLabel="Tổng hợp điểm danh"
      loading={firstLoad(q)}
      error={q.error}
      onRetry={q.reload}
      empty={!classes.length}
      emptyTitle="Chưa có lớp trong phạm vi của bạn"
      emptyText="Lớp được phân công cho điểm trường sẽ hiện ở đây."
    >
      <p className="muted text-sm mc-rank__note">Lớp chưa điểm danh và lớp có tỷ lệ thấp đứng đầu. Bấm một lớp để xem điểm danh của lớp.</p>
      <RankBars
        caption={title}
        rows={shown.map((c) => ({
          key: c.classId,
          label: shortClassName(c.className),
          meta: campusName ? campusName(c.campusId) : null,
          value: c.present,
          total: c.size,
          pending: !c.taken,
          to: `/attendance/summary?classId=${c.classId}&from=${date}&to=${date}`,
        }))}
      />
    </Widget>
  );
}
