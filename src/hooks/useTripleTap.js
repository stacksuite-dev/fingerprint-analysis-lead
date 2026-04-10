import { useRef, useCallback } from 'react';

/**
 * Returns an onClick handler that fires `onTrigger` after `count` rapid taps
 * within `windowMs`. No visual feedback — designed for hidden admin gestures.
 */
export default function useTripleTap(onTrigger, { count = 3, windowMs = 600 } = {}) {
  const taps = useRef([]);

  return useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < windowMs), now];

    if (taps.current.length >= count) {
      taps.current = [];
      onTrigger();
    }
  }, [onTrigger, count, windowMs]);
}
