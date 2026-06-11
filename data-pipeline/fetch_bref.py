"""
Scrapes NBA player stats from Basketball-Reference for every available season.

Output schema matches fetch_stats.py with these mappings:
  off_rtg  = OBPM  (Offensive Box Plus/Minus, era-normalized: 0 = league avg)
  def_rtg  = -DBPM (negated so lower = better defender, matches original convention)
  pie      = WS/48 (Win Shares per 48 min, used for sorting roster)
  league_avg = {off_rtg: 0.0, def_rtg: 0.0}  — BPM already era-adjusted; no shift needed

Front-end simulation:
  netRtg = avg(off_rtg - def_rtg) = avg(OBPM - (-DBPM)) = avg(BPM)
  winPct = sigmoid(netRtg / 3)   — divisor 3, calibrated for BPM scale

BRef notes:
  • Per-game table id: per_game_stats   • Advanced table id: advanced
  • Team column: "Team" in both tables
  • Multi-team rows: "2TM", "3TM", "4TM" (kept for season-total stats)
  • OBPM/DBPM back-calculated to 1973-74 (first_season = 1974)
  • +/- not in BRef league tables; field set to null

Run:
  pip install -r requirements.txt
  python fetch_bref.py                    # all seasons 1974-2024
  python fetch_bref.py --season 2016-17   # single season
  python fetch_bref.py --start 2000       # from 2000-01 onward
"""

import hashlib
import json
import math
import time
import argparse
from io import StringIO
from pathlib import Path

import requests
import pandas as pd
from bs4 import BeautifulSoup

OUTPUT_DIR = Path(__file__).parent.parent / 'data'
MIRROR_DIR = Path(__file__).parent.parent / 'frontend' / 'public' / 'data'

FIRST_SEASON   = 1974   # OBPM/DBPM back-calculated to 1973-74
CURRENT_SEASON = 2024   # start year of 2024-25

BREF_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

SLEEP_SECS = 4.0   # polite gap; keeps well under BRef's rate limit

# Multi-team sentinel values (traded players get one of these for their totals row)
MULTI_TEAM = {'2TM', '3TM', '4TM'}

# BRef abbreviation → display name
TEAM_NAMES = {
    'ATL': 'Atlanta Hawks',           'BOS': 'Boston Celtics',
    'BRK': 'Brooklyn Nets',           'CHO': 'Charlotte Hornets',
    'CHI': 'Chicago Bulls',           'CLE': 'Cleveland Cavaliers',
    'DAL': 'Dallas Mavericks',        'DEN': 'Denver Nuggets',
    'DET': 'Detroit Pistons',         'GSW': 'Golden State Warriors',
    'HOU': 'Houston Rockets',         'IND': 'Indiana Pacers',
    'LAC': 'LA Clippers',             'LAL': 'Los Angeles Lakers',
    'MEM': 'Memphis Grizzlies',       'MIA': 'Miami Heat',
    'MIL': 'Milwaukee Bucks',         'MIN': 'Minnesota Timberwolves',
    'NOP': 'New Orleans Pelicans',    'NYK': 'New York Knicks',
    'OKC': 'Oklahoma City Thunder',   'ORL': 'Orlando Magic',
    'PHI': 'Philadelphia 76ers',      'PHO': 'Phoenix Suns',
    'POR': 'Portland Trail Blazers',  'SAC': 'Sacramento Kings',
    'SAS': 'San Antonio Spurs',       'TOR': 'Toronto Raptors',
    'UTA': 'Utah Jazz',               'WAS': 'Washington Wizards',
    # Historical
    'NJN': 'New Jersey Nets',         'NOH': 'New Orleans Hornets',
    'NOK': 'New Orleans/Oklahoma City Hornets',
    'SEA': 'Seattle SuperSonics',     'VAN': 'Vancouver Grizzlies',
    'CHA': 'Charlotte Bobcats',       'WSB': 'Washington Bullets',
    'SDC': 'San Diego Clippers',      'KCK': 'Kansas City Kings',
    'SDR': 'San Diego Rockets',       'NOJ': 'New Orleans Jazz',
    'KCO': 'Kansas City-Omaha Kings', 'BUF': 'Buffalo Braves',
    'CAP': 'Capital Bullets',         'BAL': 'Baltimore Bullets',
    'CIN': 'Cincinnati Royals',       'CHZ': 'Chicago Zephyrs',
    'PTP': 'Pittsburgh Pipers',
}


