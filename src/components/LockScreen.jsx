import { useCallback, useEffect, useState } from 'react'
import './LockScreen.css'

const PROFILES = {
  '0887': { name: 'boss',  greeting: 'The Boss is back.', sub: 'Welcome home.' },
  '9999': { name: 'nejdi', greeting: 'Welcome, Nejdi.', sub: 'Enjoy your movie.' },
  '6384': { name: 'guest', greeting: 'Welcome, Guest.', sub: 'Enjoy your stay & have a great time!' },
}

export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleDigit = useCallback((digit) => {
    if (error) return
    const next = pin + digit
    if (next.length === 4) {
      if (PROFILES[next]) {
        localStorage.setItem('ajerflix_auth', '1')
        localStorage.setItem('ajerflix_profile', JSON.stringify(PROFILES[next]))
        onUnlock(PROFILES[next])
      } else {
        setPin(next)
        setError(true)
        setTimeout(() => { setError(false); setPin('') }, 650)
      }
    } else {
      setPin(next)
    }
  }, [error, onUnlock, pin])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key)
      if (e.key === 'Backspace') setPin(p => p.slice(0, -1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleDigit])

  const handleDelete = () => {
    if (!error) setPin(p => p.slice(0, -1))
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <svg className="lock-logo" viewBox="0 0 200 54" fill="none" xmlns="http://www.w3.org/2000/svg">
          <text x="100" y="46" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="54" letterSpacing="2" fill="url(#lockLogoGrad)">AJËRFLIX</text>
          <defs>
            <linearGradient id="lockLogoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff0000"/>
              <stop offset="100%" stopColor="#b20000"/>
            </linearGradient>
          </defs>
        </svg>

        <p className="lock-label">Enter PIN to continue</p>

        <div className={`lock-dots ${error ? 'shake' : ''}`}>
          {[0,1,2,3].map(i => (
            <div key={i} className={`lock-dot ${pin.length > i ? 'filled' : ''} ${error ? 'error' : ''}`} />
          ))}
        </div>

        <div className="lock-pad">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button
              key={i}
              className={`pad-btn ${d === '' ? 'pad-empty' : ''}`}
              onClick={() => d === '⌫' ? handleDelete() : d !== '' ? handleDigit(d) : null}
              disabled={d === ''}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
