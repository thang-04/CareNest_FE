import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';

/**
 * First line of every page in the app shell. items: [{ label, to? }] – the last item is the
 * current page and also becomes the browser tab title.
 */
export function Breadcrumb({ items }) {
  usePageTitle(items[items.length - 1]?.label);
  return (
    <nav className="breadcrumb no-print" aria-label="Breadcrumb">
      <Home size={15} />
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <ChevronRight size={14} />}
          {item.to && i < items.length - 1 ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span className="breadcrumb__current">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
