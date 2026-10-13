import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Buildings, Eye, HeartPulse, Info } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { DailyHealthHistoryModal } from '@/components/attendance/DailyHealthHistoryModal';
import { useChildDailyHealthHistory, useDailyHealthOverview } from '@/hooks/attendance/useDailyHealthOverview';
import { ROLES } from '@/models/User';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { formatTemperature, symptomLabels } from '@/utils/dailyHealthValidation';
import { formatDate, formatDateTime, isIsoDate } from '@/utils/format';
import '@/styles/modules/attendance.css';

const timeOf = (iso) => formatDateTime(iso).split(' ')[1] || '—';

function StatTiles({ totals }) {
  return (
    <div className="dd-stats mb-16">
      <div className="dd-stat">
        <span className="dd-stat__value">{totals.present}</span>
        <span className="dd-stat__label">Có mặt</span>
      </div>
      <div className="dd-stat dd-stat--blue">
        <span className="dd-stat__value">{totals.checked}</span>
        <span className="dd-stat__label">Đã kiểm tra</span>
      </div>
      <div className="dd-stat dd-stat--orange">
        <span className="dd-stat__value">{totals.noted}</span>
        <span className="dd-stat__label">Có dấu hiệu cần lưu ý</span>
      </div>
      <div className="dd-stat dd-stat--gray">
        <span className="dd-stat__value">{totals.notified}</span>
        <span className="dd-stat__label">Đã báo phụ huynh</span>
      </div>
    </div>
  );
}

