import { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  FileEdit,
  FileText,
  Lock,
  Send,
  XCircle,
} from '@/components/ui/icons';
import {
  Breadcrumb,
  EmptyState as SharedEmptyState,
  FileUploader,
  Modal as SharedModal,
  SignaturePicker,
  Stepper as SharedStepper,
} from '@/components';
import { StatusBadge, createStatusBadge } from '@/components/ui/StatusBadge';
import { ResponsiveToolbar } from '@/components/ui/ResponsiveToolbar';
import { formatDate, formatFileSize } from '@/utils/format';
import { EDU_STATUS_LABELS, educationDisplayStatus } from '@/models/education-plan/educationPlanConstants';
import { WORKFLOW_ROLES } from '@/models/education-plan/eduConfig';
import { waitingLabel } from '@/models/education-plan/reviewTurn.mjs';
import { isOverdueDoc } from '@/models/education-plan/deadline.mjs';
import { reviewHistoryItem } from '@/models/education-plan/reviewHistory.mjs';

/*
 * Thin wrappers that keep the lesson-plan screens on the shared components and classes of
 * DESIGN.md (Breadcrumb, card, Stepper, Modal, alert, StatusBadge, SignaturePicker, FileUploader).
 */

const HOME = { label: 'Trang chủ', to: '/' };

/** dd/mm/yyyy from 'yyyy-mm-dd' */
export const fmtDate = (iso) => (iso ? formatDate(iso.slice(0, 10)) : '—');

/** 'yyyy-mm-dd HH:mm' -> 'dd/mm/yyyy HH:mm' */
export const fmtDateTime = (s) => {
  if (!s) return '—';
  const [date, time] = s.split(' ');
  return `${fmtDate(date)}${time ? ` ${time}` : ''}`;
};

/**
 * Breadcrumb (always starting at Trang chủ) + mô tả/actions; tiêu đề h1 chỉ cho trình đọc màn hình.
 * Module kế hoạch giáo dục không dùng thẻ đầu trang có hình minh hoạ (Tiền chốt 12/10) để dành chỗ cho nội dung.
 */
export function PageHead({ crumbs, title, desc, actions }) {
  const items = crumbs?.length ? (crumbs[0].to === '/' ? crumbs : [HOME, ...crumbs]) : [HOME, { label: title }];
  return (
    <>
      <Breadcrumb items={items} />
      {/* Dùng đầu trang chung: h1 ẩn (đường dẫn đã hiện tên trang, Tiền chốt 12/10), mô tả dưới, nút lên hàng breadcrumb */}
      <div className="page__head">
        <h1 className="page__title">{title}</h1>
        {desc && <p className="page__desc">{desc}</p>}
        {actions && (
          <ResponsiveToolbar className="page__actions" aria-label="Thao tác trang">
            {actions}
          </ResponsiveToolbar>
        )}
      </div>
    </>
  );
}

// DESIGN.md §3.2: waiting for approval = purple, done = green, returned = red, draft = gray.
const BaseEduStatusBadge = createStatusBadge(
  {
    DRAFT: ['gray', FileEdit],
    REVIEW: ['purple', Clock],
    SENT: ['green', Send],
    PENDING_TL: ['purple', Clock],
    PENDING_VP: ['purple', Clock],
    PENDING_HT: ['purple', Clock],
    APPROVED: ['green', CheckCircle2],
    REJECTED: ['red', XCircle],
  },
  EDU_STATUS_LABELS,
);
// EDU-93: người không đúng lượt thấy "Đang chờ <vai trò> duyệt", cùng tông chờ duyệt
const WaitingBadge = ({ label, size }) => <StatusBadge tone="purple" icon={Clock} label={label} size={size} />;
// EDU-109: hồ sơ chưa ban hành đã quá hạn chỉ hiện "Quá hạn" (chữ + icon, không chỉ dựa vào màu)
const OverdueBadge = ({ size }) => <StatusBadge tone="red" icon={AlertTriangle} label="Quá hạn" size={size} />;

