import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import './TrailerModal.css'

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY

export default function TrailerModal({ movieId, mediaType, title, onClose }) {
  const [ytKey, setYtKey] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const type = mediaType === 'tv' ? 'tv' : 'movie'
    axios.get(`https://api.themoviedb.org/3/${type}/${movieId}/videos?api_key=${TMDB_KEY}`)
      .then(res => {
        const trailer = (res.data.results || []).find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
        setYtKey(trailer?.key || null)
      })
      .catch(() => setYtKey(null))
      .finally(() => setLoading(false))
  }, [movieId, mediaType])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="trailer-backdrop" onClick={onClose}>
      <div className="trailer-modal" onClick={e => e.stopPropagation()}>
        <div className="trailer-header">
          <span className="trailer-title">{title}</span>
          <button className="trailer-close" onClick={onClose}>✕</button>
        </div>
        <div className="trailer-frame">
          {loading && <div className="trailer-spinner" />}
          {!loading && ytKey && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytKey}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`}
              allowFullScreen
              title={title}
            />
          )}
          {!loading && !ytKey && (
            <p className="trailer-none">No trailer available.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
