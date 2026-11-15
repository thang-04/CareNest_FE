import { createContext, useContext } from 'react';

/** Ô trên thanh trên dành cho đường dẫn + tên trang; null khi trang nằm ngoài vỏ app (trang in, trang lỗi toàn màn). */
export const HeaderSlotContext = createContext(null);

export const useHeaderSlot = () => useContext(HeaderSlotContext);
