import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import TrailerModal from './TrailerModal'
import './Search.css'

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY
const IMG_BASE = 'https://image.tmdb.org/t/p/w300'
const SEARCH_DEBOUNCE_MS = 450
const IMG_PROXY = (path) => (path ? `${IMG_BASE}${path}` : null)

async function searchTMDB(query) {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
  const res = await axios.get(url)
  return res.data.results || []
}

const MOVIE_GENRES = [
  { id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' }, { id: 16, name: 'Animation' }, { id: 12, name: 'Adventure' },
  { id: 80, name: 'Crime' }, { id: 14, name: 'Fantasy' }, { id: 99, name: 'Documentary' },
]

const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure' }, { id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' },
  { id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 9648, name: 'Mystery' }, { id: 80, name: 'Crime' },
  { id: 10768, name: 'War & Politics' }, { id: 16, name: 'Animation' }, { id: 99, name: 'Documentary' },
  { id: 10767, name: 'Talk Show' }, { id: 10762, name: 'Kids' }, { id: 10763, name: 'News' },
]

async function fetchDiscover() {
  const [trending, nowPlaying, popularTV] = await Promise.all([
    axios.get(`https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_KEY}`),
    axios.get(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}`),
    axios.get(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}`),
  ])

  const trendingItems = (trending.data.results || [])
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .slice(0, 18)

  const nowPlayingItems = (nowPlaying.data.results || [])
    .map((item) => ({ ...item, media_type: 'movie' }))
    .slice(0, 18)

  const popularTVItems = (popularTV.data.results || [])
    .map((item) => ({ ...item, media_type: 'tv' }))
    .slice(0, 18)

  return { trendingItems, nowPlayingItems, popularTVItems }
}

async function fetchByGenre(type, genreId) {
  const res = await axios.get(
    `https://api.themoviedb.org/3/discover/${type}?api_key=${TMDB_KEY}&with_genres=${genreId}&sort_by=popularity.desc`
  )
  return (res.data.results || []).map((item) => ({ ...item, media_type: type })).slice(0, 18)
}

function parseTypeFilter(rawType) {
  return ['all', 'movie', 'tv'].includes(rawType) ? rawType : 'all'
}

function updateParams(searchParams, setSearchParams, updates, replace = false) {
  const nextParams = new URLSearchParams(searchParams)

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      nextParams.delete(key)
      return
    }

    nextParams.set(key, String(value))
  })

  if (!nextParams.get('type')) {
    nextParams.set('type', 'all')
  }

  setSearchParams(nextParams, { replace })
}

