import { useState, useEffect } from 'react'

const SPIN_YEARS = [
  '1965','1972','1979','1984','1987','1991','1993','1996','1998',
  '2001','2004','2008','2011','2013','2016','2018','2020','2023',
]
const SPIN_TEAMS = [
  'Lakers','Bulls','Celtics','Warriors','Spurs','Heat','Pistons',
  'Suns','Jazz','Rockets','Knicks','Nets','Bucks','76ers','Nuggets',
]

export default function JackpotAnimation({ targetYear, targetTeam, round, onComplete }) {
  const [displayYear, setDisplayYear] = useState('????')
  const [displayTeam, setDisplayTeam] = useState('?????????')
  const [yearLocked, setYearLocked] = useState(false)
  const [teamLocked, setTeamLocked] = useState(false)

  useEffect(() => {
    let yi = 0
    let ti = 0
    setYearLocked(false)
    setTeamLocked(false)

    // Fast spin — both slots
    const fast = setInterval(() => {
      setDisplayYear(SPIN_YEARS[yi++ % SPIN_YEARS.length])
      setDisplayTeam(SPIN_TEAMS[ti++ % SPIN_TEAMS.length])
    }, 55)

    // Lock the year after 2.0s, slow-spin the team
    const lockYear = setTimeout(() => {
      clearInterval(fast)
      setDisplayYear(targetYear)
      setYearLocked(true)

      let ti2 = 0
      const slow = setInterval(() => {
        setDisplayTeam(SPIN_TEAMS[ti2++ % SPIN_TEAMS.length])
      }, 130)

      // Lock team after 1.1s more
      const lockTeam = setTimeout(() => {
        clearInterval(slow)
        setDisplayTeam(targetTeam)
        setTeamLocked(true)
        // Pause on reveal, then hand off
        setTimeout(onComplete, 900)
      }, 1100)

      return () => { clearInterval(slow); clearTimeout(lockTeam) }
    }, 2000)

    return () => { clearInterval(fast); clearTimeout(lockYear) }
  }, [targetYear, targetTeam])

  return (
    <div className="jackpot-screen">
      <div className="jackpot-round-label">ROUND {round} of 5</div>
      <div className="jackpot-title">82-0</div>

      <div className="jackpot-slots">
        <div className="jackpot-slot">
          <div className="jackpot-slot-label">SEASON</div>
          <div className={`jackpot-value${yearLocked ? ' locked' : ' spinning'}`}>
            {displayYear}
          </div>
        </div>

        <div className="jackpot-separator">—</div>

        <div className="jackpot-slot">
          <div className="jackpot-slot-label">TEAM</div>
          <div className={`jackpot-value team-value${teamLocked ? ' locked' : ' spinning'}`}>
            {displayTeam}
          </div>
        </div>
      </div>

      <div className="jackpot-hint">
        {!yearLocked ? 'Spinning…' : !teamLocked ? 'Locking year…' : 'Your roster awaits'}
      </div>
    </div>
  )
}
