import { useEffect, useState } from 'react';

const matches = (query) => typeof window !== 'undefined' && window.matchMedia(query).matches;

/** True while the CSS media query matches; updates on resize. */
export function useMediaQuery(query) {
  const [isMatch, setIsMatch] = useState(() => matches(query));

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setIsMatch(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return isMatch;
}
