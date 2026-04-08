import { useMemo, useState } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import Search from './components/Search'
import Player from './components/Player'
import LockScreen from './components/LockScreen'
import './App.css'

function readStoredProfile() {
  try {
    return JSON.parse(localStorage.getItem('ajerflix_profile'))
  } catch {
    return null
  }
}

function sanitizeRedirect(target) {
  if (!target || !target.startsWith('/')) return '/search'
  if (target.startsWith('/lock')) return '/search'
  return target
}

function AppShell() {
  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <svg className="logo-svg" viewBox="0 0 200 54" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text
              x="0"
              y="46"
              fontFamily="'Bebas Neue', sans-serif"
              fontSize="54"
              letterSpacing="2"
              fill="url(#logoGrad)"
            >
              AJËRFLIX
            </text>
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff0000" />
                <stop offset="100%" stopColor="#b20000" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">Powered by Ajer</footer>
    </div>
  )
}

function RequireUnlock({ unlocked }) {
  const location = useLocation()

  if (!unlocked) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/lock?redirect=${redirect}`} replace />
  }

  return <Outlet />
}

function LockRoute({ unlocked, onUnlock }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTarget = useMemo(
    () => sanitizeRedirect(searchParams.get('redirect')),
    [searchParams]
  )

  if (unlocked) {
    return <Navigate to={redirectTarget} replace />
  }

  return (
    <LockScreen
      onUnlock={(profile) => {
        onUnlock(profile)
        navigate(redirectTarget, { replace: true })
      }}
    />
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('ajerflix_auth') === '1')
  const [profile, setProfile] = useState(readStoredProfile)

  const handleUnlock = (nextProfile) => {
    setUnlocked(true)
    setProfile(nextProfile)
  }

  return (
    <Routes>
      <Route path="/lock" element={<LockRoute unlocked={unlocked} onUnlock={handleUnlock} />} />

      <Route element={<RequireUnlock unlocked={unlocked} />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<Search profile={profile} />} />
          <Route path="/watch/:mediaType/:id" element={<Player />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/search" replace />} />
    </Routes>
  )
}
