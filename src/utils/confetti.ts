import confetti from 'canvas-confetti';

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
  ticks?: number;
  gravity?: number;
  scalar?: number;
  drift?: number;
}

/**
 * Bulletproof celebration confetti trigger.
 * Safely creates and cleans up an isolated DOM canvas element,
 * preventing any "canvas.getBoundingClientRect is not a function" errors.
 */
export function triggerCelebrationConfetti(options: ConfettiOptions = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  try {
    // Create dedicated, fully valid HTMLCanvasElement
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';

    // Ensure getBoundingClientRect exists and return actual viewport bounds
    canvas.width = window.innerWidth || document.documentElement.clientWidth || 360;
    canvas.height = window.innerHeight || document.documentElement.clientHeight || 640;

    document.body.appendChild(canvas);

    const confettiInstance = confetti.create(canvas, {
      resize: true,
      useWorker: false, // Prevents OffscreenCanvas getBoundingClientRect mismatch
    });

    const firePromise = confettiInstance({
      particleCount: options.particleCount ?? 80,
      spread: options.spread ?? 70,
      origin: options.origin ?? { y: 0.65 },
      colors: options.colors ?? ['#7C3AED', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'],
      ticks: options.ticks ?? 200,
      gravity: options.gravity ?? 1.2,
      scalar: options.scalar ?? 1.1,
    });

    if (firePromise && typeof firePromise.then === 'function') {
      firePromise.finally(() => {
        try {
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        } catch {
          // safe ignore
        }
      });
    } else {
      // Fallback cleanup after 3.5s
      setTimeout(() => {
        try {
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        } catch {
          // safe ignore
        }
      }, 3500);
    }
  } catch (error) {
    console.warn('Confetti animation suppressed safely:', error);
  }
}
