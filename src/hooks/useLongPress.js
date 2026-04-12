import { useRef, useCallback, useEffect } from 'react';

/**
 * Returns event-handler props that fire `onLongPress` after holding for `duration` ms.
 * Spread the returned object onto the target element.
 * Supports both touch and mouse events for dev/production parity.
 */
export default function useLongPress(onLongPress, { duration = 800 } = {}) {
  const timer = useRef(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => cancel, [cancel]);

  const start = useCallback(() => {
    timer.current = setTimeout(() => {
      onLongPress();
    }, duration);
  }, [onLongPress, duration]);

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
  };
}
