import { useState } from 'react'

function plusMinusClass(v) {
  if (v == null) return ''
  return v >= 0 ? 'pm-positive' : 'pm-negative'
}

function fmt(v, dec = 1) {
  return v != null ? v.toFixed(dec) : '—'
}

export default function PlayerPicker({ assignment, round, onPick }) {
  const { teamName, season, players } = assignment
  const [confirming, setConfirming] = useState(null) // player.id being confirmed

  const handleSelect = (player) => {
    if (confirming != null) return
    setConfirming(player.id)
    // Brief visual lock, then hand off
    setTimeout(() => onPick(player), 700)
  }

  return (
    <div className="picker-screen">
      <div className="picker-header">
        <div className="picker-team-info">
          <div className="picker-team-name">{teamName}</div>
          <div className="picker-season">{season} Season</div>
        </div>
        <div className="picker-instruction">
          Pick <strong>1 player</strong> for your squad
        </div>
      </div>

      <div className="picker-progress">
        {[1,2,3,4,5].map(r => (
          <div key={r} className={`progress-dot${r < round ? ' done' : r === round ? ' active' : ''}`} />
        ))}
        <span className="progress-label">Player {round}/5</span>
      </div>

      <div className="picker-grid">
        {players.map(player => {
          const isConfirming = confirming === player.id
          const isLocked = confirming != null && !isConfirming
          return (
            <div
              key={player.id}
              className={`picker-card${isConfirming ? ' confirming' : ''}${isLocked ? ' locked-out' : ''}`}
              onClick={() => handleSelect(player)}
            >
              {isConfirming && (
                <div className="confirm-overlay">SELECTED</div>
              )}
              <div className="picker-name">{player.name}</div>
              <div className="picker-stats">
                <div className="picker-stat">
                  <span className="ps-label">PTS</span>
                  <span className="ps-value">{fmt(player.pts)}</span>
                </div>
                <div className="picker-stat">
                  <span className="ps-label">REB</span>
                  <span className="ps-value">{fmt(player.reb)}</span>
                </div>
                <div className="picker-stat">
                  <span className="ps-label">STL</span>
                  <span className="ps-value">{fmt(player.stl)}</span>
                </div>
                <div className="picker-stat">
                  <span className="ps-label">BLK</span>
                  <span className="ps-value">{fmt(player.blk)}</span>
                </div>
                <div className="picker-stat">
                  <span className="ps-label">+/-</span>
                  <span className={`ps-value ${plusMinusClass(player.plus_minus)}`}>
                    {player.plus_minus != null
                      ? (player.plus_minus >= 0 ? '+' : '') + fmt(player.plus_minus)
                      : '—'}
                  </span>
                </div>
              </div>
              <div className="picker-meta">
                {player.gp} GP &middot; {fmt(player.min_per_game)} MPG
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
