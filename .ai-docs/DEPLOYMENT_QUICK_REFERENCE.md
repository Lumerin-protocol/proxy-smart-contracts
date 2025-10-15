# Deployment Quick Reference

## 🚀 One-Time Setup

### Step 1: Create AWS OIDC Provider
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile titanio-dev
```

### Step 2: Update GitHub Org in IAM Trust Policy
Edit `proxy-ui-foundation/.terragrunt/09_github_actions_iam.tf` line 37:
```hcl
"token.actions.githubusercontent.com:sub" = "repo:lumerin-protocol/proxy-smart-contracts:*"
```

### Step 3: Deploy IAM Role
```bash
cd proxy-ui-foundation/02-dev
terragrunt apply
terragrunt output github_actions_role_arn
```

### Step 4: Add GitHub Secret
Go to GitHub → Settings → Secrets → Actions → New secret:
- Name: `AWS_ROLE_ARN_DEV`
- Value: (the ARN from step 3)

## 📦 Deployment Methods

### Automatic (Push to Branch)
```bash
# Trigger notification deployment
git add notifications/
git commit -m "feat: update notification service"
git push origin dev

# Trigger Lambda deployment
git add margin-call/
git commit -m "fix: improve margin calculation"
git push origin dev

# Trigger subgraph deployment
git add subgraph-futures/
git commit -m "feat: add new entity"
git push origin dev
```

### Manual (GitHub UI)
1. Go to **Actions** tab
2. Select workflow (e.g., "Deploy Notifications Service")
3. Click **Run workflow**
4. Choose **dev** environment
5. Click **Run workflow**

### Manual (CLI)
```bash
# Notifications
cd notifications
docker build -t ghcr.io/lumerin-protocol/proxy-notifications:v0.1.0-dev .
docker push ghcr.io/lumerin-protocol/proxy-notifications:v0.1.0-dev
aws ecs update-service --cluster bedrock-dev-use1-1 \
  --service svc-lumerin-notifications-dev-use1 --force-new-deployment

# Margin Call
cd margin-call
yarn install && yarn build
zip -r margin-call.zip node_modules/ dist/ abi/ package.json
aws lambda update-function-code --function-name margin-call-dev \
  --zip-file fileb://margin-call.zip

# Subgraph
cd subgraph-futures
yarn install && yarn prepare-dev && yarn codegen && yarn build
yarn graph deploy --node https://gphuse1.dev.lumerin.io:8020 \
  --ipfs https://gphuse1.dev.lumerin.io/ipfs marketplace
```

## 🔍 Health Checks

### Notifications Service
```bash
curl https://ntfuse1-int.dev.lumerin.io/healthcheck
```

### Margin Call Lambda
```bash
aws lambda invoke --function-name margin-call-dev \
  --invocation-type DryRun response.json
```

### Subgraph
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}' \
  https://gphuse1.dev.lumerin.io/subgraphs/name/marketplace
```

## 📊 Monitoring

### CloudWatch Logs
```bash
# Notifications
aws logs tail /ecs/lumerin-notifications-dev --follow

# Lambda
aws logs tail /aws/lambda/margin-call-dev --follow

# Graph Node
aws logs tail /ecs/lumerin-graph-node-dev --follow

# IPFS
aws logs tail /ecs/lumerin-ipfs-dev --follow
```

### ECS Service Status
```bash
aws ecs describe-services --cluster bedrock-dev-use1-1 \
  --services svc-lumerin-notifications-dev-use1
```

### Lambda Status
```bash
aws lambda get-function --function-name margin-call-dev
```

## 🔧 Common Issues

### "OIDC Authentication Failed"
```bash
# Verify OIDC provider exists
aws iam list-open-id-connect-providers

# Check IAM role trust policy
aws iam get-role --role-name github-actions-futures-dev
```

### "ECS Task Not Starting"
```bash
# Check task logs
aws logs get-log-events --log-group-name /ecs/lumerin-notifications-dev \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /ecs/lumerin-notifications-dev \
    --order-by LastEventTime --descending --max-items 1 \
    --query 'logStreams[0].logStreamName' --output text)

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### "Lambda Update Conflict"
```bash
# Wait for function to finish updating
aws lambda wait function-updated --function-name margin-call-dev

# Then retry deployment
```

### "Subgraph Not Indexing"
```bash
# Check Graph Node logs
aws logs tail /ecs/lumerin-graph-node-dev --since 5m

# Check IPFS connectivity
curl https://gphuse1.dev.lumerin.io/ipfs/api/v0/version
```

## 📋 Cheat Sheet

| Action | Command |
|--------|---------|
| Deploy all services | Push to branch with changes in respective folders |
| Check deployment status | GitHub Actions tab |
| View logs | AWS CloudWatch Logs |
| Rollback ECS | Update service with previous image tag |
| Rollback Lambda | Use AWS Console → Versions → Restore |
| Rollback Subgraph | Redeploy previous version |

## 🏷️ Version Format

- DEV: `v0.1.5-dev`
- TEST: `v0.2.0-test`
- MAIN: `v1.0.0`

Auto-increments on each deployment. Tags created for MAIN only.

## 🔐 IAM Permissions

**GitHub Role Can:**
- ✅ Update ECS services
- ✅ Update Lambda code
- ✅ Read Secrets Manager
- ✅ Publish Lambda versions

**GitHub Role Cannot:**
- ❌ Create/delete infrastructure
- ❌ Modify IAM roles
- ❌ Access EC2 instances
- ❌ Write to Secrets Manager

## 📞 Support

- Infrastructure Diagram: `INFRASTRUCTURE_DIAGRAM.md`
- Full CI/CD Guide: `CI_CD_SETUP.md`
- Deployment Plan: `DEPLOYMENT_PLAN.internal.md`
- Terraform Configs: `proxy-ui-foundation/.terragrunt/`

