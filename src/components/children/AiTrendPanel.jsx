import { useState } from 'react';
import { Sparkles, AlertTriangle, Info, RefreshCw, Pencil, CheckCircle2 } from '@/components/ui/icons';
import { Button, ConfirmationModal, EmptyState, LoadingState } from '@/components';
import { useToast } from '@/contexts/ToastContext';
import { AiTrendEditor } from '@/components/children/AiTrendEditor';
import { useAsync } from '@/hooks/useAsync';
import { runWithAiHold } from '@/hooks/loadingTiming';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { TrendReviewBadge } from '@/components/children/ChildBadges';
import { analyzeHealthTrend, approveHealthTrend, getLatestHealthTrend } from '@/services/children/childrenService';
import { AI_TREND_STATUS } from '@/models/children/childrenConstants';
import { trendBlocks, trendPeriodOf } from '@/utils/children/healthTrend';
import { formatDateTime } from '@/utils/format';

/**
 * Nhận định xu hướng (HLT-05, HLT-21): mở trang chỉ đọc bản mới nhất, AI chạy khi bấm "Phân tích" (user 14/11, thay chốt 20/10).
 * AI lỗi không chặn trang: số đo, biểu đồ vẫn dùng được (GBR-AI-06, MSG30). `canReview`: GV phụ trách lớp hiện tại của trẻ được
 * sửa, duyệt bản nháp (BE HLT-21 vẫn kiểm, 403 5041); bản đã duyệt chỉ xem (user 14/11, Q4). `period`: khoảng đang chọn trên
 * biểu đồ — AI chỉ phân tích lần đo trong khoảng đó (HLT-21).
 */
