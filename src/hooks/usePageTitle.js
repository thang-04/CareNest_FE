import { useEffect } from 'react';
import { APP_NAME } from '@/config/app';

/** Browser tab title: "<page> · CareNest". Called by Breadcrumb and AuthLayout, so pages get it for free. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
