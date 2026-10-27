import { useEffect, useRef, useState } from 'react';

/**
 * Hoạt hình Lottie trang trí (aria-hidden). lottie-web và file JSON tải lazy (chunk riêng) lúc gắn; chưa tải xong
 * hoặc lỗi tải thì hiện `fallback`. Chỉ nạp file Lottie đóng gói trong `src/assets/lottie/` đã soát (lottie-web chạy
 * expression bằng eval). Vẫn chạy khi bật giảm chuyển động (user chốt 2026-10-21).
 * load: () => import('@/assets/lottie/<file>.json') — khai báo ở cấp module để không nạp lại mỗi lần render.
 */
export function LottiePlayer({ load, loop = true, speed = 1, className = '', fallback = null }) {
  const box = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let anim = null;
    let cancelled = false;
    Promise.all([import('lottie-web'), load()])
      .then(([{ default: lottie }, { default: animationData }]) => {
        if (cancelled || !box.current) return;
        anim = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop, autoplay: true, animationData });
        anim.setSpeed(speed);
        setReady(true);
      })
      .catch(() => {
        /* Không tải được hoạt hình (mất mạng giữa chừng): giữ fallback tĩnh, trạng thái vẫn hiển thị bằng chữ */
      });
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [load, loop, speed]);

  return (
    <div className={`lottie-player ${className}`} aria-hidden="true">
      <div ref={box} className="lottie-player__canvas" />
      {!ready && fallback}
    </div>
  );
}
