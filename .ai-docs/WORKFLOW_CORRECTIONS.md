# GitHub Actions Workflow Corrections

## Summary of Changes

All three GitHub Actions workflows (`deploy-notifications.yml`, `deploy-margin-call.yml`, `deploy-subgraph.yml`) have been reviewed and corrected to ensure proper branch-to-environment mappings.

---

## ✅ **Verified Correct: Branch → Environment Mappings**

All workflows correctly map Git branches to target AWS environments:

| Git Branch | Internal ENV Variable | AWS Environment | Resources Suffix |
|------------|----------------------|-----------------|------------------|
| `dev`      | `dev`                | DEV             | `-dev`           |
| `test`     | `test`               | STG             | `-stg`           |
| `main`     | `main`               | LMN (PROD)      | `-lmn`           |

### Example from workflows:
```bash
BRANCH="${{ github.ref_name }}"
if [ "$BRANCH" == "main" ]; then
  ENV="main"       # → deploys to LMN/PROD
elif [ "$BRANCH" == "test" ]; then
  ENV="test"       # → deploys to STG
else
  ENV="dev"        # → deploys to DEV
fi
```

---

## 🔧 **Fixed: Workflow Dispatch Description**

**Before:**
```yaml
description: 'Environment to deploy to'
```

**After:**
```yaml
description: 'Target environment (dev=DEV, test=STG, main=LMN/PROD)'
```

**Impact:** Clarifies that:
- `dev` option → deploys to DEV
- `test` option → deploys to STG  
- `main` option → deploys to LMN/PROD

---

## 🔧 **Fixed: Subgraph URLs**

### DEV Environment
**Before:**
```yaml
graph_node_url=https://gphuse1.dev.lumerin.io
ipfs_url=https://gphuse1.dev.lumerin.io/ipfs
```

**After:**
```yaml
graph_node_url=https://graphidx.dev.lumerin.io
ipfs_url=https://graphidx.dev.lumerin.io/ipfs
```

### STG Environment
**Before:**
```yaml
graph_node_url=https://gphuse1.stg.lumerin.io
ipfs_url=https://gphuse1.stg.lumerin.io/ipfs
```

**After:**
```yaml
graph_node_url=https://graphidx.stg.lumerin.io
ipfs_url=https://graphidx.stg.lumerin.io/ipfs
```

### LMN (PROD) Environment
**Before:**
```yaml
graph_node_url=https://gphuse1.lumerin.io
ipfs_url=https://gphuse1.lumerin.io/ipfs
```

**After:**
```yaml
graph_node_url=https://graphidx.lumerin.io
ipfs_url=https://graphidx.lumerin.io/ipfs
```

**Rationale:** 
- All environments use standardized `graphidx` ALB name: `graphidx.{env}.lumerin.io`
- Consistent naming across DEV, STG, and LMN/PROD
- This matches the Terraform Route53 configuration in `08_subgraph_indexer.tf`

---

## ✅ **Verified Correct: Resource Naming**

All workflows correctly reference AWS resources with environment-specific names:

### Notifications Service (ECS)
```yaml
# DEV
ecs_cluster=bedrock-dev-use1-1
ecs_service=svc-lumerin-notifications-dev-use1

# STG
ecs_cluster=bedrock-stg-use1-1
ecs_service=svc-lumerin-notifications-stg-use1

# LMN
ecs_cluster=bedrock-lmn-use1-1
ecs_service=svc-lumerin-notifications-lmn-use1
```

### Margin Call Lambda
```yaml
# DEV
lambda_function=margin-call-dev

# STG
lambda_function=margin-call-stg

# LMN
lambda_function=margin-call-lmn
```

---

## ✅ **Verified Correct: Version Tagging**

All workflows correctly append environment suffixes to versions:

```bash
# dev branch
v0.1.0-dev

# test branch
v0.1.0-test

# main branch (production - no suffix)
v0.1.0
```

