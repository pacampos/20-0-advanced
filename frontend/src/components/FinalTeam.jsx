function offRtgClass(v) {
  if (v == null) return 'dim'
  if (v >= 115) return 'good'
  if (v >= 108) return 'ok'
  return 'poor'
}

function defRtgClass(v) {
  if (v == null) return 'dim'
  if (v <= 105) return 'good'
  if (v <= 112) return 'ok'
  return 'poor'
}

function avg(players, key) {
  const vals = players.map(p => p[key]).filter(v => v != null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

export default function FinalTeam({ assignment, players, onPlayAgain }) {
  const { teamName, season } = assignment
  const avgOff = avg(players, 'off_rtg')
  const avgDef = avg(players, 'def_rtg')
  const avgPie = avg(players, 'pie')

  return (
    <div className="final-screen">
      <div className="final-title">Your Squad</div>
      <div className="final-source">{teamName} · {season} Season</div>

      <div className="team-summary">
        <div className="summary-stat">
          <div className="ss-label">Avg OffRtg</div>
          <div className={`ss-value ${offRtgClass(avgOff)}`}>
            {avgOff != null ? avgOff.toFixed(1) : '—'}
          </div>
        </div>
        <div className="summary-stat">
          <div className="ss-label">Avg DefRtg ↓</div>
          <div className={`ss-value ${defRtgClass(avgDef)}`}>
            {avgDef != null ? avgDef.toFixed(1) : '—'}
          </div>
        </div>
        <div className="summary-stat">
          <div className="ss-label">Avg PIE</div>
          <div className="ss-value gold">
            {avgPie != null ? (avgPie * 100).toFixed(1) + '%' : '—'}
          </div>
        </div>
      </div>

      <div className="final-players">
        {players.map((p, i) => (
          <div className="final-player-row" key={p.id}>
            <div className="player-name-col">
              <span className="player-num">{i + 1}</span>
              {p.name}
            </div>
            <div className="final-stat-col">
              <div className="fs-label">OffRtg</div>
              <div className={`fs-value ${offRtgClass(p.off_rtg)}`}>
                {p.off_rtg != null ? p.off_rtg.toFixed(1) : '—'}
              </div>
            </div>
            <div className="final-stat-col">
              <div className="fs-label">DefRtg</div>
              <div className={`fs-value ${defRtgClass(p.def_rtg)}`}>
                {p.def_rtg != null ? p.def_rtg.toFixed(1) : '—'}
              </div>
            </div>
            <div className="final-stat-col">
              <div className="fs-label">PIE</div>
              <div className="fs-value gold">
                {p.pie != null ? (p.pie * 100).toFixed(1) + '%' : '—'}
              </div>
            </div>
            <div className="final-stat-col">
              <div className="fs-label">PTS/100</div>
              <div className="fs-value white">
                {p.pts_per100 != null ? p.pts_per100.toFixed(1) : '—'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={onPlayAgain}>PLAY AGAIN</button>
    </div>
  )
}