# ── helpers ──────────────────────────────────────────────────────────────────

def season_str(start_year: int) -> str:
    return f"{start_year}-{str(start_year + 1)[2:]}"


def bref_year(start_year: int) -> int:
    """BRef URL year = ending year of season (2016-17 → 2017)."""
    return start_year + 1


def min_minutes_for_season(start_year: int) -> int:
    if start_year >= 1980: return 500
    if start_year >= 1960: return 300
    return 180


def safe(val, decimals=1):
    try:
        v = float(val)
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, decimals)
    except (TypeError, ValueError):
        return None


def stable_id(name: str, season: str) -> int:
    """Deterministic integer ID for a player in a given season."""
    return int(hashlib.md5(f"{name}|{season}".encode()).hexdigest()[:8], 16)


# ── BRef table fetcher ───────────────────────────────────────────────────────

def fetch_table(url: str, table_id: str) -> pd.DataFrame:
    """Download a BRef stats table and return as a clean DataFrame."""
    resp = requests.get(url, headers=BREF_HEADERS, timeout=45)
    resp.raise_for_status()

    # BRef occasionally hides tables inside HTML comments; expose them
    html = resp.text
    html = html.replace('<!--\n<table', '<table').replace('</table>\n-->', '</table>')

    soup  = BeautifulSoup(html, 'html.parser')
    table = soup.find('table', {'id': table_id})
    if table is None:
        raise ValueError(f"Table '{table_id}' not found at {url}")

    df = pd.read_html(StringIO(str(table)))[0]

    # Flatten multi-level headers if present
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [' '.join(str(c) for c in col).strip() for col in df.columns]

    # Drop repeated in-table header rows and NaN player rows
    if 'Rk' in df.columns:
        df = df[df['Rk'].astype(str).str.strip() != 'Rk'].copy()
    df = df.dropna(subset=['Player']).copy()
    df['Player'] = df['Player'].astype(str).str.replace('*', '', regex=False).str.strip()

    return df.reset_index(drop=True)


# ── traded-player deduplication ───────────────────────────────────────────────

def primary_team(group: pd.DataFrame) -> str:
    """Return the team with most games among non-multi-team rows."""
    real = group[~group['Team'].astype(str).isin(MULTI_TEAM)].copy()
    if real.empty:
        return str(group.iloc[0]['Team'])
    real['G'] = pd.to_numeric(real['G'], errors='coerce')
    return str(real.sort_values('G', ascending=False).iloc[0]['Team'])


def dedup(df: pd.DataFrame) -> pd.DataFrame:
    """
    Keep one row per player:
    • If a 2TM/3TM row exists → use it for stats, set _team = team with most games
    • Otherwise → keep the single row as-is
    """
    rows = []
    for _, group in df.groupby('Player', sort=False):
        multi = group[group['Team'].astype(str).isin(MULTI_TEAM)]
        if not multi.empty:
            row = multi.iloc[0].copy()
            row['_team'] = primary_team(group)
        else:
            row = group.iloc[0].copy()
            row['_team'] = str(row['Team'])
        rows.append(row)
    return pd.DataFrame(rows).reset_index(drop=True)


# ── season fetcher ────────────────────────────────────────────────────────────

