export default function StartScreen({ onPlay, loading, error }) {
  return (
    <div className="start-screen">
      <div className="start-logo">20-0</div>
      <div className="start-subtitle">Advanced Edition</div>
      <p className="start-tagline">
        Get randomly assigned an NBA franchise and season. Pick 5 players
        from that roster using pace-adjusted advanced stats. Build the best squad you can.
      </p>
      <button className="btn-primary" onClick={onPlay} disabled={loading}>
        {loading ? 'LOADING...' : 'PLAY'}
      </button>
      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}
