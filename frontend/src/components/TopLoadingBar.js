import { useEffect, useState, useRef } from "react";

export default function TopLoadingBar() {
  const [active, setActive] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        clearTimeout(hideTimer.current);
        setActive(true);
      } else {
        // small delay so quick requests still show a brief bar
        hideTimer.current = setTimeout(() => setActive(false), 250);
      }
    };
    window.addEventListener("clara:loading", handler);
    return () => {
      window.removeEventListener("clara:loading", handler);
      clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] pointer-events-none">
      {active && (
        <div className="clara-loadbar-track">
          <span className="clara-loadbar-fill" />
        </div>
      )}
    </div>
  );
}
