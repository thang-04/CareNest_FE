import { useState } from 'react';
import { usePhotoUrl } from '@/hooks/usePhotoUrl';

export function PortraitImage({ source, alt, className, children }) {
  const url = usePhotoUrl(source);
  const [broken, setBroken] = useState(null);
  if (!url || broken === url) return children || null;
  return <img src={url} alt={alt} className={className} onError={() => setBroken(url)} />;
}
