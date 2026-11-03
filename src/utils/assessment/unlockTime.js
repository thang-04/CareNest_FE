// Thời gian nhập trên màn mở lại là giờ trường, độc lập múi giờ thiết bị.
export const defaultUnlockUntil = (yearEnd, now = Date.now()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(now + 3600000))
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return yearEnd && date > yearEnd
    ? { untilDate: yearEnd, untilTime: '23:59' }
    : { untilDate: date, untilTime: `${parts.hour}:${parts.minute}` };
};

export const parseUnlockUntil = (date, time) => new Date(`${date}T${time || ''}:00+07:00`);
