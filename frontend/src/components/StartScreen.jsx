export default function StartScreen({ onPlay, loading, error }) {
  return (
    <div className="start-screen">
      <div className="start-logo">82-0</div>
      <div className="start-subtitle">Can your squad go undefeated?</div>
      <p className="start-tagline">
        5 rounds. Each round reveals a random NBA franchise from any era.
        Pick one player. Build the greatest team ever assembled.
      </p>
      <button className="btn-primary" onClick={onPlay} disabled={loading}>
        {loading ? 'LOADING…' : 'PLAY'}
      </button>
      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}