function ClassTable({ rows, loading, showCampus, campusName, filters }) {
  return (
    <div className="card mb-16">
      <div className="card__header dd-hov__head">
        <h2 className="card__title">Theo lớp</h2>
        {filters}
      </div>
      <div className="table-wrap dd-table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Lớp</th>
              <th className="right">Sĩ số</th>
              <th className="right">Có mặt</th>
              <th className="right">Đã kiểm tra</th>
              <th className="right">Có dấu hiệu</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows rows={4} cols={5} />
            ) : (
              rows.map((row) => (
                <tr key={row.classId}>
                  <td>
                    <div className="fw-600">{row.className}</div>
                    {showCampus && <div className="muted text-xs">{campusName(row.campusId)}</div>}
                  </td>
                  <td className="right">{row.size}</td>
                  <td className="right">{row.present}</td>
                  <td className="right nowrap">
                    {row.checked}/{row.present}
                  </td>
                  <td className="right fw-600">{row.noted || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttentionTable({ items, filtered, onClearFilter, onOpen }) {
  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">
          <HeartPulse size={20} /> Trẻ cần chú ý
        </h2>
      </div>
      {items.length === 0 ? (
        filtered ? (
          <EmptyState
            title="Không có trẻ cần chú ý theo bộ lọc đang chọn"
            action={
              <button className="btn btn--sm mt-8" type="button" onClick={onClearFilter}>
                Đặt lại bộ lọc
              </button>
            }
          />
        ) : (
          <EmptyState
            title="Không có trẻ cần chú ý"
            description="Trẻ được giáo viên ghi nhận Có dấu hiệu cần lưu ý trong ngày đã chọn sẽ hiển thị tại đây."
          />
        )
      ) : (
        <div className="table-wrap dd-table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Trẻ</th>
                <th>Lớp</th>
                <th className="right">Thân nhiệt</th>
                <th>Biểu hiện</th>
                <th>Ghi chú</th>
                <th>Thông báo phụ huynh</th>
                <th>Giáo viên</th>
                <th>Giờ</th>
                <th className="right">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                // Bấm cả dòng để xem chi tiết; nút cuối dòng giữ cho bàn phím
                <tr key={item.childId} className="dd-hov__row" onClick={() => onOpen(item)}>
                  <td className="nowrap">
                    <div className="fw-600">{item.childName}</div>
                    {item.childCode && <div className="muted text-xs">{item.childCode}</div>}
                  </td>
                  <td className="nowrap">{item.className}</td>
                  <td className="right nowrap">
                    {formatTemperature(item.temperature)}
                    {item.readingCount > 1 && (
                      <div className="muted text-xs">
                        {item.readingCount} lần (
                        {item.temperatureTrail.map((t) => (Number.isFinite(t) ? t.toLocaleString('vi-VN') : '—')).join(' → ')})
                      </div>
                    )}
                  </td>
                  <td>{symptomLabels(item.symptoms) || '—'}</td>
                  <td className="dd-hov__note">{item.note || '—'}</td>
                  <td>
                    {item.notificationStatus === 'DEMO_QUEUED' ? (
                      <span className="chip chip--blue">Đã gửi{item.notifiedAt ? ` · ${timeOf(item.notifiedAt)}` : ''}</span>
                    ) : (
                      <span className="chip chip--orange">Chưa gửi được</span>
                    )}
                  </td>
                  <td className="nowrap">{item.recordedByName}</td>
                  <td className="nowrap">{timeOf(item.recordedAt)}</td>
                  <td className="right">
                    <button
                      className="icon-btn"
                      type="button"
                      title="Xem chi tiết"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(item);
                      }}
                      aria-label={`Xem chi tiết sức khỏe của ${item.childName}`}
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Sức khỏe đầu ngày: Hiệu trưởng xem toàn trường, Phó hiệu trưởng xem điểm trường của mình; chỉ xem. */
export default function DailyHealthOverviewPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const paramDate = params.get('date');
  const date = isIsoDate(paramDate) && paramDate <= today ? paramDate : today;
  const isPrincipal = user?.role === ROLES.PRINCIPAL;
  const campusId = isPrincipal ? params.get('campusId') || '' : '';
  const ageGroupId = params.get('ageGroupId') || '';
  const classId = params.get('classId') || '';
  const [detail, setDetail] = useState(null);
  const { overview, loading, error, reload } = useDailyHealthOverview({ date, campusId, ageGroupId, classId });
  const history = useChildDailyHealthHistory({ childId: detail?.childId, date });

  // Giữ danh sách lựa chọn của lần tải trước để ô lọc không nhấp nháy khi đang tải lại
  const lastOptions = useRef(null);
  if (overview?.options) lastOptions.current = overview.options;
  const options = lastOptions.current || { ageGroups: [], classes: [] };
  const classOptions = options.classes.filter((c) => !ageGroupId || c.ageGroupId === ageGroupId);

  // Đổi ngày giữ bộ lọc; đổi điểm trường / nhóm tuổi thì bỏ lọc phía dưới
  const update = (next) =>
    setParams(Object.fromEntries(Object.entries({ date, campusId, ageGroupId, classId, ...next }).filter(([, v]) => v)), {
      replace: true,
    });
  const filtered = !!(ageGroupId || classId);
  const clearFilters = () => update({ ageGroupId: '', classId: '' });

  const campusName = (id) => md.campusById?.(id)?.name || id;
  const forbidden = error?.status === 403;

  // Lọc nhóm tuổi / lớp đặt ngay đầu bảng "Theo lớp" (gần dữ liệu, đỡ cuộn); áp cho số tổng, bảng lớp và trẻ cần chú ý
  const filterBar = (
    <div className="dd-hov__filters" role="group" aria-label="Lọc theo nhóm tuổi và lớp">
      <select
        className="select"
        aria-label="Nhóm tuổi"
        value={ageGroupId}
        onChange={(e) => update({ ageGroupId: e.target.value, classId: '' })}
      >
        <option value="">Tất cả nhóm tuổi</option>
        {options.ageGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <select className="select" aria-label="Lớp" value={classId} onChange={(e) => update({ classId: e.target.value })}>
        <option value="">Tất cả lớp</option>
        {classOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {isPrincipal && !campusId ? ` · ${md.campusById?.(c.campusId)?.shortName || ''}` : ''}
          </option>
        ))}
      </select>
      {filtered && (
        <button className="btn btn--sm" type="button" onClick={clearFilters}>
          Bỏ lọc
        </button>
      )}
    </div>
  );

  return (
    <div className="page">
      <Breadcrumb items={attendanceCrumbs('Sức khỏe đầu ngày', { linkParent: false })} />
      <div className="page__head">
        <h1 className="page__title">Sức khỏe đầu ngày</h1>
      </div>
      <ClassDateBar date={date} maxDate={today} onDateChange={(value) => update({ date: value })}>
        {isPrincipal && (
          <div className="dd-bar__field">
            <label className="field__label" htmlFor="dh-campus">
              <Buildings size={15} /> Điểm trường
            </label>
            <select
              id="dh-campus"
              className="select"
              value={campusId}
              onChange={(event) => update({ campusId: event.target.value, ageGroupId: '', classId: '' })}
            >
              <option value="">Toàn trường</option>
              {md.campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </ClassDateBar>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>Chỉ xem. Giáo viên lớp ghi nhận ở màn Điểm danh &amp; sức khỏe.</div>
      </div>

      {forbidden ? (
        <div className="card">
          <EmptyState
            title="Bạn không có quyền xem nội dung này"
            description={error.message}
            action={
              <Link className="btn btn--sm mt-8" to="/">
                Về trang chủ
              </Link>
            }
          />
        </div>
      ) : error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : overview && !overview.schoolDay ? (
        <div className="card">
          <EmptyState title="Ngày đã chọn không phải ngày học" description="Chọn một ngày học khác để xem sức khỏe đầu ngày." />
        </div>
      ) : overview && overview.classes.length === 0 ? (
        <div className="card">
          {filtered ? (
            <EmptyState
              title="Không có lớp phù hợp bộ lọc"
              action={
                <button className="btn btn--sm mt-8" type="button" onClick={clearFilters}>
                  Đặt lại bộ lọc
                </button>
              }
            />
          ) : (
            <EmptyState
              title="Không có lớp trong phạm vi của bạn"
              description="Chỉ tính các lớp của năm học đang hoạt động thuộc điểm trường bạn được xem."
            />
          )}
        </div>
      ) : (
        <>
          {overview && <StatTiles totals={overview.totals} />}
          {overview && overview.totals.present === 0 && (
            <div className="alert alert--info mb-16">
              <Info size={18} />
              <div>Ngày {formatDate(date)} chưa có trẻ nào được điểm danh Có mặt, nên chưa có số liệu kiểm tra sức khỏe.</div>
            </div>
          )}
          <ClassTable
            rows={overview?.classes || []}
            loading={loading || !overview}
            showCampus={!overview?.campusId && isPrincipal}
            campusName={campusName}
            filters={filterBar}
          />
          {overview && <AttentionTable items={overview.attention} filtered={filtered} onClearFilter={clearFilters} onOpen={setDetail} />}
        </>
      )}

      <DailyHealthHistoryModal
        open={!!detail}
        child={detail}
        date={date}
        history={history.history}
        loading={history.loading}
        error={history.error}
        onRetry={history.reload}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
