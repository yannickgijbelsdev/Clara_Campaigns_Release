import { useEffect, useState } from "react";

// Keeps a loading state visible for at least `ms` after mount, so the bear
// loader + tips are actually seen even when data arrives instantly.
// Returns true while the loader should still be shown.
export function useLoadingGate(ready, ms = 4000) {
  const [minElapsed, setMinElapsed] = useState(ms <= 0);

  useEffect(() => {
    if (ms <= 0) return;
    const t = setTimeout(() => setMinElapsed(true), ms);
    return () => clearTimeout(t);
  }, [ms]);

  return !(ready && minElapsed);
}

// Ensures an async action's spinner stays up for at least `ms` total.
export async function withMinDelay(promise, startedAt, ms = 4000) {
  const result = await promise;
  const remaining = ms - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  return result;
}
