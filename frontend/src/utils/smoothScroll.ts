import { useEffect, useRef, useCallback } from 'react';

/**
 * Smoothly scrolls to a target element with offset support
 */
export function scrollToElement(elementId: string, offset = 80): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top,
    behavior: 'smooth',
  });
}

/**
 * Hook that returns a scroll-to function for smooth navigation
 */
export function useSmoothScroll() {
  return useCallback((elementId: string, offset = 80) => {
    scrollToElement(elementId, offset);
  }, []);
}

interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook that observes elements and triggers callbacks when they enter the viewport
 * Useful for scroll-triggered animations
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {}
) {
  const { threshold = 0.1, rootMargin = '0px 0px -60px 0px', triggerOnce = true } = options;
  const ref = useRef<T>(null);
  const isIntersecting = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          isIntersecting.current = true;
          element.dataset.revealed = 'true';
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          isIntersecting.current = false;
          element.dataset.revealed = 'false';
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return ref;
}

/**
 * Enable smooth scrolling for the entire page with enhanced scroll behavior
 */
export function enableEnhancedScrolling(): void {
  const html = document.documentElement;
  html.style.scrollBehavior = 'smooth';

  // Add scroll event listener for performance optimization
  let ticking = false;
  const handleScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        document.body.dataset.scrolling = window.scrollY > 10 ? 'true' : 'false';
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
}

/**
 * Hook that enables enhanced scrolling on mount
 */
export function useEnhancedScrolling(): void {
  useEffect(() => {
    enableEnhancedScrolling();
  }, []);
}
