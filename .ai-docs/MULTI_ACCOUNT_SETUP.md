# Multi-Account CI/CD Setup Guide

## Environment Architecture

| GitHub Branch | Environment | AWS Account | DNS Pattern | OIDC Created |
|---------------|-------------|-------------|-------------|--------------|
| `dev` | DEV | 434960487817 (titanio-dev) | `*.dev.lumerin.io` | ✅ Done |
| `test` | STG/TEST | XXXX (titanio-stg) | `*.stg.lumerin.io` | ⬜ TODO |
| `main` | LMN/MAIN | XXXX (titanio-lmn) | `*.lumerin.io` | ⬜ TODO |

## Step-by-Step Setup

### 1. ✅ DEV Account (COMPLETED)

OIDC Provider created:
```
ARN: arn:aws:iam::434960487817:oidc-provider/token.actions.githubusercontent.com
```

**Next for DEV:**
1. Update GitHub org in IAM trust policy
2. Deploy IAM role via Terraform
3. Add `AWS_ROLE_ARN_DEV` to GitHub secrets

### 2. ⬜ STG/TEST Account (TODO)

**Commands to run in STG account:**

```bash
# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile titanio-stg
```

**Then in Terraform:**

```bash
# Apply to 03-stg folder
cd proxy-ui-foundation/03-stg
terragrunt plan
terragrunt apply

# Get the role ARN
terragrunt output github_actions_role_arn
```

**Add to GitHub:**
- Secret name: `AWS_ROLE_ARN_STG`
- Value: (ARN from terraform output)

### 3. ⬜ LMN/MAIN Account (TODO)

**Commands to run in LMN account:**

```bash
# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile titanio-lmn
```

**Then in Terraform:**

```bash
# Apply to 04-lmn folder
cd proxy-ui-foundation/04-lmn
terragrunt plan
terragrunt apply

# Get the role ARN
terragrunt output github_actions_role_arn
```

**Add to GitHub:**
- Secret name: `AWS_ROLE_ARN_LMN`
- Value: (ARN from terraform output)

---

## DNS Endpoints by Environment

### DEV (dev branch)
- **Notifications**: `notifyint.dev.lumerin.io` (internal)
- **Subgraph**: `graphidx.dev.lumerin.io` (public)
- **Margin Call**: Runs in VPC (no public endpoint)

### STG (test branch)
- **Notifications**: `notifyint.stg.lumerin.io` (internal)
- **Subgraph**: `graphidx.stg.lumerin.io` (public)
- **Margin Call**: Runs in VPC (no public endpoint)

### LMN (main branch)
- **Notifications**: `notifyint.lumerin.io` (internal)
- **Subgraph**: `graphidx.lumerin.io` (public)
- **Margin Call**: Runs in VPC (no public endpoint)

---

## GitHub Secrets Summary

Once all accounts are set up, you'll have these secrets in GitHub:

| Secret Name | Purpose | Account |
|-------------|---------|---------|
| `AWS_ROLE_ARN_DEV` | DEV deployments | titanio-dev (434960487817) |
| `AWS_ROLE_ARN_STG` | STG/TEST deployments | titanio-stg (XXXX) |
| `AWS_ROLE_ARN_LMN` | MAIN/PROD deployments | titanio-lmn (XXXX) |

---

## Deployment Flow

### Automatic Deployments

```
Push to dev branch → GitHub Actions → DEV AWS Account → *.dev.lumerin.io
Push to test branch → GitHub Actions → STG AWS Account → *.stg.lumerin.io  
Push to main branch → GitHub Actions → LMN AWS Account → *.lumerin.io
```

### Resource Naming Convention

**ECS Services:**
- DEV: `svc-lumerin-{service}-dev-use1`
- STG: `svc-lumerin-{service}-stg-use1`
- LMN: `svc-lumerin-{service}-lmn-use1`

**Lambda Functions:**
- DEV: `margin-call-dev`
- STG: `margin-call-stg`
- LMN: `margin-call-lmn`

**RDS Instances:**
- DEV: `notifications-dev-use1`, `subgraph-dev-use1`
- STG: `notifications-stg-use1`, `subgraph-stg-use1`
- LMN: `notifications-lmn-use1`, `subgraph-lmn-use1`

---

## IAM Role Trust Policy

**Critical**: Update line 37 in `09_github_actions_iam.tf` before deploying to any account:

```hcl
StringLike = {
  # Replace YOUR-ORG with actual GitHub organization
  "token.actions.githubusercontent.com:sub" = "repo:YOUR-ORG/proxy-smart-contracts:*"
}
```

