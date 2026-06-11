import { useState, useEffect } from 'react'

function fmt(v, dec = 1) {
  return v != null ? v.toFixed(dec) : '—'
}

export default function PlayerPicker({
  assignment, round,
  teamRerolls, eraRerolls, loading,
  onPick, onTeamReroll, onEraReroll,
}) {
  const { teamName, season, players } = assignment
  const [selected, setSelected] = useState(null)
  const [search,   setSearch]   = useState('')

  // Reset selection & search whenever the assignment changes (team/era reroll)
  useEffect(() => {
    setSelected(null)
    setSearch('')
  }, [teamName, season])

  // Sort by PPG descending
  const sorted = [...players].sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0))

  // Filter by search query
  const filtered = search.trim()
    ? sorted.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : sorted

  const handleContinue = () => {
    if (!selected || loading) return
    onPick(selected)
  }

  return (
    <div className="picker-screen">

      {/* ── Header ── */}
      <div className="picker-header">
        <div className="picker-team-info">
          <div className="picker-team-name">{teamName}</div>
          <div className="picker-season">{season} Season</div>
        </div>

        <div className="picker-header-right">
          <div className="picker-progress">
            {[1,2,3,4,5].map(r => (
              <div
                key={r}
                className={`progress-dot${r < round ? ' done' : r === round ? ' active' : ''}`}
              />
            ))}
            <span className="progress-label">{round} / 5</span>
          </div>
          <button
            className="btn-continue-top"
            onClick={handleContinue}
            disabled={!selected || loading}
          >
            {loading ? '…' : 'Continue →'}
          </button>
        </div>
      </div>

      {/* ── Toolbar: rerolls + search ── */}
      <div className="picker-toolbar">
        <div className="picker-reroll-group">
          <span className="reroll-section-label">Reroll</span>
          <button
            className="btn-reroll"
            onClick={onTeamReroll}
            disabled={teamRerolls <= 0 || loading}
            title="Keep this era, swap to a different team"
          >
            ↻ Team{teamRerolls <= 0 && <span className="reroll-used"> (used)</span>}
          </button>
          <button
            className="btn-reroll"
            onClick={onEraReroll}
            disabled={eraRerolls <= 0 || loading}
            title="Re-spin to a completely different era and team"
          >
            ↻ Era{eraRerolls <= 0 && <span className="reroll-used"> (used)</span>}
          </button>
        </div>

        <input
          className="search-input"
          type="search"
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Player list (single column, sorted by PPG) ── */}
      <div className="picker-list">
        {filtered.map(player => {
          const isSel = selected?.id === player.id
          return (
            <div
              key={player.id}
              className={`picker-card${isSel ? ' selected' : ''}`}
              onClick={() => !loading && setSelected(isSel ? null : player)}
            >
              <div className="picker-card-top">
                <span className="picker-name">{player.name}</span>
                {isSel && <span className="picker-check">✓</span>}
              </div>
              <div className="picker-stats">
                <div className="picker-stat">
                  <span className="ps-value">{fmt(player.pts)}</span>
                  <span className="ps-label">PTS</span>
                </div>
                <div className="picker-stat">
                  <span className="ps-value">{fmt(player.reb)}</span>
                  <span className="ps-label">REB</span>
                </div>
                <div className="picker-stat">
                  <span className="ps-value">{fmt(player.stl)}</span>
                  <span className="ps-label">STL</span>
                </div>
                <div className="picker-stat">
                  <span className="ps-value">{fmt(player.blk)}</span>
                  <span className="ps-label">BLK</span>
                </div>
                <div className="picker-stat picker-stat-meta">
                  <span className="ps-value">{player.gp}G</span>
                  <span className="ps-label">{fmt(player.min_per_game)} MPG</span>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="picker-empty">No players match "{search}"</div>
        )}

        {/* Spacer so the last card clears the sticky bottom bar */}
        {selected && <div className="picker-list-spacer" />}
      </div>

      {/* ── Sticky bottom bar (shown once a player is selected) ── */}
      {selected && (
        <div className="picker-bottom-bar">
          <div className="picker-bottom-info">
            <span className="picker-bottom-check">✓</span>
            <span className="picker-bottom-name">{selected.name}</span>
            <span className="picker-bottom-pts">{fmt(selected.pts)} PPG</span>
          </div>
          <button
            className="btn-lock-in"
            onClick={handleContinue}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Lock In →'}
          </button>
        </div>
      )}
    </div>
  )
}
