// Motion code loaded in its own file after the page appears (see components/Overlay.tsx):
// the animation features for drawers and dialogs, and `animate` for swipe releases.
import { animate, domAnimation } from 'motion/react'
export { animate }
export default domAnimation
