/**
 * Màn chờ khởi động toàn màn hình (kiểm tra phiên, chờ trang đầu tiên).
 * Cùng markup + class với splash dựng sẵn trong index.html ⇒ React thay vào không chớp.
 */
export function AppSplash() {
  return (
    <div className="boot-splash" role="status" aria-label="Đang mở CareNest">
      <img src="/favicon.png" width="64" height="64" alt="" />
      <div className="boot-splash__name">
        Care<span>Nest</span>
      </div>
      <div className="boot-splash__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