export const EduStatusBadge = ({ status, doc, ...props }) => {
  if (isOverdueDoc({ ...doc, status })) return <OverdueBadge size={props.size} />;
  const waiting = waitingLabel({ ...doc, status }, WORKFLOW_ROLES);
  if (waiting) return <WaitingBadge label={waiting} size={props.size} />;
  return <BaseEduStatusBadge status={educationDisplayStatus({ ...doc, status })} {...props} />;
};

/** Hạn gửi kế hoạch giáo dục ngày chỉ để nhắc, không chặn. */
export const DueStateBadge = createStatusBadge(
  { late: ['red', AlertTriangle], soon: ['orange', Clock] },
  { late: 'Quá hạn', soon: 'Sắp đến hạn' },
);

/** Dòng chưa có hồ sơ: chưa lập / chưa soạn, hoặc chưa tới lượt (khóa). */
export const DocAvailabilityBadge = createStatusBadge(
  { NOT_PLANNED: ['gray', FileText], NOT_DRAFTED: ['gray', FileText], LOCKED: ['gray', Lock] },
  { NOT_PLANNED: 'Chưa lập', NOT_DRAFTED: 'Chưa soạn', LOCKED: 'Chưa thể bắt đầu' },
);

/** Trạng thái kế hoạch năm: Tổ trưởng gửi Phó HT, Phó HT duyệt ban hành (ký tay trên bản in). */
const BaseYearPlanStatusBadge = createStatusBadge(
  {
    DRAFT: ['gray', FileEdit],
    REVIEW: ['purple', Clock],
    EDITING: ['orange', Lock],
    SENT: ['green', Send],
    PENDING_TL: ['purple', Clock],
    PENDING_VP: ['purple', Clock],
    PENDING_HT: ['purple', Clock],
    APPROVED: ['green', CheckCircle2],
    REPLACED: ['gray', FileText],
    REJECTED: ['red', XCircle],
  },
  { ...EDU_STATUS_LABELS, APPROVED: 'Đã ban hành', REPLACED: 'Đã thay thế' },
);
export const YearPlanStatusBadge = ({ status, doc, ...props }) => {
  if (isOverdueDoc({ ...doc, status })) return <OverdueBadge size={props.size} />;
  const waiting = waitingLabel({ ...doc, status }, WORKFLOW_ROLES);
  if (waiting) return <WaitingBadge label={waiting} size={props.size} />;
  return <BaseYearPlanStatusBadge status={educationDisplayStatus({ ...doc, status })} {...props} />;
};

/** .card with optional numbered title, header actions and footer. bodyClass={null} renders children directly. */
export function Card({ title, num, actions, children, foot, bodyClass = 'card__body', className = '', collapsed = false, onToggle }) {
  const bodyId = useId();
  const body = bodyClass === null ? children : <div className={bodyClass}>{children}</div>;
  return (
    <section className={`card ${className} ${onToggle && collapsed ? 'ga-card--collapsed' : ''}`}>
      {title && (
        <div className="card__header">
          <h2 className="card__title">
            {num && <span className="ga-num">{num}</span>}
            {onToggle ? (
              // Bấm tiêu đề để thu gọn / mở thẻ (Tiền 03/11)
              <button type="button" className="ga-card-toggle" aria-expanded={!collapsed} aria-controls={bodyId} onClick={onToggle}>
                <ChevronDown size={18} aria-hidden className="ga-card-toggle__icon" />
                {title}
              </button>
            ) : (
              title
            )}
          </h2>
          {actions}
        </div>
      )}
      {onToggle ? (
        <div id={bodyId} hidden={collapsed}>
          {body}
          {foot && <div className="ga-card-foot">{foot}</div>}
        </div>
      ) : (
        <>
          {body}
          {foot && <div className="ga-card-foot">{foot}</div>}
        </>
      )}
    </section>
  );
}