export default function Search({ profile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [inputValue, setInputValue] = useState(() => searchParams.get('q') || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(Boolean(searchParams.get('q')))
  const [discover, setDiscover] = useState(null)
  const [genreResults, setGenreResults] = useState([])
  const [genreLoading, setGenreLoading] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const query = searchParams.get('q') || ''
  const typeFilter = parseTypeFilter(searchParams.get('type'))
  const genreParam = Number(searchParams.get('genre'))
  const genres = typeFilter === 'tv' ? TV_GENRES : MOVIE_GENRES
  const genreType = typeFilter === 'tv' ? 'tv' : 'movie'
  const activeGenre = Number.isFinite(genreParam) ? genres.find((genre) => genre.id === genreParam) || null : null

  useEffect(() => {
    inputRef.current?.focus()
    fetchDiscover().then(setDiscover).catch(console.error)
  }, [])

  useEffect(() => {
    setInputValue(query)
  }, [query])

  useEffect(() => {
    if (!searchParams.get('type')) {
      updateParams(searchParams, setSearchParams, { type: 'all' }, true)
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (searchParams.has('genre') && !activeGenre) {
      updateParams(searchParams, setSearchParams, { genre: null }, true)
    }
  }, [activeGenre, searchParams, setSearchParams])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      setLoading(false)
      setSearched(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(async () => {
      try {
        const data = await searchTMDB(query)
        const filtered = data.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
        const narrowed = typeFilter === 'all'
          ? filtered
          : filtered.filter((item) => item.media_type === typeFilter)

        if (!cancelled) {
          setResults(narrowed)
          setSearched(true)
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setError('Search failed. TMDB might be unreachable. Try using a VPN or check your API key.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query, typeFilter])

  useEffect(() => {
    if (!activeGenre || query.trim()) {
      setGenreResults([])
      setGenreLoading(false)
      return
    }

    let cancelled = false
    setGenreLoading(true)

    fetchByGenre(genreType, activeGenre.id)
      .then((items) => {
        if (!cancelled) {
          setGenreResults(items)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGenreLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeGenre, genreType, query])

  const filteredDiscover = discover ? {
    trendingItems: typeFilter === 'all'
      ? discover.trendingItems
      : discover.trendingItems.filter((item) => item.media_type === typeFilter),
    nowPlayingItems: typeFilter === 'tv' ? [] : discover.nowPlayingItems,
    popularTVItems: typeFilter === 'movie' ? [] : discover.popularTVItems,
  } : null

  const showDiscover = !query.trim() && !loading && discover

  const commitQuery = (nextQuery, replace = false) => {
    updateParams(searchParams, setSearchParams, { q: nextQuery.trim() || null }, replace)
  }

  const handleInput = (event) => {
    const nextValue = event.target.value
    setInputValue(nextValue)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      commitQuery(nextValue, true)
    }, SEARCH_DEBOUNCE_MS)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    window.clearTimeout(timerRef.current)
    commitQuery(inputValue)
  }

  const handleTypeChange = (nextType) => {
    updateParams(
      searchParams,
      setSearchParams,
      { type: nextType, genre: null },
    )
  }

  const handleGenre = (genre) => {
    updateParams(
      searchParams,
      setSearchParams,
      { genre: activeGenre?.id === genre.id ? null : genre.id },
    )
  }

  const handleSelect = (item) => {
    const watchParams = new URLSearchParams({ source: 'embedmaster' })

    if (item.media_type === 'tv') {
      watchParams.set('season', '1')
      watchParams.set('episode', '1')
    }

    navigate(
      {
        pathname: `/watch/${item.media_type}/${item.id}`,
        search: `?${watchParams.toString()}`,
      },
      { state: { fromSearch: `${location.pathname}${location.search}` } }
    )
  }

  return (
    <div className="search-page">
      {profile && (
        <div className="welcome">
          <span className="welcome-greeting">{profile.greeting}</span>
          <span className="welcome-sub">{profile.sub}</span>
        </div>
      )}
      <div className="search-hero">
        <form className="search-form" onSubmit={handleSubmit}>
          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              value={inputValue}
              onChange={handleInput}
              placeholder="Search movies or TV shows..."
              spellCheck={false}
            />
            {loading && <div className="search-spinner" />}
          </div>
        </form>
      </div>

      {error && (
        <div className="search-error">
          <span className="error-icon">!</span> {error}
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <p className="search-empty">No results found for "{query}"</p>
      )}

      {!query.trim() && (
        <div className="filters">
          <div className="type-filters">
            {['all', 'movie', 'tv'].map((type) => (
              <button
                key={type}
                type="button"
                className={`filter-btn ${typeFilter === type ? 'active' : ''}`}
                onClick={() => handleTypeChange(type)}
              >
                {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
              </button>
            ))}
          </div>
          <div className="genre-filters">
            {genres.map((genre) => (
              <button
                key={genre.id}
                type="button"
                className={`filter-btn genre ${activeGenre?.id === genre.id ? 'active' : ''}`}
                onClick={() => handleGenre(genre)}
              >
                {genre.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="results-grid">
          {results.map((movie, index) => (
            <MovieCard key={`${movie.media_type}-${movie.id}`} movie={movie} index={index} onSelect={handleSelect} />
          ))}
        </div>
      )}

      {activeGenre && !query.trim() && (
        <div className="discover">
          {genreLoading
            ? <div className="search-spinner search-spinner-inline" />
            : <Section title={activeGenre.name} items={genreResults} onSelect={handleSelect} />
          }
        </div>
      )}

      {showDiscover && !activeGenre && filteredDiscover && (
        <div className="discover">
          {filteredDiscover.trendingItems.length > 0 && (
            <Section title="Trending Today" items={filteredDiscover.trendingItems} onSelect={handleSelect} />
          )}
          {filteredDiscover.nowPlayingItems.length > 0 && (
            <Section title="Now in Cinemas" items={filteredDiscover.nowPlayingItems} onSelect={handleSelect} />
          )}
          {filteredDiscover.popularTVItems.length > 0 && (
            <Section title="Popular TV Shows" items={filteredDiscover.popularTVItems} onSelect={handleSelect} />
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, items, onSelect }) {
  return (
    <div className="section">
      <h2 className="section-title">{title}</h2>
      <div className="section-scroll">
        {items.map((movie, index) => (
          <MovieCard key={`${movie.media_type}-${movie.id}`} movie={movie} index={index} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function MovieCard({ movie, index, onSelect }) {
  const [showTrailer, setShowTrailer] = useState(false)
  const title = movie.title || movie.name
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4)
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null
  const posterUrl = IMG_PROXY(movie.poster_path)
  const type = movie.media_type === 'tv' ? 'TV' : 'FILM'

  const handleActivate = () => {
    onSelect(movie)
  }

  return (
    <>
      <article
        className="movie-card"
        style={{ animationDelay: `${index * 40}ms` }}
        onClick={handleActivate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleActivate()
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="card-poster">
          {posterUrl ? (
            <img src={posterUrl} alt={title} loading="lazy" />
          ) : (
            <div className="card-no-poster">
              <span>{title?.charAt(0)}</span>
            </div>
          )}
          <div className="card-overlay">
            <div className="card-play">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
          <span className={`card-type ${movie.media_type}`}>{type}</span>
        </div>
        <div className="card-info">
          <p className="card-title">{title}</p>
          <div className="card-meta">
            {year && <span className="card-year">{year}</span>}
            {rating && (
              <span className="card-rating">
                <svg viewBox="0 0 24 24" fill="var(--gold)" width="10" height="10">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {rating}
              </span>
            )}
          </div>
          <button
            type="button"
            className="card-trailer-btn"
            onClick={(event) => {
              event.stopPropagation()
              setShowTrailer(true)
            }}
          >
            Trailer
          </button>
        </div>
      </article>
      {showTrailer && (
        <TrailerModal
          movieId={movie.id}
          mediaType={movie.media_type}
          title={title}
          onClose={() => setShowTrailer(false)}
        />
      )}
    </>
  )
}
