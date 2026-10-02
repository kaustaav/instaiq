import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { Menu, UserX } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { EmptyState } from './components/ui'
import { StoreProvider, useStore } from './store'
import type { Influencer } from './types'
import type { ProfileNavState } from './hooks/useOpenProfile'
import { SearchScreen } from './screens/search/SearchScreen'
import { ProfileScreen } from './screens/profile/ProfileScreen'
import { CampaignListScreen } from './screens/campaigns/CampaignListScreen'
import { CampaignDetailScreen } from './screens/campaigns/CampaignDetailScreen'
import { ManageScreen } from './screens/manage/ManageScreen'
import { AddToCampaignModal } from './overlays/AddToCampaignModal'
import { InfluencerDrawer } from './overlays/InfluencerDrawer'

/** Drawer state: closed, adding a new influencer, or editing an existing one. */
type DrawerState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; inf: Influencer }

type Overlays = {
  onShortlist: (id: number) => void
  onAdd: () => void
  onEdit: (inf: Influencer) => void
}

/** /influencers/:id — the back link returns to wherever the profile was opened from. */
function ProfileRoute({ onShortlist, onEdit }: Omit<Overlays, 'onAdd'>) {
  const { infs } = useStore()
  const { id } = useParams()
  const navigate = useNavigate()
  const from = useLocation().state as ProfileNavState | null
  const inf = infs.find(i => String(i.id) === id)

  if (!inf) {
    return (
      <div className="screen-col" style={{ justifyContent: 'center' }}>
        <EmptyState icon={UserX} title="Influencer not found" sub="They may have been deleted, or the link is wrong." />
        <div style={{ textAlign: 'center' }}><Link to="/search">Back to search</Link></div>
      </div>
    )
  }
  return (
    <ProfileScreen
      key={inf.id}
      inf={inf}
      // opened from inside the app → real Back (restores filters/page); opened from a link → plain search
      backLabel={from?.backLabel ?? 'Search Results'}
      onBack={() => (from ? navigate(-1) : navigate('/search'))}
      onEdit={() => onEdit(inf)}
      onAddToCampaign={() => onShortlist(inf.id)}
    />
  )
}

function Shell() {
  const { infs, campaigns } = useStore()
  // influencer ids for the Add to campaign modal: one from a card/profile, many from "Add all" on search
  const [modalIds, setModalIds] = useState<number[] | null>(null)
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' })
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    if (!mobileNav) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileNav(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNav])

  const closeModal = useCallback(() => setModalIds(null), [])
  const shortlist = (id: number) => setModalIds([id])
  const closeDrawer = useCallback(() => setDrawer({ mode: 'closed' }), [])
  const onEdit = (inf: Influencer) => setDrawer({ mode: 'edit', inf })

  return (
    <div className="app">
      <Sidebar campaignCount={campaigns.filter(c => c.status === 'DRAFT' || c.status === 'ACTIVE').length} influencerCount={infs.length}
        mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} />
      {mobileNav && <div className="sb-backdrop" onClick={() => setMobileNav(false)} />}
      <main className="app-main">
        {/* phones only (hidden by CSS on wider screens) */}
        <header className="mobile-bar">
          <button type="button" className="mobile-bar-btn" aria-label="Open menu" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}>
            <Menu size={20} />
          </button>
          <span className="mobile-bar-brand">InfluenceIQ</span>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<SearchScreen onShortlist={shortlist} onAddMany={setModalIds} />} />
          <Route path="/influencers/:id" element={<ProfileRoute onShortlist={shortlist} onEdit={onEdit} />} />
          <Route path="/campaigns" element={<CampaignListScreen />} />
          <Route path="/campaigns/:id" element={<CampaignDetailScreen />} />
          <Route path="/manage" element={<ManageScreen onAdd={() => setDrawer({ mode: 'add' })} onEdit={onEdit} />} />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </main>

      {modalIds && <AddToCampaignModal influencerIds={modalIds} onClose={closeModal} />}
      {drawer.mode !== 'closed' && (
        <InfluencerDrawer
          key={drawer.mode === 'edit' ? drawer.inf.id : 'new'}
          editing={drawer.mode === 'edit' ? drawer.inf : null}
          onClose={closeDrawer}
          onSaved={closeDrawer}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      {/* BASE_URL is '/' locally and '/instaiq/' on GitHub Pages (set by the build) */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Shell />
      </BrowserRouter>
    </StoreProvider>
  )
}
