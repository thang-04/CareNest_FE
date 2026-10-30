import { formatDate, formatDateTime } from '@/utils/format';

const metadata = (comment) => `${comment.recordedByName || 'Giáo viên'} · ${formatDateTime(comment.updatedAt)}`;

export function ClassCommentField({ value, onChange, comment, disabled, error }) {
  return (
    <div className="dg-class-comments field">
      <label className="field__label" htmlFor="daily-class-comment">
        Nhận xét chung của lớp
      </label>
      <textarea
        id="daily-class-comment"
        className={`textarea ${error ? 'input--error' : ''}`}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? 'daily-class-comment-error' : undefined}
        placeholder="Tình hình chung của lớp hôm nay"
      />
      {error && (
        <p className="field__error" id="daily-class-comment-error">
          {error}
        </p>
      )}
      {comment && <p className="text-xs text-2">Cập nhật: {metadata(comment)}</p>}
    </div>
  );
}

export function ClassCommentList({ comments = [] }) {
  return (
    <section className="dg-class-comments" aria-label="Nhận xét chung của lớp">
      <h2 className="text-md mb-12">Nhận xét chung của lớp</h2>
      {!comments.length ? (
        <p className="text-sm text-2">Chưa có nhận xét chung trong kỳ này.</p>
      ) : (
        comments.map((comment) => (
          <article key={comment.date} className="mb-12">
            <div className="row row--wrap gap-2">
              <strong className="text-sm">{formatDate(comment.date)}</strong>
              <span className="text-xs text-2">{metadata(comment)}</span>
            </div>
            <p className="dg-class-comment-text text-sm mt-4">{comment.text}</p>
          </article>
        ))
      )}
    </section>
  );
}