Example:
```hcl
"token.actions.githubusercontent.com:sub" = "repo:lumerin-protocol/proxy-smart-contracts:*"
```

This allows **any branch** in that repo to deploy. For more security, you can restrict by branch:

```hcl
# Only allow dev branch (for DEV account)
"token.actions.githubusercontent.com:sub" = "repo:lumerin-protocol/proxy-smart-contracts:ref:refs/heads/dev"

# Only allow test branch (for STG account)
"token.actions.githubusercontent.com:sub" = "repo:lumerin-protocol/proxy-smart-contracts:ref:refs/heads/test"

# Only allow main branch (for LMN account)
"token.actions.githubusercontent.com:sub" = "repo:lumerin-protocol/proxy-smart-contracts:ref:refs/heads/main"
```

**Recommended**: Use branch-specific restrictions in STG and LMN for production safety.

---

## Workflow Alignment

The GitHub Actions workflows now correctly map:

| Workflow | Branch Trigger | Environment | DNS |
|----------|---------------|-------------|-----|
| deploy-notifications.yml | dev/test/main | dev/test/main | dev/stg/prod URLs |
| deploy-margin-call.yml | dev/test/main | dev/test/main | dev/stg/prod accounts |
| deploy-subgraph.yml | dev/test/main | dev/test/main | dev/stg/prod Graph Nodes |

**Key fixes made:**
- ✅ Changed `.test.lumerin.io` → `.stg.lumerin.io`
- ✅ Changed `AWS_ROLE_ARN_TEST` → `AWS_ROLE_ARN_STG`
- ✅ Changed resource names from `-test-` → `-stg-`
- ✅ Added `yarn prepare-stg` for subgraph

---

## Security Per Environment

### DEV (Least Restrictive)
- Open OIDC trust (any branch)
- Fast deployments
- Shared secrets OK

### STG (Moderate)
- Restricted to `test` branch only
- Manual approval gates (optional)
- Separate secrets

### LMN (Most Restrictive)
- Restricted to `main` branch only
- **Required**: Manual approval gates
- **Required**: Protected branch rules
- Separate secrets
- Version tags created

---

## Testing the Setup

### 1. Test DEV (once IAM role deployed)

```bash
# Push a small change to dev branch
cd proxy-smart-contracts
git checkout dev
echo "# Test" >> notifications/README.md
git add notifications/README.md
git commit -m "test: trigger DEV deployment"
git push origin dev

# Watch in GitHub Actions tab
# Should deploy to: svc-lumerin-notifications-dev-use1
```

### 2. Test STG (once STG account ready)

```bash
# Push to test branch
git checkout test
git merge dev
git push origin test

# Should deploy to: svc-lumerin-notifications-stg-use1
```

### 3. Test LMN (once LMN account ready)

```bash
# Push to main branch (with approval)
git checkout main
git merge test
git push origin main

# Should deploy to: svc-lumerin-notifications-lmn-use1
# Creates git tag: notifications-v1.0.0
```

---

## Next Steps for DEV

1. ✅ OIDC provider created
2. ⬜ Update GitHub org in `09_github_actions_iam.tf`
3. ⬜ Deploy IAM role: `cd 02-dev && terragrunt apply`
4. ⬜ Get role ARN: `terragrunt output github_actions_role_arn`
5. ⬜ Add to GitHub: Settings → Secrets → `AWS_ROLE_ARN_DEV`
6. ⬜ Test deployment: Push to dev branch

---

## Troubleshooting Multi-Account

### OIDC Provider Exists Error
If you get "EntityAlreadyExists" when creating the provider:

```bash
# List existing providers
aws iam list-open-id-connect-providers --profile titanio-dev

# If it exists, you can skip creation and proceed to IAM role deployment
```

### Wrong Account Deployment
If deployment goes to wrong account:

1. Check GitHub secret matches intended account
2. Verify branch trigger matches workflow
3. Check Terraform was applied in correct account folder

### Access Denied Errors
If GitHub Actions gets access denied:

1. Verify IAM role trust policy has correct repo name
2. Check OIDC provider exists in that account
3. Verify IAM policies grant necessary permissions

---

## Cost Summary (Per Environment)

| Service | DEV | STG | LMN | Total |
|---------|-----|-----|-----|-------|
| Notifications | $50 | $50 | $50 | $150 |
| Margin Call | $2 | $2 | $5 | $9 |
| Subgraph | $101 | $101 | $250 | $452 |
| **Total/month** | **$153** | **$153** | **$305** | **$611** |

Note: LMN costs more due to production sizing and redundancy.

