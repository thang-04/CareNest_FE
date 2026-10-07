import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LineChart, Sparkles, AlertTriangle, Info, RefreshCw, HeartPulse, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { useChildRecords, useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { NutritionBadge } from '@/components/children/ChildBadges';
import { GrowthChart } from '@/components/children/GrowthChart';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { analyzeHealthTrend } from '@/services/children/childrenService';
import { CHILD_STATUS } from '@/models/School';
import { AI_TREND_STATUS } from '@/models/children/childrenConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const PERIODS = [
  { key: 'ALL', label: 'Toàn bộ', months: null },
  { key: '6', label: '6 tháng gần nhất', months: 6 },
  { key: '12', label: '12 tháng gần nhất', months: 12 },
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
              {error.message || 'Không dùng được trợ lý AI.'} Số đo và tình trạng dinh dưỡng ở trên vẫn đầy đủ.{' '}
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
              liệu, không phải chẩn đoán, chỉ nhân viên nhà trường xem được và không làm thay đổi tình trạng dinh dưỡng.
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
  const { children, loading: listLoading } = useChildRecords({ schoolYear, status: CHILD_STATUS.ACTIVE });
  const { record, loading, error, reload } = useHealthRecord(childId);

  const options = useMemo(
    () =>
      children
        .filter((c) => c.status === CHILD_STATUS.ACTIVE)
        .map((c) => ({ value: c.id, label: `${c.fullName} – ${c.className}`, searchText: `${c.fullName} ${c.code} ${c.className}` })),
    [children],
  );
  const points = useMemo(() => {
    const months = PERIODS.find((p) => p.key === period)?.months;
    const since = months ? monthsAgo(months) : '';
    return [...(record?.measurements || [])].filter((m) => !since || m.date >= since).sort((a, b) => a.date.localeCompare(b.date));
  }, [record, period]);

  const child = record?.child;

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Xu hướng sức khỏe')} />
      <h1 className="page__title">Xu hướng sức khỏe</h1>

      <div className="card">
        <div className="filter-bar">
          <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
            <SearchSelect
              options={options}
              value={childId}
              onChange={(v) => setParams(v ? { childId: v } : {})}
              placeholder={listLoading ? 'Đang tải danh sách trẻ...' : 'Chọn trẻ'}
              ariaLabel="Chọn trẻ"
            />
          </div>
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Khoảng thời gian">
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!childId ? (
        <div className="card mt-16">
          <EmptyState
            icon={LineChart}
            title="Chọn một trẻ để xem xu hướng"
            description="Biểu đồ chiều cao, cân nặng theo các lần đo đã ghi trong sổ sức khỏe."
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
          {points.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={HeartPulse}
                title="Không có số đo trong khoảng thời gian này"
                description="Chọn khoảng thời gian khác hoặc nhập số đo trong sổ sức khỏe."
              />
            </div>
          ) : (
            <section className="card">
              <div className="tabs" style={{ padding: '6px 16px 0' }} role="tablist">
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
              {view === 'chart' ? (
                <div className="card__body">
                  <div className="grid-2">
                    <GrowthChart
                      title="Chiều cao"
                      unit="cm"
                      points={points.map((m) => ({ date: m.date, value: m.heightCm, status: m.nutritionStatus }))}
                    />
                    <GrowthChart
                      title="Cân nặng"
                      unit="kg"
                      points={points.map((m) => ({ date: m.date, value: m.weightKg, status: m.nutritionStatus }))}
                    />
                  </div>
                  <div className="tr-legend text-sm">
                    <span>
                      <i className="tr-legend__dot tr-legend__dot--normal" /> Bình thường
                    </span>
                    <span>
                      <i className="tr-legend__dot tr-legend__dot--alert" /> Suy dinh dưỡng / Béo phì
                    </span>
                    <span>
                      <i className="tr-legend__dot tr-legend__dot--unavailable" /> Chưa phân loại được
                    </span>
                    <span className="muted">Điểm trên biểu đồ tô màu theo tình trạng dinh dưỡng hệ thống tính theo quy tắc.</span>
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
                        <th className="right">BMI</th>
                        <th>Tình trạng dinh dưỡng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((m) => (
                        <tr key={m.id}>
                          <td>{formatDate(m.date)}</td>
                          <td className="right">{formatNumber(m.heightCm)}</td>
                          <td className="right">{formatNumber(m.weightKg)}</td>
                          <td className="right">{formatNumber(m.bmi)}</td>
                          <td>
                            <NutritionBadge status={m.nutritionStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
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
