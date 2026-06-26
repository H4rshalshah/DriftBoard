import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Store scroll positions per route for back-navigation
const scrollPositions = new Map<string, number>();

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Save current scroll position before navigating away
    const savePosition = () => {
      scrollPositions.set(pathname, window.scrollY);
    };

    window.addEventListener('beforeunload', savePosition);
    return () => {
      window.removeEventListener('beforeunload', savePosition);
      savePosition();
    };
  }, [pathname]);

  useEffect(() => {
    const savedPosition = scrollPositions.get(pathname);

    // Slight delay to let the DOM render
    const timer = setTimeout(() => {
      if (savedPosition && savedPosition > 0) {
        // Restore scroll position for back navigation
        window.scrollTo({
          top: savedPosition,
          behavior: 'auto',
        });
      } else {
        // Scroll to top for new navigation
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'smooth',
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
