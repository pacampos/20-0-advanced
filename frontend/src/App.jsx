import { useState, useCallback } from 'react'
import StartScreen from './components/StartScreen'
import GameScreen from './components/GameScreen'
import FinalTeam from './components/FinalTeam'

const DATA_BASE = '/data'
const TEAM_REROLLS = 3
const ERA_REROLLS = 3

const ERA_BUCKETS = {
  'old-school': s => parseInt(s) < 1980,
  'classic':    s => parseInt(s) >= 1980 && parseInt(s) < 2000,
  'modern':     s => parseInt(s) >= 2000 && parseInt(s) < 2015,
  'current':    s => parseInt(s) >= 2015,
}

function getEra(season) {
  const y = parseInt(season)
  if (y < 1980) return 'old-school'
  if (y < 2000) return 'classic'
  if (y < 2015) return 'modern'
  return 'current'
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function App() {
  const [screen, setScreen] = useState('start')
  const [index, setIndex] = useState(null)
  const [seasonData, setSeasonData] = useState(null)
  const [assignment, setAssignment] = useState(null) // { season, teamName, players }
  const [selected, setSelected] = useState([])
  const [teamRerolls, setTeamRerolls] = useState(TEAM_REROLLS)
  const [eraRerolls, setEraRerolls] = useState(ERA_REROLLS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchIndex = useCallback(async () => {
    const res = await fetch(`${DATA_BASE}/index.json`)
    if (!res.ok) throw new Error('Could not load game data. Run the data pipeline first.')
    return res.json()
  }, [])

  const fetchSeason = useCallback(async (season) => {
    const res = await fetch(`${DATA_BASE}/${season}.json`)
    if (!res.ok) throw new Error(`Could not load season ${season}`)
    return res.json()
  }, [])

  function assignFromData(data, excludeTeam = null) {
    const teams = Object.keys(data.teams).filter(t => t !== excludeTeam)
    if (!teams.length) return null
    const teamName = pickRandom(teams)
    return { season: data.season, teamName, players: data.teams[teamName].players }
  }

  async function pickNewSeasonAndTeam(idx, excludeEra = null) {
    const allSeasons = Object.keys(idx.seasons)
    let eligible = allSeasons
    if (excludeEra) {
      const filtered = allSeasons.filter(s => getEra(s) !== excludeEra)
      if (filtered.length) eligible = filtered
    }
    const season = pickRandom(eligible)
    const data = await fetchSeason(season)
    return { data, assignment: assignFromData(data) }
  }

  const startGame = async () => {
    setLoading(true)
    setError(null)
    try {
      const idx = index ?? await fetchIndex()
      if (!index) setIndex(idx)
      const { data, assignment: a } = await pickNewSeasonAndTeam(idx)
      setSeasonData(data)
      setAssignment(a)
      setSelected([])
      setTeamRerolls(TEAM_REROLLS)
      setEraRerolls(ERA_REROLLS)
      setScreen('game')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTeamReroll = () => {
    if (teamRerolls <= 0 || !seasonData) return
    const a = assignFromData(seasonData, assignment.teamName)
    if (a) {
      setAssignment(a)
      setSelected([])
      setTeamRerolls(r => r - 1)
    }
  }

  const handleEraReroll = async () => {
    if (eraRerolls <= 0) return
    setLoading(true)
    try {
      const currentEra = getEra(assignment.season)
      const { data, assignment: a } = await pickNewSeasonAndTeam(index, currentEra)
      setSeasonData(data)
      setAssignment(a)
      setSelected([])
      setEraRerolls(r => r - 1)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const togglePlayer = (player) => {
    setSelected(prev => {
      const already = prev.some(p => p.id === player.id)
      if (already) return prev.filter(p => p.id !== player.id)
      if (prev.length >= 5) return prev
      return [...prev, player]
    })
  }

  const finalizeTeam = () => {
    if (selected.length === 5) setScreen('final')
  }

  const reset = () => {
    setScreen('start')
    setAssignment(null)
    setSelected([])
  }

  return (
    <div className="app">
      {screen === 'start' && (
        <StartScreen onPlay={startGame} loading={loading} error={error} />
      )}
      {screen === 'game' && assignment && (
        <GameScreen
          assignment={assignment}
          selected={selected}
          teamRerolls={teamRerolls}
          eraRerolls={eraRerolls}
          loading={loading}
          onTogglePlayer={togglePlayer}
          onTeamReroll={handleTeamReroll}
          onEraReroll={handleEraReroll}
          onFinalize={finalizeTeam}
        />
      )}
      {screen === 'final' && assignment && (
        <FinalTeam
          assignment={assignment}
          players={selected}
          onPlayAgain={reset}
        />
      )}
    </div>
  )
}
