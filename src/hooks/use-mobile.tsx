import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Returns `true` when the viewport is narrower than the mobile breakpoint.
 *
 * Initial value is always `false` on first render so that server-rendered and
 * first-client-render markup match — this avoids React hydration warnings.
 * After mount, the effect reconciles the value with the actual viewport.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
