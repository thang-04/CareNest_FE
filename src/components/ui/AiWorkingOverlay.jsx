import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenLine, Soup } from '@/components/ui/icons';
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
 */
export function AiWorkingOverlay({ kind = 'writing', text = 'AI đang soạn…', steps = DEFAULT_STEPS[kind], scoped = false }) {
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
      </div>
    </div>
  );
  return scoped ? veil : createPortal(veil, document.body);
}
