function offRtgClass(v) {
  if (v == null) return 'dim'
  if (v >= 115) return 'good'
  if (v >= 108) return 'ok'
  return 'poor'
}

// DefRtg: lower is better
function defRtgClass(v) {
  if (v == null) return 'dim'
  if (v <= 105) return 'good'
  if (v <= 112) return 'ok'
  return 'poor'
}

function pieClass(v) {
  if (v == null) return 'dim'
  if (v >= 0.15) return 'gold'
  if (v >= 0.09) return 'white'
  return 'dim'
}

export default function PlayerCard({ player, selected, onToggle }) {
  const { name, gp, min_per_game, off_rtg, def_rtg, pie, pts_per100, ast_per100 } = player

  return (
    <div className={`player-card${selected ? ' selected' : ''}`} onClick={onToggle}>
      {selected && <div className="check-badge">✓</div>}
      <div className="player-name">{name}</div>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">OffRtg</span>
          <span className={`stat-value ${offRtgClass(off_rtg)}`}>
            {off_rtg != null ? off_rtg.toFixed(1) : '—'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">DefRtg ↓</span>
          <span className={`stat-value ${defRtgClass(def_rtg)}`}>
            {def_rtg != null ? def_rtg.toFixed(1) : '—'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">PIE</span>
          <span className={`stat-value ${pieClass(pie)}`}>
            {pie != null ? (pie * 100).toFixed(1) + '%' : '—'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">PTS/100</span>
          <span className="stat-value white">
            {pts_per100 != null ? pts_per100.toFixed(1) : '—'}
          </span>
        </div>
      </div>
      <div className="meta-row">
        <div className="meta-item">GP <span>{gp}</span></div>
        <div className="meta-item">MPG <span>{min_per_game != null ? min_per_game.toFixed(1) : '—'}</span></div>
        {ast_per100 != null && (
          <div className="meta-item">AST/100 <span>{ast_per100.toFixed(1)}</span></div>
        )}
      </div>
    </div>
  )
}
