import { useState } from 'react';
import { Sparkles, AlertTriangle, Info, RefreshCw } from '@/components/ui/icons';
import { Button, EmptyState, LoadingState } from '@/components';
import { useAsync } from '@/hooks/useAsync';
import { runWithAiHold } from '@/hooks/loadingTiming';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { TrendReviewBadge } from '@/components/children/ChildBadges';
import { analyzeHealthTrend, getLatestHealthTrend } from '@/services/children/childrenService';
import { AI_TREND_STATUS } from '@/models/children/childrenConstants';
import { trendBlocks } from '@/utils/children/healthTrend';
import { formatDateTime } from '@/utils/format';

/**
 * Nhận định xu hướng (HLT-05, HLT-21): mở trang chỉ đọc bản mới nhất, AI chạy khi bấm "Phân tích" (user 14/11, thay chốt 20/10).
 * AI lỗi không chặn trang: số đo, biểu đồ vẫn dùng được (GBR-AI-06, MSG30).
 */
export function AiTrendPanel({ childId, user }) {
  const { data, loading, error, reload, setData } = useAsync(() => getLatestHealthTrend(childId, user), [childId, user?.id], {
    enabled: !!childId,
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      setData(await runWithAiHold(() => analyzeHealthTrend(childId, user)));
    } catch (err) {
      // AI-03: giữ bản đang hiển thị, chỉ báo lỗi trong card
      setAnalyzeError(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const hasAnalysis = data?.status === AI_TREND_STATUS.OK;
  const blocks = hasAnalysis ? trendBlocks(data) : [];
  return (
    <section className="card mt-16 tr-ai">
      <div className="card__header row row--between row--wrap gap-2">
        <div className="row gap-2">
          <Sparkles size={18} className="tr-ai__icon" />
          <h2 className="card__title">Nhận định xu hướng</h2>
          {hasAnalysis && <TrendReviewBadge status={data.draft ? 'DRAFT' : 'APPROVED'} />}
        </div>
        <Button size="sm" variant={hasAnalysis ? undefined : 'primary'} icon={RefreshCw} onClick={analyze} disabled={loading || analyzing}>
          {hasAnalysis ? 'Phân tích lại' : 'Phân tích'}
        </Button>
      </div>
      <div className="card__body">
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
          <EmptyState title="Chưa đủ số đo" description="Cần ít nhất 2 lần đo đã công bố để phân tích xu hướng." />
        ) : !hasAnalysis ? (
          analyzing ? (
            <div className="tr-ai__wait" />
          ) : (
            <EmptyState
              title="Chưa có nhận định xu hướng"
              description="Bấm “Phân tích” để trợ lý AI viết bản nháp từ các lần đo đã công bố."
            />
          )
        ) : (
          <>
            {data.stale && (
              <div className="alert alert--info mb-12" role="status">
                <Info size={18} />
                <div>Đã có số đo mới sau lần phân tích này. Bấm “Phân tích lại” để cập nhật.</div>
              </div>
            )}
            {blocks.length ? (
              blocks.map((b) => (
                <div key={b.key} className="tr-ai__block">
                  <h3 className="tr-ai__block-title">{b.title}</h3>
                  {b.key === 'overview' ? (
                    <p>{b.items[0].text}</p>
                  ) : (
                    <ul className="tr-ai__list">
                      {b.items.map((item, i) => (
                        <li key={i} className={`tr-ai__item${b.key === 'attention' ? ' tr-ai__item--warning' : ''}`}>
                          {b.key === 'attention' ? <AlertTriangle size={16} /> : <Info size={16} />}
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
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
              không gồm mục “Gợi ý theo dõi”.
            </p>
          </>
        )}
      </div>
      {analyzing && <AiWorkingOverlay scoped text="Đang phân tích xu hướng các lần đo…" />}
    </section>
  );
}
