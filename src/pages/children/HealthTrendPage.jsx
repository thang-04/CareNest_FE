import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LineChart, HeartPulse, ArrowLeft, ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useChildRecords, useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ChildAvatar } from '@/components/ChildAvatar';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { GrowthChart } from '@/components/children/GrowthChart';
import { HealthWarningCell } from '@/components/children/HealthWarningCell';
import { TrendChildList, sortByName } from '@/components/children/TrendChildList';
import { AiTrendPanel } from '@/components/children/AiTrendPanel';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { CHILD_STATUS } from '@/models/School';
import { TREND_PERIODS } from '@/models/children/childrenConstants';
import { NUTRITION_STATUS, NUTRITION_STATUS_OPTIONS, labelOf } from '@/models/children/healthExamForm';
import { formatDate } from '@/utils/format';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import { withinTrendPeriod } from '@/utils/children/healthTrend';
import { canReviewHealthTrend, isPrincipal, isVicePrincipal } from '@/utils/children/childrenPermissions';
import '@/styles/modules/children.css';
import { CampusFilter } from '@/components/ui/CampusFilter';

export default function HealthTrendPage() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const childId = params.get('childId') || '';
  const [period, setPeriod] = useState('ALL');
  const [view, setView] = useState('chart');
  const md = useMasterData();
  // Hiệu trưởng / Phó hiệu trưởng lọc theo điểm trường + lớp; giáo viên nhiều lớp chọn lớp (danh sách đã theo lớp mình)
  const leader = isPrincipal(user) || isVicePrincipal(user);
  const [campusId, setCampusId] = useState('');
  const [classId, setClassId] = useState('');
  const { children, loading: listLoading } = useChildRecords({ schoolYear, status: CHILD_STATUS.ACTIVE });
  const { record, loading, error, reload } = useHealthRecord(childId);

  const active = useMemo(() => children.filter((c) => c.status === CHILD_STATUS.ACTIVE), [children]);
  // Lựa chọn điểm trường / lớp lấy từ danh sách trẻ BE trả về trong phạm vi người dùng
  const campusOptions = md.campuses.filter((cp) => active.some((c) => c.campusId === cp.id));
  const classOptions = useMemo(() => {
    const seen = new Map();
    active
      .filter((c) => c.classId && (!campusId || c.campusId === campusId))
      .forEach((c) => seen.set(c.classId, { id: c.classId, name: c.className, campusId: c.campusId }));
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [active, campusId]);
  // Danh sách cột trái xếp theo tên (không xếp theo mức cần chú ý từ 2026-11-10).
  const ordered = useMemo(
    () => sortByName(active.filter((c) => (!campusId || c.campusId === campusId) && (!classId || c.classId === classId))),
    [active, campusId, classId],
  );
  // Mở trang hoặc đổi lớp mà chưa có trẻ đang xem thì tự chọn trẻ đầu danh sách.
  useEffect(() => {
    if (!childId && !listLoading && ordered.length) setParams({ childId: ordered[0].id }, { replace: true });
  }, [childId, listLoading, ordered, setParams]);
  // Đổi điểm trường / lớp mà trẻ đang xem không còn khớp thì bỏ chọn (trẻ đầu danh sách mới được chọn lại)
  const keepChildIf = (match) => {
    const current = active.find((c) => c.id === childId);
    if (current && !match(current)) setParams({}, { replace: true });
  };
  const detailRef = useRef(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const selectChild = (id) => {
    setParams({ childId: id });
    // Màn hẹp: danh sách nằm trên, bấm trẻ thì cuộn xuống biểu đồ
    if (window.matchMedia('(max-width: 1024px)').matches) detailRef.current?.scrollIntoView({ block: 'start' });
  };
  const index = ordered.findIndex((c) => c.id === childId);
  const prevChild = index > 0 ? ordered[index - 1] : null;
  const nextChild = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
  const points = useMemo(() => {
    // HLT-21: cùng khoảng với phân tích AI (tính lùi từ hôm nay như BE)
    return withinTrendPeriod(record?.measurements || [], period).sort((a, b) => a.date.localeCompare(b.date));
  }, [record, period]);

  const child = record?.child;
  // Chiều cao, cân nặng tô màu theo tình trạng dinh dưỡng bác sĩ ghi ở phiếu khám (không còn phân loại BMI, user chốt 2026-10-17).
  const nutritionPoint = (m, value) => {
    const statuses = m.exam?.nutrition?.statuses || [];
    return {
      date: m.date,
      value,
      tone: statuses.length === 0 ? 'unavailable' : statuses.includes(NUTRITION_STATUS.NORMAL) ? 'normal' : 'alert',
      statusLabel: statuses.length ? statuses.map((s) => labelOf(NUTRITION_STATUS_OPTIONS, s)).join(', ') : 'Chưa có đánh giá của bác sĩ',
    };
  };

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Xu hướng sức khỏe')} />
      <h1 className="page__title">Xu hướng sức khỏe</h1>

      {/* Danh sách trẻ bên trái (thu gọn được), biểu đồ của trẻ đang chọn bên phải (user chọn 2026-10-23) */}
      <div className={`tr-trend-layout mt-16 ${listCollapsed ? 'tr-trend-layout--collapsed' : ''}`}>
        <TrendChildList
          collapsed={listCollapsed}
          onToggle={() => setListCollapsed((v) => !v)}
          items={ordered}
          selectedId={childId}
          onSelect={selectChild}
          showClass={!classId}
          loading={listLoading}
          filters={
            (leader || classOptions.length > 1) && (
              <>
                {leader && (
                  <CampusFilter
                    campuses={campusOptions}
                    value={campusId}
                    onChange={(v) => {
                      setCampusId(v);
                      setClassId('');
                      keepChildIf((c) => !v || c.campusId === v);
                    }}
                    hideLabel
                  />
                )}
                <select
                  className="select"
                  value={classId}
                  aria-label="Lớp"
                  onChange={(e) => {
                    const v = e.target.value;
                    setClassId(v);
                    keepChildIf((c) => !v || c.classId === v);
                  }}
                >
                  <option value="">Tất cả lớp</option>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {!campusId && campusOptions.length > 1 ? ` – ${md.campusById(c.campusId)?.name?.split(' - ')[0] || ''}` : ''}
                    </option>
                  ))}
                </select>
              </>
            )
          }
        />
        <div className="tr-trend-detail" ref={detailRef}>
          {!childId ? (
            listLoading || ordered.length ? (
              <LoadingState />
            ) : (
              <div className="card">
                <EmptyState
                  icon={LineChart}
                  title="Không có trẻ để xem xu hướng"
                  description="Không có trẻ đang học trong phạm vi đã chọn. Đổi điểm trường hoặc lớp."
                />
              </div>
            )
          ) : loading ? (
            <LoadingState />
          ) : error || !child ? (
            <div>
              <ChildAccessState error={error} onRetry={reload} />
            </div>
          ) : (
            <>
              {/* Thẻ đầu: trẻ đang xem + chuyển trẻ trước/sau */}
              <section className="card tr-trend-head" aria-label={`Tổng quan ${child.fullName}`}>
                <div className="tr-trend-head__top">
                  <div className="row gap-3">
                    <ChildAvatar child={child} size="lg" />
                    <div className="stack gap-0">
                      <h2 className="tr-trend-head__name">{child.fullName}</h2>
                      <span className="muted text-sm">
                        {child.code} · {child.className || 'Chưa xếp lớp'}
                      </span>
                    </div>
                  </div>
                  <div className="row row--wrap gap-2">
                    <button type="button" className="btn btn--sm" disabled={!prevChild} onClick={() => selectChild(prevChild.id)}>
                      <ChevronLeft size={15} /> Trẻ trước
                    </button>
                    <button type="button" className="btn btn--sm" disabled={!nextChild} onClick={() => selectChild(nextChild.id)}>
                      Trẻ sau <ChevronRight size={15} />
                    </button>
                    <Link className="btn btn--sm" to={`/children/${child.id}/health`}>
                      <HeartPulse size={15} /> Mở sổ sức khỏe
                    </Link>
                  </div>
                </div>
              </section>
              <section className="card mt-16">
                <div className="tr-chart-toolbar">
                  <Tabs
                    items={[
                      { key: 'chart', label: 'Biểu đồ' },
                      { key: 'table', label: 'Bảng số liệu' },
                    ]}
                    value={view}
                    onChange={setView}
                    ariaLabel="Cách xem"
                  />
                  <div className="row row--wrap gap-4">
                    {view === 'chart' && points.length > 0 && (
                      <div className="tr-legend text-sm">
                        <span>
                          <i className="tr-legend__dot tr-legend__dot--normal" /> Bình thường
                        </span>
                        <span>
                          <i className="tr-legend__dot tr-legend__dot--alert" /> Có điểm cần chú ý
                        </span>
                        <span>
                          <i className="tr-legend__dot tr-legend__dot--unavailable" /> Chưa có đánh giá
                        </span>
                      </div>
                    )}
                    <div className="tabs" role="group" aria-label="Khoảng thời gian">
                      {TREND_PERIODS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          aria-pressed={period === p.key}
                          className={`tab ${period === p.key ? 'tab--active' : ''}`}
                          onClick={() => setPeriod(p.key)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {points.length === 0 ? (
                  <EmptyState
                    icon={HeartPulse}
                    title="Không có số đo trong khoảng thời gian này"
                    description="Chọn khoảng thời gian khác hoặc nhập số đo trong sổ sức khỏe."
                  />
                ) : view === 'chart' ? (
                  <div className="card__body">
                    {/* Hai biểu đồ cạnh nhau, trục tự co theo số đo (user chọn phương án A 14/11/2026, thay chốt 23/10 mỗi biểu đồ một dòng) */}
                    <div className="tr-trend-charts">
                      <GrowthChart title="Chiều cao" unit="cm" points={points.map((m) => nutritionPoint(m, m.heightCm))} />
                      <GrowthChart title="Cân nặng" unit="kg" points={points.map((m) => nutritionPoint(m, m.weightKg))} />
                    </div>
                  </div>
                ) : (
                  <div className="table-wrap tr-table-flat">
                    <table className="table table--grid">
                      <caption className="sr-only">Số đo của {child.fullName} theo thời gian</caption>
                      <thead>
                        <tr>
                          <th className="center">Ngày đo</th>
                          <th className="num">Chiều cao (cm)</th>
                          <th className="num">Cân nặng (kg)</th>
                          <th className="num">BMI</th>
                          <th>Cảnh báo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {points.map((m) => (
                          <tr key={m.id}>
                            <td className="center">{formatDate(m.date)}</td>
                            <td className="num">{formatNumber(m.heightCm)}</td>
                            <td className="num">{formatNumber(m.weightKg)}</td>
                            <td className="num">{formatNumber(m.bmi)}</td>
                            <td>
                              <HealthWarningCell measurement={m} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <AiTrendPanel
                key={child.id}
                childId={child.id}
                user={user}
                period={period}
                canReview={canReviewHealthTrend(child, user, record?.cls)}
              />
              <div className="page-actions">
                <Link className="btn" to={`/children/${child.id}`}>
                  <ArrowLeft size={16} /> Về hồ sơ trẻ
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
