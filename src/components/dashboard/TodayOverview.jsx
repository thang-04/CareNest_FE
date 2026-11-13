import { CalendarCheck } from '@/components/ui/icons';
import { Tabs } from '@/components/ui/Tabs';
import { SegmentedProgress } from '@/components/ui/SegmentedProgress';
import { EmptyState } from '@/components/ui/States';
import { Widget } from '@/components/dashboard/DashboardWidgets';
import { attendanceCompareText } from '@/services/dashboard/dashboardSummaryService';

const ALL = 'all';

/** Thẻ một điểm trường: có mặt / sĩ số và số lớp đã điểm danh (số do service gom). */
function CampusCard({ c }) {
  const missing = c.classes - c.taken;
  return (
    <div className="db-today__campus">
      <div className="db-today__campus-head">
        <b>{c.name}</b>
        <span className="muted text-sm">{c.classes} lớp</span>
      </div>
      <p className="db-today__campus-value">
        {c.present}
        <span className="db-today__unit"> / {c.total} có mặt</span>
      </p>
      <SegmentedProgress
        compact
        label={`Có mặt ${c.name}`}
        total={c.total}
        text=""
        segments={[
          { key: 'present', label: 'Có mặt', value: c.present, tone: 'green' },
          { key: 'rest', label: 'Còn lại', value: c.total - c.present, tone: 'rest' },
        ]}
      />
      <p className="db-today__campus-meta">
        {missing ? (
          <span className="chip chip--red">{missing} lớp</span>
        ) : (
          <span className="chip chip--green">
            Đủ {c.taken}/{c.classes} lớp
          </span>
        )}{' '}
        {missing ? 'chưa điểm danh' : 'đã điểm danh'}
      </p>
    </div>
  );
}

/**
 * "Hôm nay" (trang chủ phương án A): số có mặt lớn, thanh chia có mặt / có phép / không phép / chưa điểm danh,
 * so với cùng thứ tuần trước, thẻ từng điểm trường. campuses = danh mục để lọc; chỉ hiện khi phạm vi có ≥2 điểm trường.
 */
export function TodayOverview({ q, title, campuses = [], campusId = '', onCampusChange }) {
  const att = q.data?.attendance;
  const byCampus = q.data?.campuses || [];
  const compare = attendanceCompareText(att);
  const showFilter = onCampusChange && campuses.length > 1;
  return (
    <Widget
      title={title}
      icon={CalendarCheck}
      loading={q.loading && q.data == null}
      error={q.error}
      onRetry={q.reload}
      actions={
        showFilter && (
          <Tabs
            variant="pill"
            className="db-today__filter"
            ariaLabel="Lọc theo điểm trường"
            value={campusId || ALL}
            onChange={(key) => onCampusChange(key === ALL ? '' : key)}
            items={[{ key: ALL, label: 'Toàn trường' }, ...campuses.map((c) => ({ key: c.id, label: c.shortName || c.name }))]}
          />
        )
      }
    >
      {/* Rỗng vẫn giữ bộ lọc điểm trường để đổi lại phạm vi */}
      {!att?.total && (
        <EmptyState
          title="Hôm nay chưa có số liệu điểm danh"
          description="Số trẻ có mặt, nghỉ có phép, nghỉ không phép sẽ hiện sau khi lớp điểm danh."
        />
      )}
      {att?.total > 0 && (
        <div className={`db-today ${!campusId && byCampus.length > 1 ? 'db-today--split' : ''}`}>
          <div className="db-today__main">
            <p className="db-today__value">
              {att.present}
              <span className="db-today__unit"> / {att.total} trẻ có mặt</span>
            </p>
            {compare && <p className="db-today__compare">{compare}</p>}
            <SegmentedProgress
              label="Điểm danh hôm nay"
              total={att.total}
              segments={[
                { key: 'present', label: 'Có mặt', value: att.present, tone: 'green' },
                { key: 'excused', label: 'Nghỉ có phép', value: att.excused, tone: 'orange' },
                { key: 'unexcused', label: 'Nghỉ không phép', value: att.unexcused, tone: 'red' },
                { key: 'missing', label: 'Chưa điểm danh', value: att.missing, tone: 'gray' },
              ]}
            />
          </div>
          {!campusId && byCampus.length > 1 && byCampus.map((c) => <CampusCard key={c.campusId} c={c} />)}
        </div>
      )}
    </Widget>
  );
}
