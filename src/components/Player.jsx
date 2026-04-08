import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import TrailerModal from './TrailerModal'
import './Player.css'

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY

const SOURCES = {
  embedmaster: (isTV, id, season, episode) => isTV ? `https://embedmaster.link/m1ybu9o552qzyf3k/tv/${id}/${season}/${episode}` : `https://embedmaster.link/m1ybu9o552qzyf3k/movie/${id}`,
  vidsrc: (isTV, id, season, episode) => isTV ? `https://vidsrc.icu/embed/tv/${id}/${season}/${episode}` : `https://vidsrc.icu/embed/movie/${id}`,
  embed2: (isTV, id, season, episode) => isTV ? `https://www.2embed.stream/embed/tv/${id}/${season}/${episode}` : `https://www.2embed.stream/embed/movie/${id}`,
  superembed: (isTV, id, season, episode) => isTV ? `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}` : `https://multiembed.mov/?video_id=${id}&tmdb=1`,
  vidnest: (isTV, id, season, episode) => isTV ? `https://vidnest.fun/tv/${id}/${season}/${episode}` : `https://vidnest.fun/movie/${id}`,
}

const SOURCE_LABELS = {
  embedmaster: 'Default Server',
  vidsrc: 'VidSrc',
  embed2: '2Embed',
  superembed: 'SuperEmbed',
  vidnest: 'VidNest',
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function updateWatchParams(searchParams, setSearchParams, updates, replace = false) {
  const nextParams = new URLSearchParams(searchParams)

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      nextParams.delete(key)
      return
    }

    nextParams.set(key, String(value))
  })

  if (!nextParams.get('source')) {
    nextParams.set('source', 'embedmaster')
  }

  setSearchParams(nextParams, { replace })
}

