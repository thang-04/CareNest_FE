import { useLayoutEffect, useRef } from 'react';

// Phóng tối đa để chữ không quá to trên màn rất rộng; thu nhỏ thoải mái cho màn hẹp.
const MAX_SCALE = 2;

const scrollParentOf = (el) => {
  for (let node = el?.parentElement; node && node !== document.body; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
};

/**
 * Khung xem trước giấy in: tờ `.print-sheet` giữ nguyên khổ thật (để In/PDF ngắt trang đúng),
 * cả tờ được phóng/thu bằng transform cho vừa chiều rộng khung chứa nên không còn dải trắng hai bên.
 * Bọc đúng một tờ giấy; `sheetRef` của tờ vẫn dùng cho PrintToolbar như cũ.
 */
export function PrintPaperFit({ children }) {
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const boxRef = useRef(null);

  // Vùng cuộn bao ngoài (thân modal) luôn chừa chỗ thanh cuộn: nếu không, tờ vừa chớm cao hơn khung thì thanh cuộn
  // bật làm khung hẹp lại, tờ thu nhỏ hết cần cuộn, thanh cuộn tắt, tờ phóng lại… lặp mãi thành nháy liên tục
  useLayoutEffect(() => {
    const scroller = scrollParentOf(frameRef.current);
    if (!scroller) return undefined;
    const previous = scroller.style.scrollbarGutter;
    scroller.style.scrollbarGutter = 'stable';
    return () => {
      scroller.style.scrollbarGutter = previous;
    };
  }, []);

  // Ghi thẳng vào DOM (không qua state) để mỗi lần đổi cỡ khung không render lại cả tờ giấy
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    const box = boxRef.current;
    if (!frame || !stage || !box) return undefined;
    const measure = () => {
      const sheet = box.firstElementChild;
      if (!sheet) return;
      const style = getComputedStyle(frame);
      const avail = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const naturalW = sheet.offsetWidth;
      if (!naturalW || avail <= 0) return;
      const scale = Math.min(MAX_SCALE, avail / naturalW);
      box.style.transform = `scale(${scale})`;
      stage.style.width = `${naturalW * scale}px`;
      stage.style.height = `${sheet.offsetHeight * scale}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(box);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="print-preview__paper" ref={frameRef}>
      <div className="print-preview__stage" data-print-fit ref={stageRef}>
        <div className="print-preview__scale" ref={boxRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
