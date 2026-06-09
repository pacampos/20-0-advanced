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
  const [screen, setScreen] = useState('start')   // 'start' | 'jackpot' | 'pick' | 'result'
  const [round, setRound] = useState(1)            // 1-5
  const [index, setIndex] = useState(null)
  const [seasonCache, setSeasonCache] = useState({})
  const [assignment, setAssignment] = useState(null) // { season, teamName, players, leagueAvg }
  const [picks, setPicks] = useState([])             // [{player, season, teamName, leagueAvg}]
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

  async function pickAssignment(idx) {
    const seasons = Object.keys(idx.seasons)
    const season = pickRandom(seasons)
    const data = await fetchSeason(season)
    const teams = Object.keys(data.teams)
    const teamName = pickRandom(teams)
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
      const a = await pickAssignment(idx)
      setAssignment(a)
      setPicks([])
      setRound(1)
      setScreen('jackpot')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJackpotComplete = () => {
    setScreen('pick')
  }

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
        const a = await pickAssignment(index)
        setAssignment(a)
        setRound(r => r + 1)
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

  const reset = () => {
    setScreen('start')
    setPicks([])
    setRound(1)
    setAssignment(null)
  }

  return (
    <div className="app">
      {screen === 'start' && (
        <StartScreen onPlay={startGame} loading={loading} error={error} />
      )}
      {screen === 'jackpot' && assignment && (
        <JackpotAnimation
          key={round}
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
          onPick={handlePlayerPick}
        />
      )}
      {screen === 'result' && (
        <FinalTeam picks={picks} onPlayAgain={reset} />
      )}
    </div>
  )
}
