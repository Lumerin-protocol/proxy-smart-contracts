# CI/CD Setup Guide - Futures Marketplace

This guide explains how to set up GitHub Actions for automated deployment of the Futures Marketplace services to AWS.

## Architecture Overview

```
GitHub Repository (proxy-smart-contracts)
  ↓ Push to branch (dev/test/main)
  ↓
GitHub Actions Workflow
  ↓ OIDC Authentication
  ↓
AWS IAM Role (github-actions-futures-{env})
  ↓ Least-privilege policies
  ↓
Deploy to AWS Resources:
  • Notifications Service → ECS (GHCR image)
  • Margin Call Lambda → Lambda Function (zip file)
  • Subgraph → Graph Node (via HTTP API)
```

## Prerequisites

### 1. AWS OIDC Provider Setup

First, create the GitHub OIDC provider in AWS (one-time setup per account):

```bash
# DEV account
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile titanio-dev

# TEST account (when ready)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile titanio-test

# MAIN/LMN account (when ready)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile titanio-lmn
```

### 2. Deploy IAM Role via Terraform

The IAM role and policies are already defined in:
`proxy-ui-foundation/.terragrunt/09_github_actions_iam.tf`

Deploy it:

```bash
cd /Volumes/moon/repo/lab/bedrock/foundation-afs/proxy-ui-foundation/02-dev
terragrunt apply
```

After deployment, get the role ARN:

```bash
terragrunt output github_actions_role_arn
# Output: arn:aws:iam::434960487817:role/github-actions-futures-dev
```

### 3. Update GitHub Repository Settings

**IMPORTANT:** Update the IAM role trust policy in `09_github_actions_iam.tf` to match your GitHub organization/repo:

```hcl
# Line 37 in 09_github_actions_iam.tf
"token.actions.githubusercontent.com:sub" = "repo:YOUR-ORG/proxy-smart-contracts:*"
```

Replace `YOUR-ORG` with your actual GitHub organization name (e.g., `lumerin-protocol`).

Then re-apply:
```bash
terragrunt apply
```

### 4. Configure GitHub Secrets

In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add:

