/**
 * Comprehensive scroll helper to guarantee resetting window scroll position to (0, 0)
 * across React DOM updates, animation frames, and browser/webview layout paints.
 */
export const scrollToTop = () => {
  const performScroll = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
      }
    } catch {
      window.scrollTo(0, 0);
    }
  };

  // Immediate reset
  performScroll();

  // Reset on next animation frame after React DOM commit
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      performScroll();
      // Reset on second animation frame after browser reflow and paint
      requestAnimationFrame(() => {
        performScroll();
      });
    });
  }

  // Timed resets for async image loading, webview layout recalculations, or smooth scroll interrupts
  setTimeout(performScroll, 20);
  setTimeout(performScroll, 80);
  setTimeout(performScroll, 200);
};
