# GitHub Actions Deployment Steps

## Overview

Now that the Terragrunt infrastructure is deployed in DEV, follow these steps to deploy the application code via GitHub Actions.

---

## 📋 **Step 1: Configure GitHub Repository Secrets**

### Add AWS IAM Role ARN for DEV

1. **Navigate to GitHub Secrets:**
   ```
   https://github.com/lumerin-protocol/proxy-smart-contracts/settings/secrets/actions
   ```

2. **Add New Secret:**
   - Click **"New repository secret"**
   - **Name:** `AWS_ROLE_ARN_DEV`
   - **Value:** `arn:aws:iam::434960487817:role/github-actions-futures-dev`
   - Click **"Add secret"**

### (Later) For STG and LMN:
When you deploy to STG/LMN, you'll also need:
- `AWS_ROLE_ARN_STG` - from 03-stg Terragrunt outputs
- `AWS_ROLE_ARN_LMN` - from 04-lmn Terragrunt outputs

---

## ✅ **Step 2: Verify GitHub OIDC Provider Exists**

Check if the GitHub OIDC provider is already registered in AWS:

```bash
aws iam list-open-id-connect-providers \
  --region us-east-1 \
  | grep token.actions.githubusercontent.com
```

**Expected output:**
```
"Arn": "arn:aws:iam::434960487817:oidc-provider/token.actions.githubusercontent.com"
```

### If NOT found, create it:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --region us-east-1
```

---

## 🚀 **Step 3: Deploy Services via GitHub Actions**

You have **3 deployment workflows** available:

### **Option A: Manual Deployment (Recommended for First Deploy)**

Deploy each service manually using workflow_dispatch:

#### 1. **Notifications Service:**
```
https://github.com/lumerin-protocol/proxy-smart-contracts/actions/workflows/deploy-notifications.yml
```
- Click **"Run workflow"**
- Select **branch:** `dev`
- Select **environment:** `dev`
- Click **"Run workflow"**

#### 2. **Margin Call Lambda:**
```
https://github.com/lumerin-protocol/proxy-smart-contracts/actions/workflows/deploy-margin-call.yml
```
- Click **"Run workflow"**
- Select **branch:** `dev`
- Select **environment:** `dev`
- Click **"Run workflow"**

#### 3. **Subgraph Indexer:**
```
https://github.com/lumerin-protocol/proxy-smart-contracts/actions/workflows/deploy-subgraph.yml
```
- Click **"Run workflow"**
- Select **branch:** `dev`
- Select **environment:** `dev`
- Click **"Run workflow"**

---

### **Option B: Automatic Deployment via Push**

The workflows automatically trigger on push to specific branches:

```bash
# Make a small change to trigger deployment
cd /path/to/proxy-smart-contracts

# For notifications
touch notifications/.trigger
git add notifications/.trigger
git commit -m "trigger: deploy notifications to dev"
git push origin dev

# For margin-call
touch margin-call/.trigger
git add margin-call/.trigger
git commit -m "trigger: deploy margin-call to dev"
git push origin dev

# For subgraph
touch subgraph-futures/.trigger
git add subgraph-futures/.trigger
git commit -m "trigger: deploy subgraph to dev"
git push origin dev
```

---

## 🔍 **Step 4: Monitor Deployments**

### **Watch GitHub Actions:**
```
https://github.com/lumerin-protocol/proxy-smart-contracts/actions
```

Each workflow will:
1. ✅ Build Docker image (notifications/subgraph) or zip (margin-call)
2. ✅ Push to GHCR or Lambda
3. ✅ Assume AWS IAM role via OIDC
4. ✅ Update ECS service or Lambda function
5. ✅ Wait for stabilization
6. ✅ Create version tag (if deploying to main)

### **Check AWS Deployment Status:**

#### For ECS Services (notifications, subgraph):
```bash
# Notifications
aws ecs describe-services \
  --cluster bedrock-dev-use1-1 \
  --services svc-lumerin-notifications-dev-use1 \
  --region us-east-1

# Subgraph Graph Node
aws ecs describe-services \
  --cluster bedrock-dev-use1-1 \
  --services svc-lumerin-subgraph-graph-dev-use1 \
  --region us-east-1

