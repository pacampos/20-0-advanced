#!/usr/bin/env bash
# Full deploy: CloudFormation stack + frontend build + S3 upload
# Usage: ./deploy.sh [--region us-east-1]
set -euo pipefail

STACK_NAME="20-0-advanced"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown option $1"; exit 1 ;;
  esac
done

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_SUFFIX="-${ACCOUNT_ID}"

echo "==> Deploying CloudFormation stack: $STACK_NAME"
aws cloudformation deploy \
  --template-file "$(dirname "$0")/template.yaml" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides "BucketSuffix=${BUCKET_SUFFIX}" \
  --region "$REGION" \
  --no-fail-on-empty-changeset

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

CF_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text)

echo "==> Building frontend"
cd "$(dirname "$0")/../frontend"
npm install
npm run build

echo "==> Uploading frontend to s3://$BUCKET/"
aws s3 sync dist/ "s3://$BUCKET/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# index.html should not be cached long (so deploys take effect immediately)
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "public, max-age=0, must-revalidate"

echo "==> Invalidating CloudFront cache"
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --region us-east-1 \
  > /dev/null

echo ""
echo "✓ Deployed: $CF_URL"
echo ""
echo "Next: run the data pipeline and upload data"
echo "  cd ../data-pipeline"
echo "  pip install -r requirements.txt"
echo "  python fetch_stats.py --start 2000   # start with modern era"
echo "  python upload_to_s3.py --bucket $BUCKET"
