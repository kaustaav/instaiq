/** Phone layout breakpoint. Keep in sync with the `max-width: 768px` media queries in the CSS. */
export const MOBILE_QUERY = '(max-width: 768px)'

export const isMobile = () => window.matchMedia(MOBILE_QUERY).matches
