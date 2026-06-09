"""
Fetches NBA player stats for every available season and outputs one JSON file
per season into the ../data/ directory.

Each player entry contains:
  Display stats  — PTS, REB, STL, BLK, +/- per game (shown to user)
  Hidden stats   — OffRtg, DefRtg, PIE per 100 possessions (used for simulation)

Each season entry also contains:
  league_avg     — era baseline for era-normalization across seasons

Run:
  pip install -r requirements.txt
  python fetch_stats.py                    # all seasons (takes ~40 min)
  python fetch_stats.py --season 2016-17   # single season
  python fetch_stats.py --start 2000       # from 2000-01 onward
"""

import json
import math
import time
import argparse
from pathlib import Path

from nba_api.stats.endpoints import leaguedashplayerstats, leaguedashteamstats
from nba_api.stats.static import teams as nba_teams_static

OUTPUT_DIR = Path(__file__).parent.parent / 'data'
MIRROR_DIR = Path(__file__).parent.parent / 'frontend' / 'public' / 'data'

FIRST_SEASON   = 1946
CURRENT_SEASON = 2024  # start year of 2024-25

# stats.nba.com refuses requests without these headers
NBA_HEADERS = {
    'Host': 'stats.nba.com',
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) '
        'Gecko/20100101 Firefox/120.0'
    ),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
    'Referer': 'https://www.nba.com/',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
}

TIMEOUT = 120  # seconds


def min_minutes_for_season(start_year: int) -> int:
    if start_year >= 1980: return 500
    if start_year >= 1960: return 300
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


def call_with_retry(fn, retries=3, base_sleep=3):
    """Call fn(), retrying up to `retries` times with exponential backoff."""
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            if attempt == retries - 1:
                raise
            wait = base_sleep * (2 ** attempt)
            print(f"  retry {attempt + 1}/{retries} after {wait}s ({e})", end=' ', flush=True)
            time.sleep(wait)


def fetch_league_avg(season: str) -> dict:
    """Fetch league-wide average OffRtg, DefRtg, Pace for era normalization."""
    try:
        df = call_with_retry(lambda: leaguedashteamstats.LeagueDashTeamStats(
            season=season,
            measure_type_detailed_defense='Advanced',
            per_mode_detailed='PerGame',
            headers=NBA_HEADERS,
            timeout=TIMEOUT,
        ).get_data_frames()[0])
        time.sleep(1.5)
        return {
            'off_rtg': safe(df['OFF_RATING'].mean(), 1),
            'def_rtg': safe(df['DEF_RATING'].mean(), 1),
            'pace':    safe(df['PACE'].mean(), 1),
        }
    except Exception:
        return {'off_rtg': 110.0, 'def_rtg': 110.0, 'pace': 96.0}


def fetch_season(season: str, output_dir: Path) -> bool:
    output_path = output_dir / f"{season}.json"
    if output_path.exists():
        print(f"  {season} already exists, skipping")
        return True

    print(f"Fetching {season}…", end=' ', flush=True)
    start_year = int(season[:4])
    min_min    = min_minutes_for_season(start_year)

    try:
        adv = call_with_retry(lambda: leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            measure_type_detailed_defense='Advanced',
            per_mode_detailed='PerGame',
            headers=NBA_HEADERS,
            timeout=TIMEOUT,
        ).get_data_frames()[0])
        time.sleep(1.5)

        base = call_with_retry(lambda: leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            measure_type_detailed_defense='Base',
            per_mode_detailed='PerGame',
            headers=NBA_HEADERS,
            timeout=TIMEOUT,
        ).get_data_frames()[0])
        time.sleep(1.5)

        league_avg = fetch_league_avg(season)

    except Exception as e:
        print(f"ERROR: {e}")
        return False

    adv  = adv[['PLAYER_ID', 'PLAYER_NAME', 'TEAM_ID', 'TEAM_ABBREVIATION',
                 'GP', 'MIN', 'OFF_RATING', 'DEF_RATING', 'PIE']]
    base = base[['PLAYER_ID', 'TEAM_ID', 'PTS', 'REB', 'STL', 'BLK', 'PLUS_MINUS', 'GP']]

    merged = adv.merge(base, on=['PLAYER_ID', 'TEAM_ID'], how='left', suffixes=('', '_b'))
    merged['TOTAL_MIN']  = merged['MIN'] * merged['GP']
    merged               = merged[merged['TOTAL_MIN'] >= min_min]
    merged['PM_PER_GAME'] = merged['PLUS_MINUS'] / merged['GP'].clip(lower=1)

    team_id_to_name = {t['id']: t['full_name'] for t in nba_teams_static.get_teams()}

    teams_data: dict = {}
    for _, row in merged.iterrows():
        tid       = int(row['TEAM_ID'])
        abbr      = str(row['TEAM_ABBREVIATION'])
        team_name = team_id_to_name.get(tid, abbr)

        if team_name not in teams_data:
            teams_data[team_name] = {'team_id': tid, 'abbreviation': abbr, 'players': []}

        teams_data[team_name]['players'].append({
            'id':           int(row['PLAYER_ID']),
            'name':         str(row['PLAYER_NAME']),
            'gp':           int(row['GP']),
            'min_per_game': safe(row['MIN'], 1),
            'min_total':    safe(row['TOTAL_MIN'], 0),
            'pts':          safe(row['PTS'], 1),
            'reb':          safe(row['REB'], 1),
            'stl':          safe(row['STL'], 1),
            'blk':          safe(row['BLK'], 1),
            'plus_minus':   safe(row['PM_PER_GAME'], 1),
            'off_rtg':      safe(row['OFF_RATING'], 1),
            'def_rtg':      safe(row['DEF_RATING'], 1),
            'pie':          safe(row['PIE'], 4),
        })

    for team in teams_data.values():
        team['players'].sort(key=lambda p: p['pie'] or 0, reverse=True)

    output  = {'season': season, 'league_avg': league_avg, 'teams': teams_data}
    payload = json.dumps(output, separators=(',', ':'))
    output_path.write_text(payload)
    MIRROR_DIR.mkdir(parents=True, exist_ok=True)
    (MIRROR_DIR / output_path.name).write_text(payload)

    total_players = sum(len(t['players']) for t in teams_data.values())
    print(f"{len(teams_data)} teams, {total_players} players")
    return True


def build_index(output_dir: Path):
    seasons: dict      = {}
    team_seasons: dict = {}

    for f in sorted(output_dir.glob('*.json')):
        if f.name == 'index.json':
            continue
        data   = json.loads(f.read_text())
        season = data['season']
        teams  = list(data['teams'].keys())
        if not teams:
            continue
        seasons[season] = teams
        for t in teams:
            team_seasons.setdefault(t, []).append(season)

    index   = {'seasons': seasons, 'team_seasons': team_seasons}
    payload = json.dumps(index, separators=(',', ':'))
    (output_dir / 'index.json').write_text(payload)
    MIRROR_DIR.mkdir(parents=True, exist_ok=True)
    (MIRROR_DIR / 'index.json').write_text(payload)
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
            time.sleep(2)  # polite gap between seasons

    build_index(out)
    print("Done.")