/**
 * Nút "Thu gọn tất cả / Mở rộng tất cả" dùng chung mọi trang, tab kế hoạch giáo dục (Tiền 12/11/2026): bấm lần lượt các nút
 * thu gọn thẻ (.ga-card-toggle) trong trang (trừ hộp thoại) nên mỗi thẻ vẫn giữ trạng thái của nó. Không có thẻ nào ⇒ ẩn.
 * ponytail: đọc trạng thái từ aria-expanded trên DOM thay vì nâng state mọi thẻ lên trang; đổi sang context nếu cần điều khiển từ dữ liệu.
 */
export function FoldAllButton() {
  const ref = useRef(null);
  const [state, setState] = useState({ any: false, allClosed: false });
  const toggles = () =>
    [...(ref.current?.closest('.ga-page')?.querySelectorAll('.ga-card-toggle[aria-expanded]') || [])].filter(
      (b) => !b.closest('[role="dialog"], .modal'),
    );
  useEffect(() => {
    const root = ref.current?.closest('.ga-page');
    if (!root) return undefined;
    const read = () => {
      const list = toggles();
      const next = { any: list.length > 0, allClosed: list.length > 0 && list.every((b) => b.getAttribute('aria-expanded') === 'false') };
      setState((s) => (s.any === next.any && s.allClosed === next.allClosed ? s : next));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-expanded'] });
    return () => observer.disconnect();
  }, []);
  const open = state.allClosed;
  return (
    <button
      ref={ref}
      type="button"
      className="btn btn--sm btn--outline-primary"
      hidden={!state.any}
      onClick={() => toggles().forEach((b) => (b.getAttribute('aria-expanded') === 'true') === open || b.click())}
    >
      {open ? <ChevronsUpDown size={16} aria-hidden /> : <ChevronsDownUp size={16} aria-hidden />}{' '}
      {open ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
    </button>
  );
}

/** Shared Stepper inside a card. steps: string[]; onStep(i) for steps already reached. */
export function Stepper({ steps, current, onStep, maxReached }) {
  return (
    <div className="card stepper-card">
      <SharedStepper steps={steps} current={current} maxReached={maxReached ?? current} onStepClick={onStep} />
    </div>
  );
}

/**
 * Form field: label + control + error/hint/counter.
 * inline = label on the left (.form-row), top = label aligned to the first line of a textarea.
 */
export function Field({ label, required, error, hint, children, inline, top, htmlFor, counter }) {
  const fallbackId = useId();
  const labelEl = (
    <label className={inline ? 'form-row__label' : 'field__label'} htmlFor={htmlFor || undefined} id={htmlFor ? undefined : fallbackId}>
      {label}
      {required && <span className="req">*</span>}
    </label>
  );
  const meta = (error || hint || counter) && (
    <div className="ga-field-meta">
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : (
        <span className="field__hint">{hint}</span>
      )}
      {counter && <span className="char-count">{counter}</span>}
    </div>
  );
  if (inline) {
    return (
      <div className={`form-row ${top ? 'form-row--top' : ''}`}>
        {labelEl}
        <div className="form-row__control">
          {children}
          {meta}
        </div>
      </div>
    );
  }
  return (
    <div className="field">
      {labelEl}
      {children}
      {meta}
    </div>
  );
}

const sizeText = (size) => (typeof size === 'number' ? formatFileSize(size) : size);

/** Attachment upload (shared FileUploader). multiple={false} keeps only the latest file. */
export function FileUpload({ files, onChange, invalid, multiple = true }) {
  const withIds = files.map((f, i) => ({ id: f.id || `${f.name}-${i}`, ...f }));
  return (
    <div className={invalid ? 'ga-upload--error' : undefined}>
      <FileUploader files={withIds} onChange={(next) => onChange(multiple ? next : next.slice(-1))} />
    </div>
  );
}

/** Attachment row (read-only unless onRemove is given). */
export function FileItem({ file, onRemove }) {
  return (
    <div className="file-row">
      <FileText size={26} color="var(--file-pdf)" />
      <div className="flex-1 min-w-0">
        {file.dataUrl ? (
          <a href={file.dataUrl} download={file.name} className="file-row__name">
            {file.name}
          </a>
        ) : (
          <div className="file-row__name">{file.name}</div>
        )}
        <div className="muted text-sm">{sizeText(file.size)}</div>
      </div>
      {onRemove && (
        <button type="button" className="btn btn--sm btn--ghost" onClick={onRemove}>
          Xóa tệp
        </button>
      )}
    </div>
  );
}

/**
 * Signature of the current account (shared SignaturePicker with signatures saved per account).
 * value / onChange keep the lesson-plan shape: { type: 'saved', data: imageUrl } | null.
 */
export function SignatureBox({ value, onChange, invalid }) {
  return (
    <SignaturePicker
      variant="compact"
      value={value?.data || null}
      onChange={({ url }) => onChange(url ? { type: 'saved', data: url } : null)}
      error={invalid ? 'Vui lòng ký xác nhận' : undefined}
    />
  );
}

export function SignatureView({ sig, name }) {
  if (!sig) return <span className="muted">Chưa ký</span>;
  return (
    <div className="ga-sign-preview">
      {sig.data && /^(data:|blob:|https?:|\/)/.test(sig.data) ? (
        <img src={sig.data} alt={`Chữ ký của ${name}`} />
      ) : (
        <span className="ga-signature-font">{name}</span>
      )}
    </div>
  );
}

/** Always-open modal: the page decides when to render it. */
export function Modal({ title, children, onClose, footer, width, className }) {
  const size = width > 760 ? 'xl' : width > 560 ? 'lg' : 'md';
  return (
    <SharedModal open title={title} onClose={onClose} footer={footer} size={size} className={`ga-modal ${className || ''}`}>
      <div className="stack">{children}</div>
    </SharedModal>
  );
}

export function EmptyState({ title, desc, action, icon }) {
  return <SharedEmptyState icon={icon} title={title} description={desc} action={action} />;
}

/** Thông báo trống luôn nằm trong card (cùng khung với hàng lọc), chỉ có tiêu đề. */
export function EmptyCard(props) {
  return (
    <Card bodyClass={null}>
      <EmptyState {...props} />
    </Card>
  );
}

/** EDU-99: lỗi đỏ, thông tin và kết quả xử lý xanh lá. */
export function Notice({ children, tone = 'err' }) {
  const positive = tone === 'info' || tone === 'ok';
  return (
    <div className={positive ? 'text-success text-sm' : 'field__error'} role={positive ? 'status' : 'alert'}>
      {children}
    </div>
  );
}

const reviewClock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Lịch sử duyệt đi từ sự kiện đầu tiên đến cập nhật mới nhất. */
export function History({ items }) {
  if (!items?.length) return <p className="muted">Chưa có lịch sử xử lý.</p>;
  return (
    <ol className="ga-review-timeline">
      {items.map((event, index) => {
        const h = reviewHistoryItem(event);
        const latest = index === items.length - 1;
        const instant = h.at?.includes('T') ? new Date(h.at) : null;
        const at = instant ? (Number.isFinite(instant.getTime()) ? reviewClock.format(instant) : null) : h.at ? fmtDateTime(h.at) : null;
        return (
          <li key={event.id ?? index} className="ga-review-timeline__step" data-tone={h.tone} aria-current={latest ? 'step' : undefined}>
            <div className="ga-review-timeline__heading">
              <strong>{h.title}</strong>
              {latest && <span className="ga-review-timeline__latest">Mới nhất</span>}
            </div>
            {(h.actor || at) && (
              <div className="ga-review-timeline__meta">
                {h.actor && <span>{h.actor}</span>}
                {at && <time dateTime={h.at.replace(' ', 'T')}>{at}</time>}
              </div>
            )}
            {h.deadline && <p className="text-success">Hạn mới: {fmtDate(h.deadline)}</p>}
            {h.note && (
              <p className={h.rejected ? 'text-danger ga-review-timeline__note' : 'text-success ga-review-timeline__note'}>
                <strong>{h.rejected ? 'Lý do' : 'Ghi chú'}:</strong> {h.note}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
