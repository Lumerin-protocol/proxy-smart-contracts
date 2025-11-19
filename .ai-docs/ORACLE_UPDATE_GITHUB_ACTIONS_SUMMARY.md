# Oracle Update Lambda - GitHub Actions Integration Summary

## What Was Done

### 1. Created GitHub Actions Workflow
**File:** `.github/workflows/deploy-oracle-update.yml`

A new workflow was created to build and deploy the oracle-update lambda from the `proxy-smart-contracts` repository. This workflow:

- Triggers on push to `dev`, `test`, or `main` branches when `oracle-update/**` changes
- Supports manual deployment via workflow_dispatch
- Builds the Lambda package using esbuild
- Deploys to the correct AWS account based on branch
- Publishes new Lambda versions
- Creates Git tags for production releases

**Key Features:**
- Uses Node.js 22 (matching lambda runtime)
- Semantic versioning (auto-increments patch version)
- OIDC authentication (no long-lived credentials)
- Parallel job execution for speed
- Comprehensive verification and testing

### 2. Updated IAM Permissions
**File:** `proxy-ui-foundation/.terragrunt/09_github_actions_iam.tf`

Added IAM permissions for GitHub Actions to deploy the oracle-update lambda:

**Changes Made:**
- ✅ Added new IAM policy: `github_lambda_update_oracle`
- ✅ Updated IAM role creation condition to include `var.create_oracle_lambda`
- ✅ Updated all output conditions to include oracle lambda
- ✅ Updated documentation comments to mention oracle-update

**Permissions Granted:**
```json
{
  "Action": [
    "lambda:UpdateFunctionCode",
    "lambda:GetFunction",
    "lambda:GetFunctionConfiguration",
    "lambda:PublishVersion",
    "lambda:InvokeFunction"
  ],
  "Resource": "arn:aws:lambda:*:*:function:marketplace-oracle-update"
}
```

