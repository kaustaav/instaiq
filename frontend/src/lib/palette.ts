/**
 * Apple's system colours as tinted tags: a soft fill plus a darker text colour that stays readable
 * on it (all pairs ≥ 4.5:1). Dots are the full-strength system colours (they carry no text).
 */
export type Tone = { bg: string; fg: string }

export const TONE = {
  gray: { bg: '#F0F0F3', fg: '#515154' },
  muted: { bg: '#F0F0F3', fg: '#666669' },
  blue: { bg: '#E6F0FD', fg: '#0058B0' },
  indigo: { bg: '#ECECFB', fg: '#3634A3' },
  purple: { bg: '#F4EAFB', fg: '#8944AB' },
  teal: { bg: '#E2F3F6', fg: '#0B6E80' },
  orange: { bg: '#FFF1E0', fg: '#A04A00' },
  green: { bg: '#E5F5E9', fg: '#1D7A35' },
  red: { bg: '#FDE8E7', fg: '#C4161C' },
  pink: { bg: '#FDE9F0', fg: '#B4245D' },
} satisfies Record<string, Tone>

export const DOT = { green: '#34C759', orange: '#FF9500', red: '#FF3B30' }

/** Initials avatars: system colours deep enough for white text (≥ 4.5:1). */
export const AVATAR = ['#0A6CD9', '#5856D6', '#9A47C2', '#1C7F38', '#C25400', '#0B7A8C', '#636366', '#C9264F']
