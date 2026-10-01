import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, Database, Megaphone, PanelLeft, Search, Send, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import './Sidebar.css'

const STORAGE_KEY = 'iiq-sb'

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

/** Open/closed state, persisted to localStorage and toggled with Ctrl/Cmd + . */
function useSidebarOpen() {
  const [open, setOpen] = useState(readOpen)

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // storage unavailable (private mode); state still toggles for this session
      }
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return { open, toggle }
}

/** `paths` = URL prefixes that highlight the item (profiles are reached from search). */
type NavItem = { to: string; paths: string[]; label: string; icon: LucideIcon; badge?: number }

type Props = {
  campaignCount: number
  influencerCount: number
}

export function Sidebar({ campaignCount, influencerCount }: Props) {
  const { open, toggle } = useSidebarOpen()
  const { pathname } = useLocation()

  const nav: NavItem[] = [
    { to: '/search', paths: ['/search', '/influencers'], label: 'Search & Browse', icon: Search },
    { to: '/campaigns', paths: ['/campaigns'], label: 'Campaigns', icon: Megaphone, badge: campaignCount },
    { to: '/manage', paths: ['/manage'], label: 'Manage Data', icon: Database, badge: influencerCount },
  ]
  const toggleTitle = `${open ? 'Close' : 'Open'} sidebar (Ctrl+.)`

  return (
    <aside className={open ? 'sb' : 'sb closed'}>
      <div className="sb-head">
        <div className="sb-brand sb-fade" aria-hidden={!open}>
          <div className="sb-brand-name">InfluenceIQ</div>
          <div className="sb-brand-sub">Influencer CRM</div>
        </div>
        <button type="button" className="sb-toggle" onClick={toggle} title={toggleTitle} aria-label={toggleTitle}>
          <PanelLeft size={17} />
        </button>
      </div>

      <nav className="sb-nav">
        {nav.map(({ to, paths, label, icon: Icon, badge }) => {
          const active = paths.some(p => pathname === p || pathname.startsWith(p + '/'))
          return (
            <Link
              key={to}
              to={to}
              className={active ? 'sb-item active' : 'sb-item'}
              title={open ? undefined : label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={14} />
              <span className="sb-label sb-fade">
                <span>{label}</span>
                {badge != null && <span className="sb-badge">{badge}</span>}
              </span>
            </Link>
          )
        })}

        <div className="sb-divider" />
        <div className="sb-section sb-fade">Coming soon</div>
        <div className="sb-item disabled" title="Analytics (coming soon)">
          <BarChart3 size={14} />
          <span className="sb-fade">Analytics</span>
        </div>
        <div className="sb-item disabled" title="Outreach (coming soon)">
          <Send size={14} />
          <span className="sb-fade">Outreach</span>
        </div>
      </nav>

      <div className="sb-foot">
        <div className="sb-avatar" title="Aisha Khan">AK</div>
        <div className="sb-user sb-fade">
          <div style={{ minWidth: 0 }}>
            <div className="sb-user-name">Aisha Khan</div>
            <div className="sb-user-role">Campaign Manager</div>
          </div>
          <Settings size={13} />
        </div>
      </div>
    </aside>
  )
}
