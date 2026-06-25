import { useState } from 'react';

export function useIsTauri() {
  const [isTauri] = useState(() => {
    if (typeof window === 'undefined') return false;
    return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
  });

  return isTauri;
}
