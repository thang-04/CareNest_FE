import { useId } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, FileEdit, FileText, Info, Send, XCircle } from 'lucide-react';
import {
  Breadcrumb,
  EmptyState as SharedEmptyState,
  FileUploader,
  Modal as SharedModal,
  SignaturePicker,
  Stepper as SharedStepper,
} from '@/components';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { formatDate, formatFileSize } from '@/utils/format';
import { EDU_STATUS_LABELS } from '@/models/education-plan/educationPlanConstants';

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

/** Breadcrumb (always starting at Trang chủ) + h1.page__title + actions on the right. */
export function PageHead({ crumbs, title, desc, actions }) {
  const items = crumbs?.length ? (crumbs[0].to === '/' ? crumbs : [HOME, ...crumbs]) : [HOME, { label: title }];
  return (
    <>
      <Breadcrumb items={items} />
      <div className="page__head ga-page-head">
        <div>
          <h1 className="page__title">{title}</h1>
          {desc && <p className="muted mt-8">{desc}</p>}
        </div>
        {actions && <div className="row row--wrap">{actions}</div>}
      </div>
    </>
  );
}

// DESIGN.md §6: waiting for approval = purple, done = green, returned = red, draft = gray.
export const EduStatusBadge = createStatusBadge(
  {
    DRAFT: ['gray', FileEdit],
    SENT: ['green', Send],
    PENDING_TL: ['purple', Clock],
    PENDING_VP: ['purple', Clock],
    APPROVED: ['green', CheckCircle2],
    REJECTED: ['red', XCircle],
  },
  EDU_STATUS_LABELS,
);

/** .card with optional numbered title, header actions and footer. bodyClass={null} renders children directly. */
export function Card({ title, num, actions, children, foot, bodyClass = 'card__body', className = '' }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card__header">
          <h2 className="card__title">
            {num && <span className="ga-num">{num}</span>}
            {title}
          </h2>
          {actions}
        </div>
      )}
      {bodyClass === null ? children : <div className={bodyClass}>{children}</div>}
      {foot && <div className="ga-card-foot">{foot}</div>}
    </section>
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
      <div style={{ flex: 1, minWidth: 0 }}>
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
export function Modal({ title, children, onClose, footer, width }) {
  const size = width > 760 ? 'xl' : width > 560 ? 'lg' : 'md';
  return (
    <SharedModal open title={title} onClose={onClose} footer={footer} size={size}>
      <div className="stack">{children}</div>
    </SharedModal>
  );
}

export function EmptyState({ title, desc, action, icon }) {
  return <SharedEmptyState icon={icon} title={title} description={desc} action={action} />;
}

const NOTICE = {
  info: ['alert--info', Info],
  ok: ['alert--success', CheckCircle2],
  warn: ['alert--warning', AlertTriangle],
  err: ['alert--danger', AlertOctagon],
};

/** In-page alert. tone: 'info' (default) | 'ok' | 'warn' | 'err'. */
export function Notice({ tone, children }) {
  const [cls, Icon] = NOTICE[tone] || NOTICE.info;
  return (
    <div className={`alert ${cls}`}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}

/** Processing history (oldest first); rejection reason shown under its entry. */
export function History({ items }) {
  if (!items?.length) return <p className="muted">Chưa có lịch sử xử lý.</p>;
  return (
    <ul className="history-list">
      {items.map((h, i) => (
        <li key={i}>
          <div className={`history-list__dot ${h.tone ? `ga-dot--${h.tone}` : ''}`} />
          <div>
            <div className="fw-600">{h.action}</div>
            <div className="muted text-xs">
              {h.by} · {h.role} · {fmtDateTime(h.at)}
            </div>
            {h.note && <div className="ga-note mt-8">Lý do: {h.note}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}
