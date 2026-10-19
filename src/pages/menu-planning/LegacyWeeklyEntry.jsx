import { Navigate, useParams, useSearchParams } from 'react-router-dom';

export default function LegacyWeeklyEntry() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  if (id) next.set('id', id);
  return <Navigate to={{ pathname: '/menu/weekly', search: next.size ? `?${next}` : '' }} replace />;
}