### 3. Created Documentation
**Files:**
- `.ai-docs/ORACLE_UPDATE_DEPLOYMENT.md` - Comprehensive deployment guide
- `.ai-docs/ORACLE_UPDATE_SETUP.md` - Quick setup instructions
- `.ai-docs/ORACLE_UPDATE_GITHUB_ACTIONS_SUMMARY.md` - This file

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Repository: proxy-smart-contracts                     │
│                                                               │
│  oracle-update/                                              │
│  ├── src/                    TypeScript source               │
│  ├── index.ts                Lambda handler                  │
│  ├── package.json            Dependencies                    │
│  └── dist/                   Built artifacts                 │
│      └── index.zip           Deployment package              │
│                                                               │
│  .github/workflows/                                          │
│  └── deploy-oracle-update.yml    ← NEW WORKFLOW             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Push to dev/test/main
                          │ (with changes to oracle-update/**)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions Workflow                                      │
│                                                               │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐ │
│  │  Build   │ → │  Deploy  │ → │  Verify  │ → │ Cleanup │ │
│  └──────────┘   └──────────┘   └──────────┘   └─────────┘ │
│       │              │               │              │       │
│       │              │               │              │       │
│  • Install deps  • OIDC auth   • Dry run     • Git tag     │
│  • Run esbuild   • Update code • Check logs  • Summary     │
│  • Create zip    • Publish ver                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ OIDC AssumeRole
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ AWS IAM Role: github-actions-futures-{env}                  │
│                                                               │
│  Trust Policy:                                               │
│  • GitHub OIDC Provider                                      │
│  • Repo: Lumerin-protocol/proxy-smart-contracts             │
│  • Branch filter: dev/test/main                              │
│                                                               │
│  Permissions:                                                │
│  • lambda:UpdateFunctionCode       ← NEW POLICY             │
│  • lambda:PublishVersion                                     │
│  • lambda:InvokeFunction                                     │
│  • (also has ECS, S3, CloudFront policies)                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Update Lambda
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ AWS Lambda Function                                          │
│                                                               │
│  Name: marketplace-oracle-update                             │
│  Runtime: nodejs22.x                                         │
│  Handler: index.handler                                      │
│  Timeout: 60 seconds                                         │
│                                                               │
│  Trigger: EventBridge (every 5 minutes)                      │
│                                                               │
│  Purpose: Update BTC-USDC price on-chain                     │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Flow

### Branch → Environment Mapping

| Git Branch | Environment | AWS Account | Lambda Name |
|------------|-------------|-------------|-------------|
| `dev` | DEV | titanio-dev (434960487817) | marketplace-oracle-update |
| `test` | STG | titanio-stg (464450398935) | marketplace-oracle-update |
| `main` | LMN (PROD) | titanio-lmn (330280307271) | marketplace-oracle-update |

### Version Tagging Strategy

**Format:** `oracle-update-v{MAJOR}.{MINOR}.{PATCH}[-{ENV}]`

**Examples:**
- DEV: `oracle-update-v0.1.0-dev`
- STG: `oracle-update-v0.1.0-test`
- LMN: `oracle-update-v0.1.0` (no environment suffix)

**Auto-increment:** Patch version increments on each deployment

**Git Tags:** Only created for production (`main` branch) deployments

## Required Actions

### ⚠️ BEFORE USING THE GITHUB WORKFLOW

You must apply the Terraform changes to add IAM permissions:

```bash
# DEV
cd /Volumes/moon/repo/lab/bedrock/foundation-afs/proxy-ui-foundation/02-dev
terragrunt plan -target=aws_iam_role_policy.github_lambda_update_oracle
terragrunt apply

# STG
cd ../03-stg
terragrunt apply

# LMN
cd ../04-lmn
terragrunt apply
```

**What This Does:**
- Creates IAM policy `lambda-update-oracle`
- Grants GitHub Actions permission to update the lambda
- Enables the workflow to authenticate and deploy

**⚠️ CRITICAL:** Without this step, deployments will fail with "Access Denied" errors!

### Verification Steps

After applying Terraform:

```bash
# Verify the IAM policy was created
aws iam get-role-policy \
  --role-name github-actions-futures-dev \
  --policy-name lambda-update-oracle \
  --profile titanio-dev

# Expected output: JSON policy document with Lambda permissions
```

### Testing the Workflow

1. **Manual Test (Recommended First):**
   - Go to: https://github.com/Lumerin-protocol/proxy-smart-contracts/actions/workflows/deploy-oracle-update.yml
   - Click "Run workflow"
   - Select branch: `dev`
   - Select environment: `dev`
   - Click "Run workflow"
   - Monitor execution

2. **Automatic Test:**
   ```bash
   cd /Volumes/moon/repo/hub/proxy-smart-contracts/oracle-update
   
   # Make a trivial change to trigger deployment
   echo "# Trigger deployment" >> README.md
   
   git add .
   git commit -m "test: trigger oracle-update GitHub Actions deployment"
   git push origin dev
   ```

3. **Verify Deployment:**
   ```bash
   # Check Lambda was updated
   aws lambda get-function \
     --function-name marketplace-oracle-update \
     --profile titanio-dev \
     | jq '.Configuration.LastModified'
   
   # Check recent logs
   aws logs tail /aws/lambda/marketplace-oracle-update \
     --since 5m \
     --follow \
     --profile titanio-dev
   ```

## Comparison: GitLab vs GitHub

| Aspect | GitLab CI/CD (Current) | GitHub Actions (New) |
|--------|------------------------|----------------------|
| **Source Location** | `proxy-ui-foundation/oracle_update/` | `proxy-smart-contracts/oracle-update/` |
| **Trigger** | Push to `proxy-ui-foundation` | Push to `proxy-smart-contracts` |
| **Build Method** | Terragrunt → local-exec → yarn build | GitHub Actions → yarn build |
| **Deploy Method** | Terragrunt apply | AWS Lambda API |
| **Authentication** | AWS profile credentials | OIDC federation |
| **Runner** | GitLab Runner (node:22-alpine) | GitHub Actions (ubuntu-latest) |
| **Status** | ✅ Currently Active | ⚠️ Ready to Use (after IAM setup) |

## Migration Path

### Phase 1: Parallel Operation (Current)
- ✅ GitHub workflow created
- ✅ IAM permissions defined
- ⏳ Terraform changes need to be applied
- Both GitLab and GitHub can deploy independently

### Phase 2: Validation
1. Apply Terraform IAM changes
2. Test GitHub Actions deployment to DEV
3. Monitor for 48 hours
4. Test STG deployment
5. Test LMN deployment

### Phase 3: Cutover
1. Disable GitLab CI/CD for oracle-update
2. Make GitHub Actions the primary deployment method
3. Update team documentation

### Phase 4: Cleanup (Optional)
1. Remove oracle_update from proxy-ui-foundation
2. Remove GitLab pipeline configuration
3. Archive old deployment scripts

## Benefits of GitHub Actions Approach

### 1. **Faster Deployment**
- Direct Lambda API updates (no Terraform state refresh)
- Parallel job execution
- Cached dependencies

### 2. **Better Developer Experience**
- Deployments happen in same repo as code
- No need to maintain two repos in sync
- Workflow dispatch for manual deployments

### 3. **Improved Security**
- OIDC federation (no long-lived credentials)
- Least-privilege IAM policies
- Scoped to specific Lambda functions

### 4. **Better Observability**
- GitHub Actions UI shows deployment status
- Detailed logs for each step
- Deployment summaries with links

### 5. **Version Control**
- Git tags track production releases
- Semantic versioning
- Clear deployment history

## Troubleshooting Quick Reference

### Issue: Workflow runs but deployment fails with "Access Denied"
**Solution:** Apply Terraform changes to add IAM permissions (see "Required Actions" above)

### Issue: Build fails with "Cannot find module"
**Solution:** Check `package.json` dependencies and run `yarn install` locally to test

### Issue: Lambda invocation fails after deployment
**Solution:** Check CloudWatch logs and environment variables in Lambda console

### Issue: OIDC authentication fails
**Solution:** Verify GitHub secrets are set correctly and IAM role trust policy includes the repo

## Files Changed

### New Files (proxy-smart-contracts)
- ✅ `.github/workflows/deploy-oracle-update.yml`
- ✅ `.ai-docs/ORACLE_UPDATE_DEPLOYMENT.md`
- ✅ `.ai-docs/ORACLE_UPDATE_SETUP.md`
- ✅ `.ai-docs/ORACLE_UPDATE_GITHUB_ACTIONS_SUMMARY.md`

### Modified Files (proxy-ui-foundation)
- ✅ `.terragrunt/09_github_actions_iam.tf`
  - Added `aws_iam_role_policy.github_lambda_update_oracle`
  - Updated all conditionals to include `var.create_oracle_lambda`
  - Updated documentation comments

### Unchanged (Still Active)
- ⚠️ `proxy-ui-foundation/.gitlab-ci.yml` (oracle lambda sections)
- ⚠️ `proxy-ui-foundation/oracle_update/` (source code still here too)

**Note:** The GitLab deployment is still functional and can be removed after GitHub Actions is validated.

## Next Steps

1. **Immediate:**
   - [ ] Review the GitHub Actions workflow
   - [ ] Review IAM permission changes
   - [ ] Apply Terraform changes to DEV

2. **Testing (DEV):**
   - [ ] Run manual deployment via GitHub UI
   - [ ] Verify Lambda updated successfully
   - [ ] Check CloudWatch logs
   - [ ] Monitor for 24 hours

3. **Rollout (STG & LMN):**
   - [ ] Apply Terraform to STG
   - [ ] Deploy via GitHub Actions to STG
   - [ ] Apply Terraform to LMN
   - [ ] Deploy via GitHub Actions to LMN

4. **Validation:**
   - [ ] All environments using GitHub Actions
   - [ ] No errors or issues observed
   - [ ] Team trained on new deployment process

5. **Cleanup (Optional):**
   - [ ] Disable GitLab oracle-update jobs
   - [ ] Archive old deployment code
   - [ ] Update team documentation

## Support & Documentation

**Primary Documentation:**
- Setup Guide: `.ai-docs/ORACLE_UPDATE_SETUP.md`
- Deployment Guide: `.ai-docs/ORACLE_UPDATE_DEPLOYMENT.md`

**Key Files:**
- Workflow: `.github/workflows/deploy-oracle-update.yml`
- IAM Config: `proxy-ui-foundation/.terragrunt/09_github_actions_iam.tf`
- Lambda Config: `proxy-ui-foundation/.terragrunt/05_oracle_lambda.tf`

**Useful Commands:**
```bash
# View workflow runs
gh run list --workflow=deploy-oracle-update.yml

# Check Lambda status
aws lambda get-function --function-name marketplace-oracle-update --profile titanio-dev

# Monitor logs
aws logs tail /aws/lambda/marketplace-oracle-update --follow --profile titanio-dev
```

## Questions?

If you have questions or encounter issues:

1. Check the troubleshooting section in this document
2. Review detailed documentation in `.ai-docs/ORACLE_UPDATE_SETUP.md`
3. Check GitHub Actions workflow logs
4. Review CloudWatch Lambda logs
5. Verify IAM permissions are correctly applied

---

**Status:** ✅ Ready for Terraform apply and testing
**Last Updated:** 2025-11-19
**Author:** AI Assistant (Cursor)

