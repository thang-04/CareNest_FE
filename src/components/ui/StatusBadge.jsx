/**
 * Shared status chip. Every feature maps its own statuses to ONE of these tones
 * so the same color always means the same thing across the app:
 *
 *  gray    – draft, cancelled, inactive
 *  orange  – waiting for someone else (chờ bàn giao, chờ kiểm kê)
 *  blue    – in progress (đang kiểm kê, chờ xác nhận nhận)
 *  purple  – waiting for review / approval (chờ duyệt, chờ phê duyệt, chênh lệch)
 *  red     – needs action / rejected (cần điều chỉnh, yêu cầu kiểm lại)
 *  green   – done (hoàn thành, đã duyệt)
 *  teal    – informational role tag (người nhận)
 */
export const STATUS_TONES = ['gray', 'orange', 'blue', 'purple', 'red', 'green', 'teal'];

export function StatusBadge({ tone = 'gray', icon: Icon, label, size = 'md' }) {
  const large = size === 'lg';
  return (
    <span className={`chip chip--${tone} ${large ? 'chip--lg' : ''}`}>
      {Icon && <Icon size={large ? 17 : 14} />}
      {label}
    </span>
  );
}

/**
 * Builds a badge component from a { STATUS: [tone, Icon] } map and a label map.
 * Usage: export const MyStatusBadge = createStatusBadge(STYLE_MAP, LABELS);
 */
export const createStatusBadge = (styleMap, labels) =>
  function FeatureStatusBadge({ status, size }) {
    const [tone, icon] = styleMap[status] || ['gray', null];
    return <StatusBadge tone={tone} icon={icon} label={labels[status] || status} size={size} />;
  };