def fetch_season(season: str, output_dir: Path) -> bool:
    output_path = output_dir / f"{season}.json"
    if output_path.exists():
        print(f"  {season} already exists, skipping")
        return True

    start_year = int(season[:4])
    year       = bref_year(start_year)
    min_min    = min_minutes_for_season(start_year)

    print(f"Fetching {season}…", end=' ', flush=True)

    try:
        base = fetch_table(
            f"https://www.basketball-reference.com/leagues/NBA_{year}_per_game.html",
            'per_game_stats',
        )
        time.sleep(SLEEP_SECS)

        adv = fetch_table(
            f"https://www.basketball-reference.com/leagues/NBA_{year}_advanced.html",
            'advanced',
        )
        time.sleep(SLEEP_SECS)
    except Exception as e:
        print(f"ERROR: {e}")
        return False

    # ── numeric coercion ──
    for col in ['G', 'MP', 'PTS', 'TRB', 'STL', 'BLK']:
        if col in base.columns:
            base[col] = pd.to_numeric(base[col], errors='coerce')

    for col in ['G', 'MP', 'OBPM', 'DBPM', 'BPM', 'WS/48']:
        if col in adv.columns:
            adv[col] = pd.to_numeric(adv[col], errors='coerce')

    # advanced MP = total minutes for the season
    adv['_total_min'] = adv['MP'].fillna(0) if 'MP' in adv.columns else 0.0

    # ── deduplicate traded players ──
    base = dedup(base)
    adv  = dedup(adv)

    # ── merge on player name ──
    adv_cols = [c for c in ['Player', 'OBPM', 'DBPM', 'WS/48', '_total_min'] if c in adv.columns]
    merged = base.merge(adv[adv_cols], on='Player', how='inner')

    # ── minimum-minutes filter ──
    merged = merged[merged['_total_min'].fillna(0) >= min_min].copy()

    if merged.empty:
        print("ERROR: no players passed the minutes filter — season may not be on BRef yet")
        return False

    # ── build output dict ──
    teams_data: dict = {}
    for _, row in merged.iterrows():
        abbr      = str(row.get('_team', 'UNK'))
        team_name = TEAM_NAMES.get(abbr, abbr)

        if team_name not in teams_data:
            teams_data[team_name] = {'abbreviation': abbr, 'players': []}

        obpm = safe(row.get('OBPM'), 2) or 0.0
        dbpm = safe(row.get('DBPM'), 2) or 0.0
        ws48 = safe(row.get('WS/48'), 4) or 0.0
        gp   = int(row['G']) if pd.notna(row.get('G')) else 0

        teams_data[team_name]['players'].append({
            'id':           stable_id(str(row['Player']), season),
            'name':         str(row['Player']),
            'gp':           gp,
            'min_per_game': safe(row.get('MP'), 1),
            'min_total':    safe(row.get('_total_min'), 0),
            'pts':          safe(row.get('PTS'), 1),
            'reb':          safe(row.get('TRB'), 1),
            'stl':          safe(row.get('STL'), 1),
            'blk':          safe(row.get('BLK'), 1),
            'plus_minus':   None,    # not in BRef league tables
            # BPM-scale hidden stats (0 = league average for that era)
            'off_rtg':  obpm,        # OBPM: higher = better offense
            'def_rtg':  -dbpm,       # negated DBPM: lower = better defender
            'pie':      ws48,        # WS/48 proxy (used for sorting)
        })

    for team in teams_data.values():
        team['players'].sort(key=lambda p: p['pie'] or 0, reverse=True)

    # league_avg zeros because BPM is already era-normalized
    output  = {'season': season, 'league_avg': {'off_rtg': 0.0, 'def_rtg': 0.0}, 'teams': teams_data}
    payload = json.dumps(output, separators=(',', ':'), ensure_ascii=False)
    output_path.write_text(payload, encoding='utf-8')
    MIRROR_DIR.mkdir(parents=True, exist_ok=True)
    (MIRROR_DIR / output_path.name).write_text(payload, encoding='utf-8')

    total_players = sum(len(t['players']) for t in teams_data.values())
    print(f"{len(teams_data)} teams, {total_players} players")
    return True


# ── index builder ─────────────────────────────────────────────────────────────

def build_index(output_dir: Path):
    seasons: dict      = {}
    team_seasons: dict = {}

    for f in sorted(output_dir.glob('*.json')):
        if f.name == 'index.json':
            continue
        data   = json.loads(f.read_text(encoding='utf-8'))
        season = data['season']
        teams  = list(data['teams'].keys())
        if not teams:
            continue
        seasons[season] = teams
        for t in teams:
            team_seasons.setdefault(t, []).append(season)

    index   = {'seasons': seasons, 'team_seasons': team_seasons}
    payload = json.dumps(index, separators=(',', ':'), ensure_ascii=False)
    (output_dir / 'index.json').write_text(payload, encoding='utf-8')
    MIRROR_DIR.mkdir(parents=True, exist_ok=True)
    (MIRROR_DIR / 'index.json').write_text(payload, encoding='utf-8')
    print(f"Index: {len(seasons)} seasons, {len(team_seasons)} franchises")


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--season', help='Single season, e.g. 2016-17')
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
            ok = fetch_season(season_str(year), out)
            if ok:
                time.sleep(2)   # extra polite gap between seasons

    build_index(out)
    print("Done.")
