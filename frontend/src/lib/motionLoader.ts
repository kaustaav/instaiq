// Motion's animation code lives in its own file (lib/motionFeatures.ts), fetched after the page appears,
// so it never slows the first load. Fetch it shortly after start-up so even the first drawer animates at once.
export const motionCode = () => import('./motionFeatures')
export const loadFeatures = () => motionCode().then(r => r.default)
window.setTimeout(() => void loadFeatures(), 1500)
