import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LineChart, Sparkles, AlertTriangle, Info, RefreshCw, HeartPulse, ArrowLeft } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { useChildRecords, useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { ConclusionCategoryBadge, FollowUpLevelShortBadge, MotorResultBadge } from '@/components/children/ChildBadges';
import { GrowthChart } from '@/components/children/GrowthChart';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { analyzeHealthTrend } from '@/services/children/childrenService';
import { CHILD_STATUS, ageGroupById } from '@/models/School';
import {
  AI_TREND_STATUS,
  HEAD_CIRCUMFERENCE_STATUS_LABELS,
  MEASUREMENT_SOURCE,
  MEASUREMENT_SOURCE_LABELS,
  growthAxesFor,
} from '@/models/children/childrenConstants';
import { NUTRITION_STATUS, NUTRITION_STATUS_OPTIONS, labelOf } from '@/models/children/healthExamForm';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatNumber, screeningTone, suggestAgeGroupId } from '@/utils/children/childrenHelpers';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import { isPrincipal, isVicePrincipal } from '@/utils/children/childrenPermissions';
import '@/styles/modules/children.css';

const PERIODS = [
  { key: '6', label: '6 tháng', months: 6 },
  { key: '12', label: '12 tháng', months: 12 },
  { key: 'ALL', label: 'Toàn bộ', months: null },
];

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

