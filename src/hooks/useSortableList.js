/** Đưa phần tử ở vị trí `from` tới vị trí `to` (chỉ số sau khi đã rút phần tử ra). Kéo-thả: `@/components/ui/Sortable`. */
export function moveItem(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
