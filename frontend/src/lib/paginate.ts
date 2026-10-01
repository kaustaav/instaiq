export type Page<T> = {
  items: T[]
  page: number // 1-based, clamped to a valid page
  totalPages: number
  total: number
  from: number // 1-based index of the first item on this page (0 when empty)
  to: number
}

/**
 * Client-side slice with the same shape a paged API response will have.
 * Clamps the page so deleting the last row on the last page doesn't strand the user on an empty page.
 */
export function paginate<T>(all: T[], page: number, size: number): Page<T> {
  const total = all.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const p = Math.min(Math.max(1, page), totalPages)
  const start = (p - 1) * size
  const items = all.slice(start, start + size)
  return { items, page: p, totalPages, total, from: total ? start + 1 : 0, to: start + items.length }
}

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
export function pageList(page: number, totalPages: number): (number | '…')[] {
  const keep = new Set([1, totalPages, page - 1, page, page + 1].filter(p => p >= 1 && p <= totalPages))
  const sorted = [...keep].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, k) => {
    if (k > 0 && p - sorted[k - 1] === 2) out.push(p - 1) // fill a single-page gap instead of "…"
    else if (k > 0 && p - sorted[k - 1] > 2) out.push('…')
    out.push(p)
  })
  return out
}
