import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from '@/components/ui/icons';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useHeaderSlot } from '@/contexts/HeaderSlotContext';

/**
 * Đường dẫn + tên trang của mọi trang trong vỏ app. items: [{ label, to? }] – mục cuối là trang hiện tại và thành
 * tiêu đề tab. Trang vẫn khai báo ở đầu nội dung, nhưng phần hiển thị được đưa lên thanh trên (bớt một hàng).
 */
export function Breadcrumb({ items }) {
  usePageTitle(items[items.length - 1]?.label);
  const slot = useHeaderSlot();
  const mark = useRef(null);
  // Màn con nhúng trong màn khác (bước thiết lập năm học) không ghi đè đường dẫn của màn mẹ
  const [embedded, setEmbedded] = useState(false);
  useLayoutEffect(() => {
    setEmbedded(!!mark.current?.closest('.sc-setup__embed'));
  }, []);
  const nav = (
    <nav className="breadcrumb no-print" aria-label="Breadcrumb">
      <Home size={15} />
      {items.map((item, i) => (
        <Fragment key={`${i}-${item.label}`}>
          {i > 0 && <ChevronRight size={14} />}
          {item.to && i < items.length - 1 ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span className="breadcrumb__current">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
  if (!slot) return nav;
  return (
    <>
      <span ref={mark} hidden />
      {!embedded && createPortal(nav, slot)}
    </>
  );
}
