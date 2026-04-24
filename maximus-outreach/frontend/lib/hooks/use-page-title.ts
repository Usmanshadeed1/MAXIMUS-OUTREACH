import { useEffect } from "react";

/**
 * Sets document.title for the current page.
 * Restores the previous title on unmount.
 */
export function usePageTitle(pageTitle: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${pageTitle} | Maximus Outreach`;
    return () => {
      document.title = prev;
    };
  }, [pageTitle]);
}
