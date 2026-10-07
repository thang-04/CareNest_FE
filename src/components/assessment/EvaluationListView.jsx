import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileCheck2, Info, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAssessmentClasses, useEvaluations } from '@/hooks/assessment/useAssessment';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EvaluationStatusBadge } from '@/components/assessment/AssessmentBadges';
import { EVAL_KIND, EVAL_STATUS, PERIOD_TYPE, PERIOD_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDateTime, normalizeText } from '@/utils/format';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';
import { isLeader } from '@/utils/assessment/assessmentPermissions';

const TEACHER_TABS = [
  { key: 'TODO', label: 'Chờ xem xét', match: (e) => e.status !== EVAL_STATUS.CONFIRMED },
  { key: EVAL_STATUS.CONFIRMED, label: 'Đã xác nhận', match: (e) => e.status === EVAL_STATUS.CONFIRMED },
  { key: 'ALL', label: 'Tất cả', match: () => true },
];

/** Shared list of #55 Periodic Evaluation List and #58 Year-end Evaluation List. */
export function EvaluationListView({ kind }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const leader = isLeader(user);
  const { schoolYear } = useSchoolYear();
  const yearEnd = kind === EVAL_KIND.YEAR_END;
  const { classes } = useAssessmentClasses();
  const [classId, setClassId] = useState('');
  const [periodType, setPeriodType] = useState('');
  const [period, setPeriod] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState(leader ? 'ALL' : 'TODO');
  const [page, setPage] = useState(1);
  const filters = useMemo(
    () => ({ classId: classId || undefined, schoolYear, periodType: periodType || undefined }),
    [classId, schoolYear, periodType],
  );
  const { evaluations, loading, error, reload } = useEvaluations(kind, filters);

  const periods = useMemo(() => {
    const map = new Map();
    evaluations.forEach((e) => map.set(`${e.periodType}|${e.periodStart}`, periodLabel(e.periodType, e.periodStart, e.periodEnd)));
    return [...map.entries()];
  }, [evaluations]);

  const tabs = leader ? [] : TEACHER_TABS;
  const current = tabs.find((t) => t.key === tab);
  const base = evaluations
    .filter((e) => !period || `${e.periodType}|${e.periodStart}` === period)
    .filter((e) => !keyword || normalizeText(`${e.childName} ${e.childCode}`).includes(normalizeText(keyword)));
  const rows = current ? base.filter(current.match) : base;
  const reset = () => {
    setClassId('');
    setPeriodType('');
    setPeriod('');
    setKeyword('');
    setPage(1);
  };
  const filtered = classId || periodType || period || keyword;
  const link = (e) => `/assessment/${yearEnd ? 'year-end' : 'periodic'}/${e.id}`;

  return (
    <>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {leader
            ? 'Danh sách chỉ gồm các đánh giá đã được giáo viên xác nhận và công bố.'
            : yearEnd
              ? 'Cuối năm học, hệ thống tạo bản nháp AI từ các đánh giá tháng đã xác nhận. Bạn xem xét, bổ sung và xác nhận trước khi dùng cho đề xuất khen thưởng.'
              : 'Cuối mỗi tuần và tháng, hệ thống tạo bản nháp AI từ đánh giá hằng ngày. Bản nháp chỉ được công bố cho phụ huynh, Phó hiệu trưởng và Hiệu trưởng sau khi bạn xác nhận.'}
        </div>
      </div>
      <div className="card">
        {tabs.length > 0 && (
          <div className="tabs" style={{ padding: '6px 16px 0' }} role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`tab ${tab === t.key ? 'tab--active' : ''}`}
                onClick={() => {
                  setTab(t.key);
                  setPage(1);
                }}
              >
                {t.label} <span className="tab__count">{base.filter(t.match).length}</span>
              </button>
            ))}
          </div>
        )}
        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          <label className="search-box" style={{ flex: 1, minWidth: 200 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm tên hoặc mã trẻ..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              aria-label="Tìm trẻ"
            />
          </label>
          <select
            className="select"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
            aria-label="Lớp"
          >
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {!yearEnd && (
            <select
              className="select"
              value={periodType}
              onChange={(e) => {
                setPeriodType(e.target.value);
                setPeriod('');
                setPage(1);
              }}
              aria-label="Loại kỳ"
            >
              <option value="">Tuần và tháng</option>
              <option value={PERIOD_TYPE.WEEK}>Theo tuần</option>
              <option value={PERIOD_TYPE.MONTH}>Theo tháng</option>
            </select>
          )}
          {!yearEnd && (
            <select
              className="select"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
              aria-label="Kỳ đánh giá"
            >
              <option value="">Tất cả kỳ</option>
              {periods.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <button className="btn" onClick={reset} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  <th>Lớp</th>
                  <th>Kỳ đánh giá</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={6} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={FileCheck2}
                        title={filtered ? 'Không có đánh giá phù hợp' : 'Chưa có đánh giá'}
                        description={
                          filtered
                            ? 'Không có hồ sơ nào trong phạm vi hoặc kỳ đã chọn.'
                            : yearEnd
                              ? 'Bản nháp cuối năm được tạo khi năm học kết thúc.'
                              : 'Bản nháp được tạo tự động khi tuần hoặc tháng kết thúc.'
                        }
                        action={
                          filtered && (
                            <button className="btn" onClick={reset}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(rows, page).map((e) => {
                    const todo = !leader && e.status !== EVAL_STATUS.CONFIRMED;
                    return (
                      <tr key={e.id} className="row-click" onClick={() => navigate(link(e))}>
                        <td>
                          <div className="fw-600">{e.childName}</div>
                          <div className="muted text-xs">{e.childCode}</div>
                        </td>
                        <td>{e.className}</td>
                        <td className="nowrap">
                          <div>{periodLabel(e.periodType, e.periodStart, e.periodEnd)}</div>
                          <div className="muted text-xs">{PERIOD_TYPE_LABELS[e.periodType]}</div>
                        </td>
                        <td>
                          <EvaluationStatusBadge status={e.status} />
                        </td>
                        <td className="nowrap text-sm">
                          {formatDateTime(e.confirmedAt || e.aiDraft?.generatedAt || e.history.at(-1)?.at)}
                        </td>
                        <td className="center" onClick={(ev) => ev.stopPropagation()}>
                          <button className={`btn btn--sm ${todo ? 'btn--primary' : ''}`} onClick={() => navigate(link(e))}>
                            {todo ? <FileCheck2 size={15} /> : <Eye size={15} />} {todo ? 'Xem xét' : 'Xem'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="đánh giá" />}
      </div>
    </>
  );
}
