import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenLine, Soup } from '@/components/ui/icons';
import { Button } from './Button';
import { LottiePlayer } from './LottiePlayer';
import { modalStack } from './modalStack';

const STEP_MS = 900;
// Hoạt hình theo ngữ cảnh (user chọn): thực đơn = "Prepare Food", việc AI soạn chữ khác = giấy đang được viết
const ART = {
  cooking: { load: () => import('@/assets/lottie/prepare-food.json'), Icon: Soup },
  writing: { load: () => import('@/assets/lottie/text-writing.json'), Icon: PenLine },
};
const DEFAULT_STEPS = {
  cooking: ['Đang xem món và định lượng có sẵn…', 'Đang sắp món vào từng bữa…', 'Sắp xong…'],
  writing: ['Đang đọc dữ liệu…', 'Đang soạn nội dung…', 'Sắp xong…'],
};

/**
 * Lớp phủ khi AI đang chạy (ngoại lệ có blur của DESIGN.md): mặc định phủ cả màn, trên modal, dưới toast.
 * kind: 'cooking' (thực đơn) | 'writing'. `scoped`: chỉ phủ khối cha có `position: relative`.
 * `lock`: khóa cả bàn phím trong lúc chờ (kế hoạch giáo dục: mỗi lúc chỉ một việc AI).
 * `onCancel`: hiện nút Hủy ngay từ đầu (Tiền 28/11/2026).
 */
export function AiWorkingOverlay({
  kind = 'writing',
  text = 'AI đang soạn…',
  steps = DEFAULT_STEPS[kind],
  scoped = false,
  lock = false,
  onCancel,
}) {
  const [step, setStep] = useState(0);
  const art = ART[kind] || ART.writing;

  useEffect(() => {
    if (steps.length < 2) return undefined;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), STEP_MS);
    return () => clearInterval(id);
  }, [steps]);

  // Chiếm đỉnh stack modal để modal bên dưới không đóng bằng Esc giữa lúc AI đang chạy.
  useEffect(() => {
    if (scoped) return undefined;
    const token = {};
    modalStack.push(token);
    return () => modalStack.remove(token);
  }, [scoped]);

  // Lớp phủ chỉ chặn chuột: bỏ focus và nuốt phím để không gõ, Enter hay Ctrl+S phía dưới (vẫn cho tải lại trang)
  useEffect(() => {
    if (!lock) return undefined;
    if (!document.activeElement?.closest?.('.ai-veil')) document.activeElement?.blur?.();
    const stop = (e) => {
      // Phím trên nút của lớp phủ (Enter/Space ở nút Hủy) vẫn dùng được
      if (e.target?.closest?.('.ai-veil')) return;
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', stop, true);
    return () => window.removeEventListener('keydown', stop, true);
  }, [lock]);

  const veil = (
    <div className={`ai-veil ${scoped ? 'ai-veil--scoped' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <div className="ai-veil__body">
        <LottiePlayer
          load={art.load}
          className={`ai-veil__lottie ai-veil__lottie--${kind} ${scoped ? 'ai-veil__lottie--sm' : ''}`}
          fallback={<art.Icon size={scoped ? 30 : 42} />}
        />
        <div className="ai-veil__title">{text}</div>
        {steps.length > 0 && (
          <div key={step} className="ai-veil__step">
            {steps[step]}
          </div>
        )}
        {onCancel && (
          <>
            <Button autoFocus onClick={onCancel}>
              Hủy
            </Button>
            <div className="muted text-sm">Hủy thì lượt AI này vẫn được tính.</div>
          </>
        )}
      </div>
    </div>
  );
  return scoped ? veil : createPortal(veil, document.body);
}
