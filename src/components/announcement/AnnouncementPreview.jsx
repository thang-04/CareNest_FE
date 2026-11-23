import { RichBody } from '@/components';

/** Khung xem trước nội dung thông báo, hỗ trợ cả bản HTML và bản chữ thường cũ. */
export default function AnnouncementPreview({ title = '', body = '', bodyHtml = '', label = 'Xem trước thông báo' }) {
  return (
    <aside className="announcement-notice-preview" aria-label={label}>
      <p className="announcement-notice-preview__label">{label}</p>
      <div className="announcement-notice-preview__card" aria-live="polite">
        <strong className="announcement-notice-preview__title">{title.trim() || <span className="muted">Chưa có tiêu đề</span>}</strong>
        <RichBody html={bodyHtml} text={body} className="announcement-body" empty={<span className="muted">Chưa có nội dung</span>} />
      </div>
    </aside>
  );
}
