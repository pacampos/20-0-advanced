import { useState, useEffect } from 'react'
import { simulateSeason, recordTier } from '../utils/simulation'

function fmt(v, dec = 1) {
  return v != null ? v.toFixed(dec) : '—'
}

function plusMinusClass(v) {
  if (v == null) return ''
  return v >= 0 ? 'pm-positive' : 'pm-negative'
}

export default function FinalTeam({ picks, onPlayAgain }) {
  const [phase, setPhase] = useState('simulating') // 'simulating' | 'result'
  const [result, setResult] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setResult(simulateSeason(picks))
      setPhase('result')
    }, 2200)
    return () => clearTimeout(timer)
  }, [])

  const tier = result ? recordTier(result.wins) : null
  const is820 = result?.wins === 82

  return (
    <div className="final-screen">
      {/* Roster */}
      <div className="final-roster">
        {picks.map(({ player, season, teamName }, i) => (
          <div className="final-row" key={player.id}>
            <span className="final-num">{i + 1}</span>
            <div className="final-player-info">
              <span className="final-player-name">{player.name}</span>
              <span className="final-player-origin">{teamName} · {season}</span>
            </div>
            <div className="final-player-stats">
              <div className="fp-stat"><span className="fp-label">PTS</span><span className="fp-val">{fmt(player.pts)}</span></div>
              <div className="fp-stat"><span className="fp-label">REB</span><span className="fp-val">{fmt(player.reb)}</span></div>
              <div className="fp-stat"><span className="fp-label">STL</span><span className="fp-val">{fmt(player.stl)}</span></div>
              <div className="fp-stat"><span className="fp-label">BLK</span><span className="fp-val">{fmt(player.blk)}</span></div>
              <div className="fp-stat">
                <span className="fp-label">+/-</span>
                <span className={`fp-val ${plusMinusClass(player.plus_minus)}`}>
                  {player.plus_minus != null
                    ? (player.plus_minus >= 0 ? '+' : '') + fmt(player.plus_minus)
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Result area */}
      {phase === 'simulating' && (
        <div className="sim-loading">
          <div className="sim-bar"><div className="sim-bar-fill" /></div>
          <div className="sim-text">Simulating 82 games…</div>
        </div>
      )}

      {phase === 'result' && result && (
        <div className={`result-block${is820 ? ' undefeated' : ''}`}>
          <div className="result-label">YOUR TEAM WENT</div>
          <div className={`result-record ${tier.color}`}>
            {result.wins}–{result.losses}
          </div>
          <div className="result-tier">{tier.label}</div>
          <div className="result-meta">
            Avg BPM: <strong>{result.netRtg > 0 ? '+' : ''}{result.netRtg}</strong>
            &nbsp;&nbsp;·&nbsp;&nbsp;
            Win%: <strong>{result.winPct}%</strong>
          </div>
          <button className="btn-primary result-replay" onClick={onPlayAgain}>
            PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  )
}
