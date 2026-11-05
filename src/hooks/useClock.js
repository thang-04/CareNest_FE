import { useEffect, useState } from 'react';

const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
const nowHHmm = () => fmt.format(new Date());

/** Giờ hiện tại "HH:mm" theo giờ trường (Asia/Ho_Chi_Minh), tự cập nhật; dùng để đánh dấu "bây giờ" trên dòng thời gian. */
export function useClock(intervalMs = 30000) {
  const [now, setNow] = useState(nowHHmm);
  useEffect(() => {
    const id = setInterval(() => setNow(nowHHmm()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