**Logic:**
```bash
ENV=${{ steps.env.outputs.environment }}
if [ "$ENV" != "main" ]; then
  FULL_VERSION="v${VERSION}-${ENV}"
else
  FULL_VERSION="v${VERSION}"  # Production gets clean version
fi
```

---

## ✅ **Verified Correct: IAM Role ARN References**

All workflows correctly reference environment-specific IAM role ARNs:

```yaml
# DEV
aws_role_arn=${{ secrets.AWS_ROLE_ARN_DEV }}

# STG
aws_role_arn=${{ secrets.AWS_ROLE_ARN_STG }}

# LMN
aws_role_arn=${{ secrets.AWS_ROLE_ARN_LMN }}
```

These secrets must be configured in GitHub:
- `AWS_ROLE_ARN_DEV` = `arn:aws:iam::434960487817:role/github-actions-futures-dev`
- `AWS_ROLE_ARN_STG` = (from 03-stg Terragrunt output)
- `AWS_ROLE_ARN_LMN` = (from 04-lmn Terragrunt output)

---

## 📋 **Complete Environment Configuration Matrix**

| Component | DEV | STG | LMN/PROD |
|-----------|-----|-----|----------|
| **Branch** | `dev` | `test` | `main` |
| **Domain** | `*.dev.lumerin.io` | `*.stg.lumerin.io` | `*.lumerin.io` |
| **Cluster** | `bedrock-dev-use1-1` | `bedrock-stg-use1-1` | `bedrock-lmn-use1-1` |
| **Notifications URL** | `notifyint.dev.lumerin.io` | `notifyint.stg.lumerin.io` | `notifyint.lumerin.io` |
| **Subgraph URL** | `graphidx.dev.lumerin.io` | `graphidx.stg.lumerin.io` | `graphidx.lumerin.io` |
| **Lambda** | `margin-call-dev` | `margin-call-stg` | `margin-call-lmn` |
| **Version Tag** | `v0.1.0-dev` | `v0.1.0-test` | `v0.1.0` |
| **AWS Account** | `434960487817` | (STG account) | (LMN account) |

---

## 🎯 **Deployment Flow**

### Automatic (on push):
```
Push to dev branch
  → Triggers workflow
  → Sets ENV=dev
  → Deploys to DEV AWS account
  → Tags as v0.1.0-dev

Push to test branch
  → Triggers workflow
  → Sets ENV=test
  → Deploys to STG AWS account
  → Tags as v0.1.0-test

Push to main branch
  → Triggers workflow
  → Sets ENV=main
  → Deploys to LMN/PROD AWS account
  → Tags as v0.1.0 (creates Git tag)
```

### Manual (workflow_dispatch):
```
Select environment: dev
  → Deploys to DEV
  → Uses AWS_ROLE_ARN_DEV
  → Tags as v0.1.0-dev

Select environment: test
  → Deploys to STG
  → Uses AWS_ROLE_ARN_STG
  → Tags as v0.1.0-test

Select environment: main
  → Deploys to LMN/PROD
  → Uses AWS_ROLE_ARN_LMN
  → Tags as v0.1.0
```

---

## ✅ **All Workflows Validated**

- ✅ `deploy-notifications.yml` - Correct mappings, URLs N/A (internal only)
- ✅ `deploy-margin-call.yml` - Correct mappings, URLs N/A (Lambda)
- ✅ `deploy-subgraph.yml` - Correct mappings, **URLs FIXED**

---

## 🚀 **Ready for Deployment**

All workflows are now correctly configured and ready to deploy to their respective environments:

1. ✅ Branch-to-environment mappings verified
2. ✅ Workflow dispatch descriptions clarified
3. ✅ Subgraph URLs corrected to match Terraform
4. ✅ Resource names validated
5. ✅ Version tagging logic confirmed
6. ✅ IAM role references correct

**No further changes needed - workflows are deployment-ready!**