export function AiTrendPanel({ childId, user, period = 'ALL', canReview = false }) {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => getLatestHealthTrend(childId, user), [childId, user?.id], {
    enabled: !!childId,
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  // Khoảng vừa bấm phân tích có dưới 2 lần đo trong khi đang có bản cũ: giữ bản cũ, chỉ báo
  const [shortage, setShortage] = useState(null);
  const [editing, setEditing] = useState(false);
  // null: không hỏi; { content }: đang hỏi xác nhận duyệt (content null = duyệt nguyên bản AI)
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [approveError, setApproveError] = useState(null);

  const approve = async () => {
    setSaving(true);
    try {
      setData(await approveHealthTrend(childId, data.id, confirm.content, user));
      setConfirm(null);
      setEditing(false);
      setServerErrors({});
      setApproveError(null);
      toast.success('Phụ huynh xem được bản này trên ứng dụng.', 'Đã duyệt nhận định xu hướng');
    } catch (err) {
      setConfirm(null);
      // 400: lỗi theo ô, giữ form đang sửa; 403 (không phải GV lớp) và lỗi khác: báo trong card
      if (err.status === 400 && err.details && typeof err.details === 'object') setServerErrors(err.details);
      else setApproveError(err);
    } finally {
      setSaving(false);
    }
  };

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setEditing(false);
    setApproveError(null);
    setShortage(null);
    try {
      const result = await runWithAiHold(() => analyzeHealthTrend(childId, period, user));
      if (result?.status === AI_TREND_STATUS.NOT_ENOUGH_DATA && data?.status === AI_TREND_STATUS.OK) setShortage(result.period || period);
      else setData(result);
    } catch (err) {
      // AI-03: giữ bản đang hiển thị, chỉ báo lỗi trong card
      setAnalyzeError(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const hasAnalysis = data?.status === AI_TREND_STATUS.OK;
  const blocks = hasAnalysis ? trendBlocks(data) : [];
  const overview = blocks.find((b) => b.key === 'overview');
  const columns = blocks.filter((b) => b.key === 'attention' || b.key === 'positives' || b.key === 'followUps');
  const limitations = blocks.find((b) => b.key === 'limitations');
  const reviewable = canReview && hasAnalysis && data.draft && !editing;
  const selected = trendPeriodOf(period);
  const analyzeLabel = !hasAnalysis
    ? 'Phân tích'
    : data.period && data.period !== period
      ? `Phân tích lại (${selected.label.toLowerCase()})`
      : 'Phân tích lại';
  return (
    <section className="card mt-16 tr-ai">
      <div className="card__header row row--between row--wrap gap-2">
        <div className="row gap-2">
          <Sparkles size={18} className="tr-ai__icon" />
          <h2 className="card__title">Nhận định xu hướng</h2>
          {hasAnalysis && <TrendReviewBadge status={data.draft ? 'DRAFT' : 'APPROVED'} />}
          {hasAnalysis && <span className="muted text-sm">Phân tích {trendPeriodOf(data.period).label.toLowerCase()}</span>}
        </div>
        <div className="row gap-2">
          {reviewable && (
            <>
              {data.content && (
                <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>
                  Sửa
                </Button>
              )}
              <Button size="sm" variant="primary" icon={CheckCircle2} onClick={() => setConfirm({ content: null })}>
                Duyệt
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={hasAnalysis ? undefined : 'primary'}
            icon={RefreshCw}
            onClick={analyze}
            disabled={loading || analyzing || editing}
          >
            {analyzeLabel}
          </Button>
        </div>
      </div>
      <div className="card__body">
        {approveError && (
          <div className="alert alert--warning mb-12" role="alert">
            <AlertTriangle size={18} />
            <div>{approveError.message || 'Không duyệt được nhận định xu hướng.'}</div>
          </div>
        )}
        {shortage && (
          <div className="alert alert--info mb-12" role="status">
            <Info size={18} />
            <div>
              Chưa đủ số đo trong {trendPeriodOf(shortage).phrase} để phân tích (cần ít nhất 2 lần đo đã công bố). Chọn khoảng dài hơn rồi
              bấm “Phân tích lại”.
            </div>
          </div>
        )}
        {analyzeError && (
          <div className="alert alert--warning mb-12" role="status">
            <AlertTriangle size={18} />
            <div>{analyzeError.message || 'Không dùng được trợ lý AI.'} Số đo và kết quả phân loại ở trên vẫn đầy đủ.</div>
          </div>
        )}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="alert alert--warning" role="status">
            <AlertTriangle size={18} />
            <div>
              {error.message || 'Không tải được nhận định xu hướng.'}{' '}
              <Button variant="link" onClick={() => reload()}>
                Thử lại
              </Button>
            </div>
          </div>
        ) : data?.status === AI_TREND_STATUS.NOT_ENOUGH_DATA ? (
          <EmptyState
            title="Chưa đủ số đo"
            description={`Cần ít nhất 2 lần đo đã công bố trong ${trendPeriodOf(data.period).phrase} để phân tích xu hướng. Chọn khoảng dài hơn rồi bấm “Phân tích”.`}
          />
        ) : !hasAnalysis ? (
          analyzing ? (
            <div className="tr-ai__wait" />
          ) : (
            <EmptyState
              title="Chưa có nhận định xu hướng"
              description={`Bấm “Phân tích” để trợ lý AI viết bản nháp từ các lần đo đã công bố trong ${selected.phrase}.`}
            />
          )
        ) : (
          <>
            {data.stale && (
              <div className="alert alert--info mb-12" role="status">
                <Info size={18} />
                <div>
                  Số đo trong khoảng phân tích đã thay đổi (có số đo mới hoặc lần đo cũ đã ra khỏi khoảng). Bấm “Phân tích lại” để cập nhật.
                </div>
              </div>
            )}
            {editing ? (
              <AiTrendEditor
                data={data}
                serverErrors={serverErrors}
                saving={saving}
                onCancel={() => {
                  setEditing(false);
                  setServerErrors({});
                }}
                onSubmit={(content) => setConfirm({ content })}
              />
            ) : blocks.length ? (
              // Tổng quan cả dòng; Cần chú ý / Điểm tích cực / Gợi ý theo dõi chia cột; lưu ý dữ liệu một dòng (phương án A, 14/11/2026)
              <>
                {overview && (
                  <div className="tr-ai__block">
                    <h3 className="tr-ai__block-title">{overview.title}</h3>
                    <p className="tr-ai__overview">{overview.items[0].text}</p>
                  </div>
                )}
                {columns.length > 0 && (
                  <div className="tr-ai__cols">
                    {columns.map((b) => (
                      <div key={b.key} className={`tr-ai__col tr-ai__col--${b.key}`}>
                        <h3 className="tr-ai__block-title">
                          {b.title}
                          {b.key === 'followUps' && <span className="tr-ai__hint"> · phụ huynh không xem</span>}
                        </h3>
                        {b.key === 'attention' ? (
                          <ul className="tr-ai__list">
                            {b.items.map((item, i) => (
                              <li key={i} className="tr-ai__item tr-ai__item--warning">
                                <AlertTriangle size={16} />
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <ul className="tr-ai__bullets">
                            {b.items.map((item, i) => (
                              <li key={i}>{item.text}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {limitations && (
                  <p className="muted text-sm mt-12">
                    <strong>{limitations.title}:</strong> {limitations.items[0].text}
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Bản lưu trước HLT-21 chỉ có đoạn văn và cảnh báo */}
                <p className="tr-ai__summary">{data.summary}</p>
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
              </>
            )}
            <p className="muted text-xs mt-12">
              {data.source === 'HUMAN' ? 'AI tạo, giáo viên đã chỉnh sửa' : 'Do AI tạo'} lúc {formatDateTime(data.generatedAt)}
              {data.approvedAt && ` · ${data.approvedByName || 'Giáo viên'} duyệt lúc ${formatDateTime(data.approvedAt)}`}. Chỉ dùng số đo
              đã ghi (không gửi họ tên, liên hệ của trẻ); nội dung mô tả số liệu, không phải chẩn đoán. Phụ huynh chỉ xem bản đã duyệt,
              không gồm mục “Gợi ý theo dõi”, và nhận thông báo kèm phần tổng quan khi bản được duyệt.
            </p>
          </>
        )}
      </div>
      {analyzing && <AiWorkingOverlay scoped text="Đang phân tích xu hướng các lần đo…" />}
      <ConfirmationModal
        open={!!confirm}
        title="Duyệt nhận định xu hướng?"
        message="Sau khi duyệt, phụ huynh nhận thông báo kèm phần tổng quan và xem được bản này trên ứng dụng (không gồm mục “Gợi ý theo dõi”); bản này không sửa được nữa. Muốn đổi nội dung thì phân tích lại rồi duyệt bản mới."
        confirmLabel="Duyệt"
        onConfirm={approve}
        onClose={() => setConfirm(null)}
      />
    </section>
  );
}
