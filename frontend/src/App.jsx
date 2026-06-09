import { useState, useCallback } from 'react'
import StartScreen from './components/StartScreen'
import JackpotAnimation from './components/JackpotAnimation'
import PlayerPicker from './components/PlayerPicker'
import FinalTeam from './components/FinalTeam'

const DATA_BASE = '/data'

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function App() {
  const [screen, setScreen] = useState('start')
  const [round, setRound] = useState(1)
  const [jackpotKey, setJackpotKey] = useState(0)   // increment to re-trigger jackpot within same round
  const [index, setIndex] = useState(null)
  const [seasonCache, setSeasonCache] = useState({})
  const [assignment, setAssignment] = useState(null)
  const [picks, setPicks] = useState([])
  const [shownTeams, setShownTeams] = useState(new Set()) // teams shown in any round (prevent repeats)
  const [teamRerolls, setTeamRerolls] = useState(1)       // 1 per game
  const [eraRerolls, setEraRerolls] = useState(1)         // 1 per game
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchIndex = useCallback(async () => {
    const res = await fetch(`${DATA_BASE}/index.json`)
    if (!res.ok) throw new Error('Could not load game data. Run the data pipeline first.')
    return res.json()
  }, [])

  const fetchSeason = useCallback(async (season) => {
    if (seasonCache[season]) return seasonCache[season]
    const res = await fetch(`${DATA_BASE}/${season}.json`)
    if (!res.ok) throw new Error(`Could not load ${season} data`)
    const data = await res.json()
    setSeasonCache(c => ({ ...c, [season]: data }))
    return data
  }, [seasonCache])

  // Pick a random season + team, excluding any team in `exclude` (Set of team names)
  async function pickAssignment(idx, exclude = new Set()) {
    const seasons = Object.keys(idx.seasons)

    // Only consider seasons that have at least one team not yet excluded
    const eligibleSeasons = seasons.filter(s =>
      idx.seasons[s].some(t => !exclude.has(t))
    )
    if (!eligibleSeasons.length) {
      // Fallback: all teams exhausted (won't happen with full dataset)
      throw new Error('Ran out of unique teams — try running the full data pipeline.')
    }

    const season = pickRandom(eligibleSeasons)
    const data = await fetchSeason(season)
    const unusedTeams = Object.keys(data.teams).filter(t => !exclude.has(t))
    const teamName = pickRandom(unusedTeams)

    return {
      season,
      teamName,
      players: data.teams[teamName].players,
      leagueAvg: data.league_avg ?? { off_rtg: 110, def_rtg: 110 },
    }
  }

  const startGame = async () => {
    setLoading(true)
    setError(null)
    try {
      const idx = index ?? await fetchIndex()
      if (!index) setIndex(idx)
      const freshShown = new Set()
      const a = await pickAssignment(idx, freshShown)
      const nextShown = new Set([...freshShown, a.teamName])
      setShownTeams(nextShown)
      setAssignment(a)
      setPicks([])
      setRound(1)
      setJackpotKey(k => k + 1)
      setTeamRerolls(1)
      setEraRerolls(1)
      setScreen('jackpot')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJackpotComplete = () => setScreen('pick')

  const handlePlayerPick = async (player) => {
    const newPick = {
      player,
      season: assignment.season,
      teamName: assignment.teamName,
      leagueAvg: assignment.leagueAvg,
    }
    const newPicks = [...picks, newPick]
    setPicks(newPicks)

    if (newPicks.length < 5) {
      setLoading(true)
      try {
        // shownTeams already includes all teams displayed so far
        const a = await pickAssignment(index, shownTeams)
        setShownTeams(prev => new Set([...prev, a.teamName]))
        setAssignment(a)
        setRound(r => r + 1)
        setJackpotKey(k => k + 1)
        setScreen('jackpot')
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    } else {
      setScreen('result')
    }
  }

  // Team reroll: swap to a different team in the same season (no jackpot re-spin)
  const handleTeamReroll = async () => {
    if (teamRerolls <= 0) return
    setLoading(true)
    try {
      const data = seasonCache[assignment.season]
      const unusedTeams = Object.keys(data.teams).filter(t => !shownTeams.has(t))
      if (!unusedTeams.length) {
        // No unused teams left in this season — fall back to era reroll behavior
        await doEraReroll()
        return
      }
      const teamName = pickRandom(unusedTeams)
      setShownTeams(prev => new Set([...prev, teamName]))
      setAssignment({
        season: assignment.season,
        teamName,
        players: data.teams[teamName].players,
        leagueAvg: assignment.leagueAvg,
      })
      setTeamRerolls(0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Era reroll: full re-spin to a completely different season + team
  const doEraReroll = async () => {
    const a = await pickAssignment(index, shownTeams)
    setShownTeams(prev => new Set([...prev, a.teamName]))
    setAssignment(a)
    setJackpotKey(k => k + 1)
    setScreen('jackpot')
  }

  const handleEraReroll = async () => {
    if (eraRerolls <= 0) return
    setLoading(true)
    try {
      setEraRerolls(0)
      await doEraReroll()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setScreen('start')
    setPicks([])
    setRound(1)
    setAssignment(null)
    setShownTeams(new Set())
  }

  return (
    <div className="app">
      {screen === 'start' && (
        <StartScreen onPlay={startGame} loading={loading} error={error} />
      )}
      {screen === 'jackpot' && assignment && (
        <JackpotAnimation
          key={jackpotKey}
          targetYear={assignment.season.split('-')[0]}
          targetTeam={assignment.teamName}
          round={round}
          onComplete={handleJackpotComplete}
        />
      )}
      {screen === 'pick' && assignment && (
        <PlayerPicker
          assignment={assignment}
          round={round}
          teamRerolls={teamRerolls}
          eraRerolls={eraRerolls}
          loading={loading}
          onPick={handlePlayerPick}
          onTeamReroll={handleTeamReroll}
          onEraReroll={handleEraReroll}
        />
      )}
      {screen === 'result' && (
        <FinalTeam picks={picks} onPlayAgain={reset} />
      )}
    </div>
  )
}
