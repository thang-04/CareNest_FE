import { Fragment, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Eye, HeartPulse, Info } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ChildAvatar } from '@/components/ChildAvatar';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { DailyHealthHistoryModal } from '@/components/attendance/DailyHealthHistoryModal';
import { TemperatureBadge } from '@/components/attendance/TemperatureBadge';
import { useChildDailyHealthHistory, useDailyHealthOverview } from '@/hooks/attendance/useDailyHealthOverview';
import { ROLES } from '@/models/User';
import { schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { symptomLabels } from '@/utils/dailyHealthValidation';
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
    </div>
  );
}

/** Bảng theo lớp, nhóm theo nhóm tuổi; bấm tên nhóm để thu / mở (mặc định thu gọn, dòng nhóm vẫn có số tổng). */
function ClassTable({ rows, loading, showCampus, campusName, filters, groupOf }) {
  const [open, setOpen] = useState(() => new Set());
  const groups = [];
  rows.forEach((row) => {
    const g = groupOf(row);
    let group = groups.find((x) => x.id === g.id);
    if (!group) groups.push((group = { ...g, rows: [] }));
    group.rows.push(row);
  });
  groups.sort((a, b) => a.order - b.order);
  const sum = (list, key) => list.reduce((n, r) => n + (r[key] || 0), 0);
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.id));
  return (
    <div className="card mb-16">
      <div className="card__header dd-hov__head">
        <h2 className="card__title">Theo lớp</h2>
        {filters}
        {groups.length > 1 && (
          <button className="btn btn--sm" type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.id)))}>
            {allOpen ? 'Thu gọn tất cả' : 'Mở tất cả'}
          </button>
        )}
      </div>
      <div className="table-wrap dd-table-wrap">
        <table className="table table--grid table--compact">
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
              groups.map((g) => {
                const expanded = open.has(g.id) || groups.length === 1;
                const noted = sum(g.rows, 'noted');
                return (
                  <Fragment key={g.id}>
                    <tr className="dd-hov__group">
                      <td>
                        <button
                          type="button"
                          className="dd-hov__toggle"
                          aria-expanded={expanded}
                          onClick={() => toggle(g.id)}
                          disabled={groups.length === 1}
                        >
                          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          {g.name}
                          <span className="muted text-xs">· {g.rows.length} lớp</span>
                        </button>
                      </td>
                      <td className="right">{sum(g.rows, 'size')}</td>
                      <td className="right">{sum(g.rows, 'present')}</td>
                      <td className="right nowrap">
                        {sum(g.rows, 'checked')}/{sum(g.rows, 'present')}
                      </td>
                      <td className="right fw-600">{noted || '—'}</td>
                    </tr>
                    {expanded &&
                      g.rows.map((row) => (
                        <tr key={row.classId}>
                          <td className="dd-hov__class">
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
                      ))}
                  </Fragment>
                );
              })
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
          <table className="table table--grid table--compact">
            <thead>
              <tr>
                <th>Trẻ</th>
                <th>Lớp</th>
                <th className="right">Thân nhiệt</th>
                <th>Biểu hiện</th>
                <th>Ghi chú</th>
                <th>Xử trí</th>
                <th>Người ghi</th>
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
                    <div className="dd-hov__child">
                      <ChildAvatar child={{ fullName: item.childName, photoUrl: item.photoUrl }} size="sm" />
                      <div>
                        <div className="fw-600">{item.childName}</div>
                        {item.childCode && <div className="muted text-xs">{item.childCode}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="nowrap">{item.className}</td>
                  <td className="right nowrap">
                    <TemperatureBadge value={item.temperature} />
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
                    {/* Mỗi xử trí một chip, không xuống dòng giữa chữ */}
                    {item.actionsText ? (
                      <div className="dd-hov__actions">
                        {item.actionsText.split(' · ').map((a) => (
                          <span key={a} className="chip chip--gray">
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="nowrap">
                    {item.recordedByName}
                    <div className="muted text-xs">{timeOf(item.recordedAt)}</div>
                  </td>
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
  const filtered = !!(campusId || ageGroupId || classId);
  const clearFilters = () => update({ campusId: '', ageGroupId: '', classId: '' });
  // Nhóm tuổi của từng lớp (lấy từ danh sách lựa chọn BE trả về) để nhóm bảng "Theo lớp"
  const groupOf = (row) => {
    const ageGroupIdOf = options.classes.find((c) => c.id === row.classId)?.ageGroupId;
    const order = options.ageGroups.findIndex((x) => x.id === ageGroupIdOf);
    const g = options.ageGroups[order];
    return { id: g?.id || 'other', name: g?.name || 'Khác', order: order < 0 ? 99 : order };
  };

  const campusName = (id) => md.campusById?.(id)?.name || id;
  const forbidden = error?.status === 403;

  // Lọc nhóm tuổi / lớp đặt ngay đầu bảng "Theo lớp" (gần dữ liệu, đỡ cuộn); áp cho số tổng, bảng lớp và trẻ cần chú ý
  const filterBar = (
    <div className="dd-hov__filters" role="group" aria-label="Lọc theo điểm trường, nhóm tuổi và lớp">
      {isPrincipal && (
        <select
          className="select"
          aria-label="Điểm trường"
          value={campusId}
          onChange={(e) => update({ campusId: e.target.value, ageGroupId: '', classId: '' })}
        >
          <option value="">Toàn trường</option>
          {md.campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
      )}
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
      <ClassDateBar date={date} maxDate={today} onDateChange={(value) => update({ date: value })}></ClassDateBar>

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
            groupOf={groupOf}
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
