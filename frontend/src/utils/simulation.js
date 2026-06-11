// off_rtg = OBPM, def_rtg = -DBPM (both BPM-scale, 0 = league avg for that era)
// league_avg = {0, 0} so the shift below is a no-op; netRtg = avg(OBPM + DBPM) = avg(BPM)
const BASELINE = 0.0

export function simulateSeason(picks) {
  const adjusted = picks.map(({ player, leagueAvg }) => {
    const lgOff = leagueAvg?.off_rtg ?? BASELINE
    const lgDef = leagueAvg?.def_rtg ?? BASELINE
    return {
      adj_off: (player.off_rtg ?? BASELINE) + (BASELINE - lgOff),
      adj_def: (player.def_rtg ?? BASELINE) + (BASELINE - lgDef),
    }
  })

  const teamOff = adjusted.reduce((s, p) => s + p.adj_off, 0) / adjusted.length
  const teamDef = adjusted.reduce((s, p) => s + p.adj_def, 0) / adjusted.length

  // netRtg = avg(BPM) across 5 picks; divisor 3 calibrated for BPM scale
  // (avg BPM 7 ≈ 74 wins; avg BPM 10 ≈ 79 wins with ~3% shot at 82-0)
  const netRtg = teamOff - teamDef
  const winPct = 1 / (1 + Math.exp(-netRtg / 3))

  let wins = 0
  for (let g = 0; g < 82; g++) {
    if (Math.random() < winPct) wins++
  }

  return {
    wins,
    losses: 82 - wins,
    netRtg: Math.round(netRtg * 10) / 10,
    teamOff: Math.round(teamOff * 10) / 10,
    teamDef: Math.round(teamDef * 10) / 10,
    winPct: Math.round(winPct * 1000) / 10,
  }
}

export function recordTier(wins) {
  if (wins === 82) return { label: 'UNDEFEATED — GREATEST TEAM EVER ASSEMBLED', color: 'gold' }
  if (wins >= 75)  return { label: 'DYNASTY LEVEL — ALL-TIME GREAT',            color: 'gold' }
  if (wins >= 65)  return { label: 'CHAMPIONSHIP CONTENDER',                     color: 'good' }
  if (wins >= 55)  return { label: 'PLAYOFF ELITE',                              color: 'good' }
  if (wins >= 45)  return { label: 'PLAYOFF BOUND',                              color: 'ok'   }
  if (wins >= 36)  return { label: 'MIDDLE OF THE PACK',                         color: 'ok'   }
  return                  { label: 'LOTTERY TEAM',                               color: 'poor' }
}