export default function Player() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mediaType, id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [contentState, setContentState] = useState({ key: '', content: null, error: false })
  const [episodeState, setEpisodeState] = useState({ key: '', count: null })
  const [loadedFrameKey, setLoadedFrameKey] = useState(null)
  const [showTrailer, setShowTrailer] = useState(false)

  const normalizedMediaType = mediaType === 'tv' ? 'tv' : mediaType === 'movie' ? 'movie' : null
  const isTV = normalizedMediaType === 'tv'
  const contentKey = normalizedMediaType ? `${normalizedMediaType}:${id}` : ''
  const source = SOURCE_LABELS[searchParams.get('source')] ? searchParams.get('source') : 'embedmaster'
  const season = parsePositiveInt(searchParams.get('season'), 1)
  const episode = parsePositiveInt(searchParams.get('episode'), 1)

  useEffect(() => {
    const updates = {}

    if (!normalizedMediaType) {
      return
    }

    if (!searchParams.get('source') || !SOURCE_LABELS[searchParams.get('source')]) {
      updates.source = 'embedmaster'
    }

    if (isTV) {
      if (!searchParams.get('season') || season < 1) {
        updates.season = 1
      }
      if (!searchParams.get('episode') || episode < 1) {
        updates.episode = 1
      }
    } else {
      updates.season = null
      updates.episode = null
    }

    if (Object.keys(updates).length > 0) {
      updateWatchParams(searchParams, setSearchParams, updates, true)
    }
  }, [episode, isTV, normalizedMediaType, searchParams, season, setSearchParams])

  useEffect(() => {
    if (!normalizedMediaType) return

    let cancelled = false

    axios.get(`https://api.themoviedb.org/3/${normalizedMediaType}/${id}?api_key=${TMDB_KEY}`)
      .then((res) => {
        if (!cancelled) {
          setContentState({
            key: contentKey,
            content: { ...res.data, media_type: normalizedMediaType },
            error: false,
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContentState({ key: contentKey, content: null, error: true })
        }
      })

    return () => {
      cancelled = true
    }
  }, [contentKey, id, normalizedMediaType])

  useEffect(() => {
    if (!contentState.content || contentState.key !== contentKey) return
    const content = contentState.content
    const entry = {
      id: content.id,
      mediaType: normalizedMediaType,
      title: content.title || content.name,
      posterPath: content.poster_path,
      timestamp: Date.now(),
    }
    const prev = JSON.parse(localStorage.getItem('ajerflix_recently_viewed') || '[]')
    const updated = [entry, ...prev.filter((v) => !(v.id === entry.id && v.mediaType === entry.mediaType))].slice(0, 20)
    localStorage.setItem('ajerflix_recently_viewed', JSON.stringify(updated))
  }, [contentState.content, contentState.key, contentKey, normalizedMediaType])

  const contentLoading = Boolean(normalizedMediaType) && contentState.key !== contentKey
  const content = contentState.key === contentKey ? contentState.content : null
  const contentError = !normalizedMediaType || (contentState.key === contentKey && contentState.error)
  const seasons = useMemo(
    () => (content?.seasons || []).filter((entry) => entry.season_number > 0),
    [content]
  )
  const episodeKey = isTV && normalizedMediaType ? `${id}:${season}` : ''

  useEffect(() => {
    if (!isTV || !normalizedMediaType) return

    let cancelled = false

    axios.get(`https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_KEY}`)
      .then((res) => {
        if (!cancelled) {
          setEpisodeState({ key: episodeKey, count: res.data.episodes.length })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEpisodeState({ key: episodeKey, count: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [episodeKey, id, isTV, normalizedMediaType, season])

  const episodeCount = episodeState.key === episodeKey ? episodeState.count : null

  useEffect(() => {
    if (episodeCount && episode > episodeCount) {
      updateWatchParams(searchParams, setSearchParams, { episode: episodeCount }, true)
    }
  }, [episode, episodeCount, searchParams, setSearchParams])

  const iframeKey = `${id}-${season}-${episode}-${source}`
  const loaded = loadedFrameKey === iframeKey

  const url = normalizedMediaType
    ? SOURCES[source](isTV, id, season, episode)
    : ''

  const title = content?.title || content?.name || 'Unavailable title'
  const rating = content?.vote_average ? content.vote_average.toFixed(1) : null
  const fallbackBackTarget = '/search'

  const handleBack = () => {
    navigate(location.state?.fromSearch || fallbackBackTarget)
  }

  const handleSourceChange = (nextSource) => {
    updateWatchParams(searchParams, setSearchParams, { source: nextSource })
  }

  const handleSeasonChange = (delta) => {
    const maxSeason = seasons.length || 999
    const nextSeason = Math.max(1, Math.min(maxSeason, season + delta))
    updateWatchParams(searchParams, setSearchParams, { season: nextSeason, episode: 1 })
  }

  const handleEpisodeChange = (delta) => {
    const maxEpisode = episodeCount || 999
    const nextEpisode = Math.max(1, Math.min(maxEpisode, episode + delta))
    updateWatchParams(searchParams, setSearchParams, { episode: nextEpisode })
  }

  if (!normalizedMediaType) {
    return (
      <div className="player-page">
        <div className="player-header">
          <button type="button" className="back-btn" onClick={handleBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to Search
          </button>
        </div>
        <div className="player-error">
          <p>This route is not a valid media type.</p>
        </div>
      </div>
    )
  }

  if (contentLoading) {
    return (
      <div className="player-page">
        <div className="player-loading player-loading-static">
          <div className="player-spinner" />
          <p>Loading title...</p>
        </div>
      </div>
    )
  }

  if (contentError) {
    return (
      <div className="player-page">
        <div className="player-header">
          <button type="button" className="back-btn" onClick={handleBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to Search
          </button>
        </div>
        <div className="player-error">
          <p>This title could not be loaded from TMDB.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="player-page">
      <div className="player-header">
        <button type="button" className="back-btn" onClick={handleBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Search
        </button>
        <div className="player-title-bar">
          <h1 className="player-title">{title}</h1>
          {rating && (
            <div className="player-rating">
              <svg viewBox="0 0 24 24" fill="var(--gold)" width="13" height="13">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Rating: {rating}
            </div>
          )}
          <button type="button" className="player-trailer-btn" onClick={() => setShowTrailer(true)}>
            Trailer
          </button>
        </div>
      </div>

      {showTrailer && (
        <TrailerModal
          movieId={content.id}
          mediaType={content.media_type}
          title={title}
          onClose={() => setShowTrailer(false)}
        />
      )}

      <div className="player-toolbar">
        <div className="source-switcher">
          <span className="source-switcher-label">Source</span>
          {Object.keys(SOURCES).map((sourceKey) => (
            <button
              key={sourceKey}
              type="button"
              className={`source-btn ${source === sourceKey ? 'active' : ''}`}
              onClick={() => handleSourceChange(sourceKey)}
            >
              {SOURCE_LABELS[sourceKey]}
            </button>
          ))}
        </div>

        {isTV && (
          <div className="tv-controls">
            <div className="tv-control-group">
              <label>Season</label>
              <div className="stepper">
                <button type="button" onClick={() => handleSeasonChange(-1)}>−</button>
                <span>
                  {season}
                  {seasons.length > 0 && <span className="stepper-total"> / {seasons.length}</span>}
                </span>
                <button type="button" onClick={() => handleSeasonChange(1)}>+</button>
              </div>
            </div>

            <div className="tv-control-group">
              <label>Episode</label>
              <div className="stepper">
                <button type="button" onClick={() => handleEpisodeChange(-1)}>−</button>
                <span>
                  {episode}
                  {episodeCount && <span className="stepper-total"> / {episodeCount}</span>}
                </span>
                <button type="button" onClick={() => handleEpisodeChange(1)}>+</button>
              </div>
            </div>

            <div className="tv-label">
              S{String(season).padStart(2, '0')} · E{String(episode).padStart(2, '0')}
            </div>
          </div>
        )}
      </div>

      <div className="player-wrapper">
        {!loaded && (
          <div className="player-loading">
            <div className="player-spinner" />
            <p>Loading...</p>
          </div>
        )}
        <iframe
          key={iframeKey}
          src={url}
          className="player-iframe"
          style={{ opacity: loaded ? 1 : 0 }}
          allowFullScreen
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedFrameKey(iframeKey)}
          title={title}
        />
      </div>
    </div>
  )
}
