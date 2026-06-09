import PlayerCard from './PlayerCard'

export default function GameScreen({
  assignment, selected, teamRerolls, eraRerolls, loading,
  onTogglePlayer, onTeamReroll, onEraReroll, onFinalize,
}) {
  const { teamName, season, players } = assignment

  return (
    <div className="game-screen">
      <div className="game-header">
        <div className="team-banner">
          <div className="team-name">{teamName}</div>
          <div className="season-label">{season} Season</div>
        </div>
        <div className="reroll-controls">
          <button
            className="btn-reroll"
            onClick={onTeamReroll}
            disabled={teamRerolls <= 0 || loading}
            title="Keep this season, swap the team"
          >
            <span className="reroll-label">Team Reroll</span>
            <span className="reroll-count">×{teamRerolls}</span>
          </button>
          <button
            className="btn-reroll"
            onClick={onEraReroll}
            disabled={eraRerolls <= 0 || loading}
            title="Jump to a different era entirely"
          >
            <span className="reroll-label">Era Reroll</span>
            <span className="reroll-count">×{eraRerolls}</span>
          </button>
        </div>
      </div>

      <div className="selection-bar">
        <div className="selection-status">
          <span className="sel-count">{selected.length}</span>
          / 5 players selected
        </div>
        <button
          className="btn-finalize"
          onClick={onFinalize}
          disabled={selected.length !== 5}
        >
          LOCK IN SQUAD
        </button>
      </div>

      <div className="stat-legend">
        <span>OffRtg — points produced per 100 possessions (higher = better)</span>
        <span>DefRtg ↓ — points allowed per 100 possessions (lower = better)</span>
        <span>PIE — overall player impact estimate</span>
      </div>

      {loading ? (
        <div className="loading-overlay">Loading players…</div>
      ) : (
        <div className="players-grid">
          {players.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              selected={selected.some(p => p.id === player.id)}
              onToggle={() => onTogglePlayer(player)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