/** AI panel: optional help, the page stays usable when it fails (GBR-AI-06, MSG30). */
function AiTrendPanel({ childId, user }) {
  const { data, loading, error, reload } = useAsync(() => analyzeHealthTrend(childId, user), [childId, user?.id], { enabled: !!childId });
  return (
    <section className="card mt-16 tr-ai">
      <div className="card__header row row--between row--wrap" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <Sparkles size={18} className="tr-ai__icon" />
          <h2 className="card__title">Nhận định xu hướng</h2>
          <span className="chip chip--purple">Bản nháp AI – chỉ để tham khảo</span>
        </div>
        <button className="btn btn--sm" onClick={() => reload()} disabled={loading}>
          {loading ? <Spinner small /> : <RefreshCw size={14} />} Phân tích lại
        </button>
      </div>
      <div className="card__body">
        {loading ? (
          <div className="row muted" style={{ gap: 8 }}>
            <Spinner small /> Đang phân tích xu hướng các lần đo...
          </div>
        ) : error ? (
          <div className="alert alert--warning" role="status">
            <AlertTriangle size={18} />
            <div>
              {error.message || 'Không dùng được trợ lý AI.'} Số đo và kết quả phân loại ở trên vẫn đầy đủ.{' '}
              <button className="link-btn" onClick={() => reload()}>
                Thử lại
              </button>
            </div>
          </div>
        ) : data?.status === AI_TREND_STATUS.NOT_ENOUGH_DATA ? (
          <p className="muted">Cần ít nhất 2 lần đo để phân tích xu hướng.</p>
        ) : data ? (
          <>
            <p>{data.summary}</p>
            {data.warnings.length > 0 && (
              <ul className="tr-ai__list">
                {data.warnings.map((w) => (
                  <li key={w.text} className={`tr-ai__item tr-ai__item--${w.level}`}>
                    {w.level === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}
                    <span>{w.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted text-xs mt-12">
              Do AI tạo lúc {formatDateTime(data.generatedAt)} từ số đo đã ghi (không gửi họ tên, liên hệ của trẻ). Nội dung chỉ mô tả số
              liệu, không phải chẩn đoán, chỉ nhân viên nhà trường xem được và không làm thay đổi kết quả phân loại.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default function HealthTrendPage() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const childId = params.get('childId') || '';
  const [period, setPeriod] = useState('ALL');
  const [view, setView] = useState('chart');
  const md = useMasterData();
  // Hiệu trưởng / Phó hiệu trưởng lọc theo điểm trường + lớp; giáo viên chỉ chọn tên (danh sách đã theo lớp mình)
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
  const options = useMemo(
    () =>
      active
        .filter((c) => !campusId || c.campusId === campusId)
        .filter((c) => !classId || c.classId === classId)
        .map((c) => ({
          value: c.id,
          label: leader ? `${c.fullName} – ${c.className || 'Chưa xếp lớp'}` : c.fullName,
          searchText: `${c.fullName} ${c.code}`,
        })),
    [active, campusId, classId, leader],
  );
  // Đổi điểm trường / lớp mà trẻ đang xem không còn khớp thì bỏ chọn trẻ
  const keepChildIf = (match) => {
    const current = active.find((c) => c.id === childId);
    if (current && !match(current)) setParams({});
  };
  const points = useMemo(() => {
    const months = PERIODS.find((p) => p.key === period)?.months;
    const since = months ? monthsAgo(months) : '';
    return [...(record?.measurements || [])].filter((m) => !since || m.date >= since).sort((a, b) => a.date.localeCompare(b.date));
  }, [record, period]);

  const child = record?.child;
  // Thang biểu đồ theo nhóm tuổi của lớp hiện tại; trẻ chưa xếp lớp thì theo năm sinh
  const ageGroupId = record?.cls?.ageGroupId || child?.ageGroupId || suggestAgeGroupId(child?.dateOfBirth, schoolYear);
  const axes = growthAxesFor(ageGroupId);
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
  // Lần đo không có vòng đầu (dữ liệu cũ, trẻ trên 60 tháng) thì biểu đồ bỏ qua điểm đó
  const headPoints = points
    .filter((m) => m.headCircumferenceCm != null)
    .map((m) => ({
      date: m.date,
      value: m.headCircumferenceCm,
      tone: screeningTone(m.headCircumferenceStatus),
      statusLabel: HEAD_CIRCUMFERENCE_STATUS_LABELS[m.headCircumferenceStatus],
    }));

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Xu hướng sức khỏe')} />
      <h1 className="page__title">Xu hướng sức khỏe</h1>

      <div className="card">
        <div className="filter-bar">
          {leader && (
            <>
              <select
                className="select"
                value={campusId}
                aria-label="Điểm trường"
                onChange={(e) => {
                  const v = e.target.value;
                  setCampusId(v);
                  setClassId('');
                  keepChildIf((c) => !v || c.campusId === v);
                }}
              >
                <option value="">Tất cả điểm trường</option>
                {campusOptions.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
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
          )}
          <div className="tr-child-picker">
            <SearchSelect
              options={options}
              value={childId}
              onChange={(v) => setParams(v ? { childId: v } : {})}
              placeholder={listLoading ? 'Đang tải danh sách trẻ...' : `Chọn trẻ theo tên (${options.length})`}
              ariaLabel="Chọn trẻ theo tên"
            />
          </div>
        </div>
      </div>

      {!childId ? (
        <div className="card mt-16">
          <EmptyState
            icon={LineChart}
            title="Chọn một trẻ để xem xu hướng"
            description="Biểu đồ chiều cao, cân nặng, vòng đầu theo các lần đo đã ghi trong sổ sức khỏe."
          />
        </div>
      ) : loading ? (
        <LoadingState />
      ) : error || !child ? (
        <div className="mt-16">
          <ChildAccessState error={error} onRetry={reload} />
        </div>
      ) : (
        <>
          <div className="row row--between row--wrap mt-16 mb-12" style={{ gap: 8 }}>
            <h2 className="section-title">
              {child.fullName}{' '}
              <span className="muted text-sm">
                ({child.code} · {child.className || 'Chưa xếp lớp'})
              </span>
            </h2>
            <Link className="btn btn--sm" to={`/children/${child.id}/health`}>
              <HeartPulse size={15} /> Mở sổ sức khỏe
            </Link>
          </div>
          <section className="card">
            <div className="tr-chart-toolbar">
              <div className="tabs" role="tablist" aria-label="Cách xem">
                <button
                  role="tab"
                  aria-selected={view === 'chart'}
                  className={`tab ${view === 'chart' ? 'tab--active' : ''}`}
                  onClick={() => setView('chart')}
                >
                  Biểu đồ
                </button>
                <button
                  role="tab"
                  aria-selected={view === 'table'}
                  className={`tab ${view === 'table' ? 'tab--active' : ''}`}
                  onClick={() => setView('table')}
                >
                  Bảng số liệu
                </button>
              </div>
              <div className="tabs" role="group" aria-label="Khoảng thời gian">
                {PERIODS.map((p) => (
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
            {points.length === 0 ? (
              <EmptyState
                icon={HeartPulse}
                title="Không có số đo trong khoảng thời gian này"
                description="Chọn khoảng thời gian khác hoặc nhập số đo trong sổ sức khỏe."
              />
            ) : view === 'chart' ? (
              <div className="card__body">
                <div className="grid-2">
                  <GrowthChart title="Chiều cao" unit="cm" axis={axes.height} points={points.map((m) => nutritionPoint(m, m.heightCm))} />
                  <GrowthChart title="Cân nặng" unit="kg" axis={axes.weight} points={points.map((m) => nutritionPoint(m, m.weightKg))} />
                  {headPoints.length > 0 && <GrowthChart title="Vòng đầu" unit="cm" axis={axes.head} points={headPoints} />}
                </div>
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
                  <span className="muted">
                    Chiều cao, cân nặng tô màu theo tình trạng dinh dưỡng bác sĩ ghi ở phiếu khám; vòng đầu theo lựa chọn ở phiếu khám (kết
                    quả mẫu cũ: theo ngưỡng tham chiếu tạm, không phải chẩn đoán).
                  </span>
                  {ageGroupById(ageGroupId) && (
                    <span className="muted">Thang đo dùng chung cho nhóm {ageGroupById(ageGroupId).shortName}.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="table-wrap tr-table-flat">
                <table className="table">
                  <caption className="sr-only">Số đo của {child.fullName} theo thời gian</caption>
                  <thead>
                    <tr>
                      <th>Ngày đo</th>
                      <th className="right">Chiều cao (cm)</th>
                      <th className="right">Cân nặng (kg)</th>
                      <th className="right">Vòng đầu (cm)</th>
                      <th className="right">BMI</th>
                      <th>Kết luận</th>
                      <th>Mức theo dõi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((m) => (
                      <tr key={m.id}>
                        <td>{formatDate(m.date)}</td>
                        <td className="right">{formatNumber(m.heightCm)}</td>
                        <td className="right">{formatNumber(m.weightKg)}</td>
                        <td className="right">{formatNumber(m.headCircumferenceCm)}</td>
                        <td className="right">{formatNumber(m.bmi)}</td>
                        <td>
                          {m.source === MEASUREMENT_SOURCE.EXAM ? (
                            <ConclusionCategoryBadge status={m.conclusionCategory} />
                          ) : m.source === MEASUREMENT_SOURCE.LEGACY ? (
                            <div className="tr-cell-stack text-sm">
                              <span className="muted text-xs">{MEASUREMENT_SOURCE_LABELS.LEGACY}</span>
                              <span>Thô: {m.grossMotor ? <MotorResultBadge status={m.grossMotor} /> : '—'}</span>
                              <span>Tinh: {m.fineMotor ? <MotorResultBadge status={m.fineMotor} /> : '—'}</span>
                            </div>
                          ) : (
                            <span className="muted text-xs tr-note">{MEASUREMENT_SOURCE_LABELS.MEASUREMENT_ONLY}</span>
                          )}
                        </td>
                        <td>
                          <FollowUpLevelShortBadge status={m.followUpLevel} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <AiTrendPanel key={child.id} childId={child.id} user={user} />
          <div className="page-actions">
            <Link className="btn" to={`/children/${child.id}`}>
              <ArrowLeft size={16} /> Về hồ sơ trẻ
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