# Subgraph IPFS
aws ecs describe-services \
  --cluster bedrock-dev-use1-1 \
  --services svc-lumerin-subgraph-ipfs-dev-use1 \
  --region us-east-1
```

#### For Lambda (margin-call):
```bash
aws lambda get-function \
  --function-name margin-call-dev \
  --region us-east-1
```

---

## 🧪 **Step 5: Verify Deployments**

### **Notifications Service:**
```bash
# Internal ALB - use VPN or bastion
curl https://notifyint.dev.lumerin.io/health
```

### **Subgraph Indexer:**
```bash
# External ALB
curl https://graphidx.dev.lumerin.io/health

# Query subgraph
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'
```

### **Margin Call Lambda:**
```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/margin-call-dev --follow --region us-east-1
```

---

## 📦 **What Gets Deployed**

### **Notifications Service** (ECS on Fargate)
- **Image:** `ghcr.io/lumerin-protocol/proxy-notifications:v0.1.0-dev`
- **Cluster:** `bedrock-dev-use1-1`
- **Service:** `svc-lumerin-notifications-dev-use1`
- **URL:** `https://notifyint.dev.lumerin.io` (internal only)

### **Margin Call Lambda**
- **Function:** `margin-call-dev`
- **Runtime:** Node.js 22.x
- **Trigger:** EventBridge (every 15 minutes)
- **Timeout:** 300 seconds

### **Subgraph Indexer** (2 ECS services)
- **Graph Node:**
  - Image: `ghcr.io/lumerin-protocol/proxy-subgraph-graph:v0.1.0-dev`
  - Service: `svc-lumerin-subgraph-graph-dev-use1`
  - URL: `https://graphidx.dev.lumerin.io`
  
- **IPFS:**
  - Image: `ghcr.io/lumerin-protocol/proxy-subgraph-ipfs:v0.1.0-dev`
  - Service: `svc-lumerin-subgraph-ipfs-dev-use1`
  - Internal only (EFS-backed storage)

---

## 🐛 **Troubleshooting**

### **Issue: OIDC Authentication Failed**
```
Error: Not authorized to perform sts:AssumeRoleWithWebIdentity
```

**Solution:**
1. Verify the OIDC provider exists in AWS
2. Check that the IAM role trust policy allows the correct GitHub repo/branch
3. Verify the secret `AWS_ROLE_ARN_DEV` is set correctly

### **Issue: ECS Service Won't Start**
```
Error: Container health check failed
```

**Solution:**
1. Check CloudWatch logs for the task:
   ```bash
   aws logs tail /aws/ecs/bedrock-dev-lumerin-marketplace --follow
   ```
2. Verify environment variables are set correctly
3. Check security group rules allow necessary traffic

### **Issue: Lambda Deployment Failed**
```
Error: Could not update function code
```

**Solution:**
1. Check Lambda function exists in AWS
2. Verify IAM role has permission to update Lambda
3. Check Lambda code size (< 50 MB for direct upload)

---

## 🎯 **Next Steps After Successful Deployment**

1. ✅ **Test each service endpoint**
2. ✅ **Verify database connections** (check RDS connections)
3. ✅ **Monitor CloudWatch logs** for errors
4. ✅ **Test margin call lambda** (check EventBridge trigger)
5. ✅ **Deploy subgraph definition** (see subgraph-futures README)
6. ✅ **Test notification bot** (send test Telegram message)

---

## 📚 **Related Documentation**

- [CI/CD Setup Guide](./.ai-docs/CI_CD_SETUP.md)
- [Infrastructure Diagram](./.ai-docs/INFRASTRUCTURE_DIAGRAM.md)
- [Deployment Guide (Terragrunt)](../../lab/bedrock/foundation-afs/proxy-ui-foundation/.ai-docs/DEPLOYMENT_GUIDE.md)

---

## 🔄 **Deployment Order**

**Recommended order for first-time deployment:**

1. **Subgraph Indexer** (provides data to other services)
   - Graph Node + IPFS
   - Wait for services to stabilize
   - Deploy subgraph manifest

2. **Notifications Service** (used by margin call)
   - Wait for database connection
   - Verify Telegram bot token

3. **Margin Call Lambda** (depends on subgraph + notifications)
   - Verify it can reach both services
   - Test EventBridge trigger

---

**Good luck with your deployment! 🚀**

