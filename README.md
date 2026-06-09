# 20-0 Advanced

Build your dream squad. Get randomly assigned an NBA franchise and season,
then pick 5 players using pace-adjusted advanced stats.

**Stats used:**
- **OffRtg** — Offensive Rating per 100 possessions (higher = better)
- **DefRtg** — Defensive Rating per 100 possessions (lower = better)
- **PIE** — Player Impact Estimate (overall contribution)
- PTS / AST / REB / STL / BLK per 100 possessions

Players filtered by minimum minutes to exclude small-sample noise.
Pre-1973 ratings are estimated from historical pace data.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite |
| Hosting | S3 static site + CloudFront CDN |
| Data | JSON files on S3 (fetched via `nba_api`) |
| Infrastructure | AWS CloudFormation |

## Quick start (local dev)

```bash
# 1. Fetch at least one season of data
cd data-pipeline
pip install -r requirements.txt
python fetch_stats.py --season 2016-17

# 2. Run the frontend (uses ../data/ as public dir)
cd ../frontend
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to AWS

You need AWS credentials with S3 + CloudFront + CloudFormation permissions.

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1

chmod +x infrastructure/deploy.sh
./infrastructure/deploy.sh
```

This creates the CloudFormation stack, builds the React app, and deploys it to S3/CloudFront. The output URL is your game URL.

Then upload data:

```bash
cd data-pipeline
# Fetch all seasons (takes ~30 min due to rate limiting)
python fetch_stats.py

# Or start with modern era only
python fetch_stats.py --start 2000

# Upload to S3
python upload_to_s3.py --bucket YOUR_BUCKET_NAME
```

## Refreshing data mid-season

```bash
cd data-pipeline
python fetch_stats.py --season 2024-25   # re-fetch current season
python upload_to_s3.py --bucket YOUR_BUCKET_NAME --season 2024-25
```

## Project layout

```
20-0-advanced/
├── frontend/           React + Vite app
│   └── src/
│       ├── App.jsx     Game state & routing
│       └── components/
│           ├── StartScreen.jsx
│           ├── GameScreen.jsx
│           ├── PlayerCard.jsx
│           └── FinalTeam.jsx
├── data-pipeline/
│   ├── fetch_stats.py  Pulls from nba_api → ../data/*.json
│   └── upload_to_s3.py Uploads data/ to S3 with gzip
├── infrastructure/
│   ├── template.yaml   CloudFormation: S3 + CloudFront OAC
│   └── deploy.sh       One-command deploy script
└── data/               JSON files (gitignored, generated locally)
```
