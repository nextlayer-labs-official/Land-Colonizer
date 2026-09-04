'use client';

import { useEffect } from 'react';

export default function GlobalEffects() {
  useEffect(() => {
    const handler = () => {
      if (document.activeElement?.type === 'number') {
        document.activeElement.blur();
      }
    };
    document.addEventListener('wheel', handler, { passive: true });
    return () => document.removeEventListener('wheel', handler);
  }, []);

  return null;
}
