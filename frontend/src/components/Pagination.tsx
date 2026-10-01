import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageList, type Page } from '../lib/paginate'
import './Pagination.css'

type Props = {
  page: Page<unknown>
  onPage: (page: number) => void
  noun?: string
}

/** "Showing 101–200 of 482" plus prev / numbered / next. Renders nothing for a single page. */
export function Pagination({ page: p, onPage, noun = 'influencers' }: Props) {
  if (p.totalPages <= 1) return null
  return (
    <nav className="pager" aria-label="Pagination">
      <span className="pager-info">
        Showing <b>{p.from}–{p.to}</b> of <b>{p.total}</b> {noun}
      </span>
      <div className="pager-btns">
        <button type="button" className="pager-btn" aria-label="Previous page" disabled={p.page === 1} onClick={() => onPage(p.page - 1)}>
          <ChevronLeft size={14} />
        </button>
        {pageList(p.page, p.totalPages).map((n, k) =>
          n === '…' ? (
            <span key={'gap' + k} className="pager-gap">…</span>
          ) : (
            <button key={n} type="button" className={n === p.page ? 'pager-btn on' : 'pager-btn'}
              aria-label={`Page ${n}`} aria-current={n === p.page ? 'page' : undefined} onClick={() => onPage(n)}>
              {n}
            </button>
          ),
        )}
        <button type="button" className="pager-btn" aria-label="Next page" disabled={p.page === p.totalPages} onClick={() => onPage(p.page + 1)}>
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  )
}

