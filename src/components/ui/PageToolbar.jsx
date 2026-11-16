import { ResponsiveToolbar } from './ResponsiveToolbar';

export function PageToolbar({ children, leading, summary, className = '', 'aria-label': label = 'Thao tác trang' }) {
  if (!children && !leading)
    return (
      <div className={`responsive-toolbar page-toolbar ${className}`} aria-label={label} role="group">
        <div className="page-toolbar__summary">{summary}</div>
      </div>
    );
  return (
    <ResponsiveToolbar className={`page-toolbar ${className}`} aria-label={label}>
      {(leading || summary) && (
        <div className="page-toolbar__leading">
          {leading}
          {summary && <div className="page-toolbar__summary">{summary}</div>}
        </div>
      )}
      {children && <div className="page-toolbar__actions">{children}</div>}
    </ResponsiveToolbar>
  );
}
