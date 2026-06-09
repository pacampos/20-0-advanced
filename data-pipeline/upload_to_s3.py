"""
Uploads all JSON files from ../data/ to s3://<bucket>/data/
with gzip encoding for fast CloudFront delivery.

Usage:
  python upload_to_s3.py --bucket my-bucket-name
  python upload_to_s3.py --bucket my-bucket-name --season 2016-17  # single file
"""

import argparse
import gzip
import json
from pathlib import Path

import boto3

DATA_DIR = Path(__file__).parent.parent / 'data'


def upload_file(s3, bucket: str, local_path: Path, s3_key: str):
    content = local_path.read_bytes()
    compressed = gzip.compress(content)
    s3.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=compressed,
        ContentType='application/json',
        ContentEncoding='gzip',
        CacheControl='public, max-age=86400',  # 24h cache; adjust as needed
    )
    ratio = len(compressed) / len(content) * 100
    print(f"  {s3_key} ({len(content)//1024}KB → {len(compressed)//1024}KB, {ratio:.0f}%)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bucket', required=True)
    parser.add_argument('--season', help='Upload a single season file, e.g. 2016-17')
    parser.add_argument('--region', default='us-east-1')
    args = parser.parse_args()

    s3 = boto3.client('s3', region_name=args.region)

    if args.season:
        files = [DATA_DIR / f"{args.season}.json"]
        files = [f for f in files if f.exists()]
    else:
        files = sorted(DATA_DIR.glob('*.json'))

    print(f"Uploading {len(files)} file(s) to s3://{args.bucket}/data/")
    for f in files:
        upload_file(s3, args.bucket, f, f"data/{f.name}")

    print("Upload complete.")


if __name__ == '__main__':
    main()
