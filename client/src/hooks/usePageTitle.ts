import { useEffect } from 'react';

export const APP_NAME = 'EMR Appointments';

/** Sets the browser tab's title, which screen readers also announce after navigation. */
export const usePageTitle = (title: string): void => {
  useEffect(() => {
    document.title = `${title} – ${APP_NAME}`;
  }, [title]);
};