#### Repository Secrets

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AWS_ROLE_ARN_DEV` | `arn:aws:iam::434960487817:role/github-actions-futures-dev` | IAM role for DEV |
| `AWS_ROLE_ARN_TEST` | `arn:aws:iam::ACCOUNT_ID:role/github-actions-futures-test` | IAM role for TEST |
| `AWS_ROLE_ARN_LMN` | `arn:aws:iam::ACCOUNT_ID:role/github-actions-futures-lmn` | IAM role for MAIN |

**Note:** Get the exact ARN from Terraform outputs after applying.

## Workflow Files

Three GitHub Actions workflows have been created:

### 1. Notifications Service
**File:** `.github/workflows/deploy-notifications.yml`

**Triggers:**
- Push to `dev`, `test`, or `main` branches with changes in `notifications/**`
- Manual workflow dispatch

**Process:**
1. Builds Docker image from `notifications/` directory
2. Tags with semantic version (e.g., `v0.1.5-dev`)
3. Pushes to GitHub Container Registry (GHCR)
4. Updates ECS service with new image
5. Waits for service to stabilize

### 2. Margin Call Lambda
**File:** `.github/workflows/deploy-margin-call.yml`

**Triggers:**
- Push to `dev`, `test`, or `main` branches with changes in `margin-call/**`
- Manual workflow dispatch

**Process:**
1. Installs dependencies with yarn
2. Builds TypeScript to JavaScript
3. Creates Lambda deployment zip (includes node_modules and ABI files)
4. Uploads to Lambda function
5. Publishes new version
6. Tests invocation

### 3. Subgraph
**File:** `.github/workflows/deploy-subgraph.yml`

**Triggers:**
- Push to `dev`, `test`, or `main` branches with changes in `subgraph-futures/**`
- Manual workflow dispatch

**Process:**
1. Installs dependencies with yarn
2. Generates AssemblyScript types (`yarn codegen`)
3. Builds subgraph (`yarn build`)
4. Deploys to Graph Node via HTTP API
5. Verifies indexing is healthy

## Semantic Versioning

All services use semantic versioning with environment suffixes:

- **DEV**: `v0.1.5-dev`, `v0.1.6-dev`, etc.
- **TEST**: `v0.2.0-test`, `v0.2.1-test`, etc.
- **MAIN**: `v1.0.0`, `v1.0.1`, etc. (no suffix)

Versions auto-increment on each deployment. Git tags are created for MAIN releases only.

## IAM Permissions Summary

The GitHub Actions IAM role has **least-privilege** access:

### Notifications Service
- ✅ `ecs:UpdateService` - Update ECS service with new image
- ✅ `ecs:DescribeServices` - Check service status
- ✅ `ecs:RegisterTaskDefinition` - Register new task definitions
- ✅ `iam:PassRole` - Pass execution role to ECS tasks

### Margin Call Lambda
- ✅ `lambda:UpdateFunctionCode` - Upload new code
- ✅ `lambda:GetFunction` - Read function config
- ✅ `lambda:PublishVersion` - Publish new versions
- ✅ `lambda:UpdateFunctionConfiguration` - Update environment variables

### Subgraph
- ✅ `ecs:DescribeServices` - Check Graph Node service status
- ✅ `ecs:UpdateService` - Restart service if needed

### Shared
- ✅ `secretsmanager:GetSecretValue` - Read deployment secrets
- ❌ No write access to secrets
- ❌ No access to other AWS services
- ❌ No EC2, S3, or IAM modification permissions

## Manual Deployment

### Notifications Service

```bash
# Build and push manually
cd notifications
docker build -t ghcr.io/lumerin-protocol/proxy-notifications:v0.1.0-dev .
docker push ghcr.io/lumerin-protocol/proxy-notifications:v0.1.0-dev

# Update ECS service
aws ecs update-service \
  --cluster bedrock-dev-use1-1 \
  --service svc-lumerin-notifications-dev-use1 \
  --force-new-deployment \
  --profile titanio-dev
```

### Margin Call Lambda

```bash
# Build and package
cd margin-call
yarn install --frozen-lockfile
yarn build

# Create zip
zip -r margin-call.zip node_modules/ dist/ abi/ package.json

# Upload to Lambda
aws lambda update-function-code \
  --function-name margin-call-dev \
  --zip-file fileb://margin-call.zip \
  --profile titanio-dev
```

### Subgraph

```bash
# Build subgraph
cd subgraph-futures
yarn install
yarn prepare-dev
yarn codegen
yarn build

# Deploy to Graph Node
yarn graph create --node https://gphuse1.dev.lumerin.io:8020 marketplace
yarn graph deploy --node https://gphuse1.dev.lumerin.io:8020 \
  --ipfs https://gphuse1.dev.lumerin.io/ipfs \
  --version-label v0.1.0-dev \
  marketplace
```

## Workflow Triggers

### Automatic (on push)
- **notifications/**: Any change triggers notification deployment
- **margin-call/**: Any change triggers Lambda deployment
- **subgraph-futures/**: Any change triggers subgraph deployment

### Manual (workflow_dispatch)
1. Go to **Actions** tab in GitHub
2. Select the workflow (e.g., "Deploy Notifications Service")
3. Click **Run workflow**
4. Choose environment (dev/test/main)
5. Click **Run workflow**

## Monitoring Deployments

### GitHub Actions UI
- View workflow runs in **Actions** tab
- Check deployment summary in each run
- Download logs for debugging

### AWS CloudWatch
- Notifications: `/ecs/lumerin-notifications-{env}`
- Margin Call: `/aws/lambda/margin-call-{env}`
- Graph Node: `/ecs/lumerin-graph-node-{env}`
- IPFS: `/ecs/lumerin-ipfs-{env}`

### Service Health Checks

```bash
# Notifications service
curl https://ntfuse1-int.dev.lumerin.io/healthcheck

# Subgraph
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}' \
  https://gphuse1.dev.lumerin.io/subgraphs/name/marketplace

# Lambda (check last execution)
aws lambda get-function \
  --function-name margin-call-dev \
  --profile titanio-dev
```

## Troubleshooting

### OIDC Authentication Failed
**Error:** "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Solution:**
1. Verify OIDC provider exists in AWS account
2. Check IAM role trust policy matches your GitHub org/repo
3. Ensure GitHub Actions has `id-token: write` permission

### ECS Deployment Timeout
**Error:** "Service did not stabilize"

**Solution:**
1. Check ECS task logs in CloudWatch
2. Verify Docker image exists in GHCR
3. Check security groups allow necessary traffic
4. Verify task role has permissions to pull from GHCR

### Lambda Deployment Failed
**Error:** "ResourceConflictException: The operation cannot be performed at this time"

**Solution:**
1. Wait for previous update to complete
2. Check Lambda function status in AWS console
3. Retry deployment after function is updated

### Subgraph Deployment Failed
**Error:** "Connection refused to Graph Node"

**Solution:**
1. Verify Graph Node is running: `aws ecs describe-services`
2. Check ALB health checks are passing
3. Verify DNS resolution: `nslookup gphuse1.dev.lumerin.io`
4. Check security groups allow port 8020 (admin) and 8000 (HTTP)

## Security Best Practices

✅ **DO:**
- Use OIDC for authentication (no long-lived credentials)
- Apply least-privilege IAM policies
- Use GitHub environment protection rules
- Review workflow logs regularly
- Rotate secrets periodically

❌ **DON'T:**
- Store AWS access keys in GitHub secrets
- Grant broad IAM permissions
- Deploy to production without approval
- Skip security reviews for workflow changes

## Next Steps

1. ✅ Deploy IAM role via Terraform
2. ✅ Configure GitHub repository secrets
3. ✅ Update IAM trust policy with your GitHub org
4. ⬜ Test manual workflow dispatch in DEV
5. ⬜ Push code change to trigger automatic deployment
6. ⬜ Set up GitHub environment protection for TEST/MAIN
7. ⬜ Configure Slack/Discord notifications for deployments

## References

- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM Roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)
- [The Graph Deployment](https://thegraph.com/docs/en/deploying/deploying-a-subgraph-to-hosted/)
- [ECS Task Definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html)

