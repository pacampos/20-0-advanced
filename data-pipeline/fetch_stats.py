"""
Fetches NBA player stats for every available season and outputs one JSON file
per season into the ../data/ directory.

Stats collected (pace-adjusted):
  - OFF_RATING  : points produced per 100 possessions (offensive)
  - DEF_RATING  : points allowed per 100 possessions (defensive, lower = better)
  - PIE         : Player Impact Estimate (overall)
  - PTS/AST/REB/STL/BLK per 100 possessions

Run:
  pip install -r requirements.txt
  python fetch_stats.py                    # all seasons
  python fetch_stats.py --season 2016-17   # single season
  python fetch_stats.py --start 2000       # from 2000-01 onward
"""

import json
import math
import time
import argparse
from pathlib import Path

from nba_api.stats.endpoints import leaguedashplayerstats
from nba_api.stats.static import teams as nba_teams_static

OUTPUT_DIR = Path(__file__).parent.parent / 'data'

# nba_api has data back to ~1946-47 but advanced ratings are estimates pre-1973
FIRST_SEASON = 1946
CURRENT_SEASON = 2024  # start year of 2024-25

# Minimum total minutes to be included (scales for older/shorter seasons)
def min_minutes_for_season(start_year: int) -> int:
    if start_year >= 1980:
        return 500
    if start_year >= 1960:
        return 300
    return 180


def season_str(start_year: int) -> str:
    return f"{start_year}-{str(start_year + 1)[2:]}"


def safe(val, decimals=1):
    try:
        v = float(val)
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, decimals)
    except (TypeError, ValueError):
        return None


def fetch_season(season: str, output_dir: Path) -> bool:
    output_path = output_dir / f"{season}.json"
    if output_path.exists():
        print(f"  {season} already exists, skipping")
        return True

    print(f"Fetching {season}…", end=' ', flush=True)
    start_year = int(season[:4])
    min_min = min_minutes_for_season(start_year)

    try:
        # Advanced stats: OffRtg, DefRtg, PIE, USG%, TS%
        adv = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            measure_type_detailed_defense='Advanced',
            per_mode_simple='PerGame',
            timeout=60,
        ).get_data_frames()[0]
        time.sleep(0.8)

        # Per-100 base stats: PTS, AST, REB, STL, BLK, TOV
        p100 = leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            measure_type_detailed_defense='Base',
            per_mode_simple='Per100Possessions',
            timeout=60,
        ).get_data_frames()[0]
        time.sleep(0.8)

    except Exception as e:
        print(f"ERROR: {e}")
        return False

    # Keep only needed columns
    adv = adv[['PLAYER_ID', 'PLAYER_NAME', 'TEAM_ID', 'TEAM_ABBREVIATION',
                'GP', 'MIN', 'OFF_RATING', 'DEF_RATING', 'PIE', 'USG_PCT', 'TS_PCT']]
    p100 = p100[['PLAYER_ID', 'TEAM_ID', 'PTS', 'AST', 'REB', 'STL', 'BLK', 'TOV']]

    merged = adv.merge(p100, on=['PLAYER_ID', 'TEAM_ID'], how='left')
    merged['TOTAL_MIN'] = merged['MIN'] * merged['GP']
    merged = merged[merged['TOTAL_MIN'] >= min_min]

    # Build team name map from static list (covers current franchises)
    team_id_to_name = {t['id']: t['full_name'] for t in nba_teams_static.get_teams()}

    teams_data: dict = {}
    for _, row in merged.iterrows():
        tid = int(row['TEAM_ID'])
        abbr = str(row['TEAM_ABBREVIATION'])
        team_name = team_id_to_name.get(tid, abbr)

        if team_name not in teams_data:
            teams_data[team_name] = {'team_id': tid, 'abbreviation': abbr, 'players': []}

        teams_data[team_name]['players'].append({
            'id':           int(row['PLAYER_ID']),
            'name':         str(row['PLAYER_NAME']),
            'gp':           int(row['GP']),
            'min_per_game': safe(row['MIN'], 1),
            'min_total':    safe(row['TOTAL_MIN'], 0),
            'off_rtg':      safe(row['OFF_RATING'], 1),
            'def_rtg':      safe(row['DEF_RATING'], 1),
            'pie':          safe(row['PIE'], 4),
            'usg_pct':      safe(row['USG_PCT'], 3),
            'ts_pct':       safe(row['TS_PCT'], 3),
            'pts_per100':   safe(row['PTS'], 1),
            'ast_per100':   safe(row['AST'], 1),
            'reb_per100':   safe(row['REB'], 1),
            'stl_per100':   safe(row['STL'], 1),
            'blk_per100':   safe(row['BLK'], 1),
        })

    # Sort each team's players by PIE descending (best players shown first)
    for team in teams_data.values():
        team['players'].sort(key=lambda p: p['pie'] or 0, reverse=True)

    output = {'season': season, 'teams': teams_data}
    output_path.write_text(json.dumps(output, separators=(',', ':')))

    total_players = sum(len(t['players']) for t in teams_data.values())
    print(f"{len(teams_data)} teams, {total_players} players")
    return True


def build_index(output_dir: Path):
    seasons: dict = {}
    team_seasons: dict = {}

    for f in sorted(output_dir.glob('*.json')):
        if f.name == 'index.json':
            continue
        data = json.loads(f.read_text())
        season = data['season']
        teams = list(data['teams'].keys())
        if not teams:
            continue
        seasons[season] = teams
        for t in teams:
            team_seasons.setdefault(t, []).append(season)

    index = {'seasons': seasons, 'team_seasons': team_seasons}
    (output_dir / 'index.json').write_text(json.dumps(index, separators=(',', ':')))
    print(f"Index: {len(seasons)} seasons, {len(team_seasons)} franchises")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--season', help='Fetch a single season, e.g. 2016-17')
    parser.add_argument('--start',  type=int, default=FIRST_SEASON)
    parser.add_argument('--end',    type=int, default=CURRENT_SEASON)
    parser.add_argument('--output', default=str(OUTPUT_DIR))
    args = parser.parse_args()

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    if args.season:
        fetch_season(args.season, out)
    else:
        for year in range(args.start, args.end + 1):
            fetch_season(season_str(year), out)
            time.sleep(1.5)  # be polite to stats.nba.com

    build_index(out)
    print("Done.")
