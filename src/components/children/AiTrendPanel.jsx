import { Sparkles, AlertTriangle, Info, RefreshCw } from '@/components/ui/icons';
import { useAsync } from '@/hooks/useAsync';
import { runWithAiHold } from '@/hooks/loadingTiming';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { analyzeHealthTrend } from '@/services/children/childrenService';
import { AI_TREND_STATUS } from '@/models/children/childrenConstants';
import { formatDateTime } from '@/utils/format';

/** AI panel: optional help, the page stays usable when it fails (GBR-AI-06, MSG30). */
export function AiTrendPanel({ childId, user }) {
  // AI tự chạy khi mở trang ⇒ chỉ phủ card này (user chốt), giữ tối thiểu như mọi lớp phủ AI
  const { data, loading, error, reload } = useAsync(() => runWithAiHold(() => analyzeHealthTrend(childId, user)), [childId, user?.id], {
    enabled: !!childId,
  });
  return (
    <section className="card mt-16 tr-ai">
      <div className="card__header row row--between row--wrap gap-2">
        <div className="row gap-2">
          <Sparkles size={18} className="tr-ai__icon" />
          <h2 className="card__title">Nhận định xu hướng</h2>
          {/* Không dùng AiDraftTag/AiDraftLabel: nhận định xu hướng chỉ tham khảo, không có bước duyệt */}
          <StatusBadge tone="purple" label="Bản nháp AI – chỉ để tham khảo" />
        </div>
        <button className="btn btn--sm" onClick={() => reload()} disabled={loading}>
          <RefreshCw size={14} /> Phân tích lại
        </button>
      </div>
      <div className="card__body">
        {loading ? (
          <div className="tr-ai__wait" />
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
      {loading && <AiWorkingOverlay scoped text="Đang phân tích xu hướng các lần đo…" />}
    </section>
  );
}
