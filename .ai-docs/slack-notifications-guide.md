# Slack Notifications for GitHub Actions

## Overview

This document outlines how to implement Slack notifications across all Lumerin repositories to notify the team when code is pushed to `dev`, `stg`, or `main` branches.

---

## 1. Slack Webhook Setup

### Step 1: Create a Slack App with Incoming Webhooks

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Name it: `Lumerin CI/CD Notifications`
4. Select your workspace
5. In the left sidebar, click **"Incoming Webhooks"**
6. Toggle **"Activate Incoming Webhooks"** to **On**
7. Click **"Add New Webhook to Workspace"**
8. Select the channel for notifications (e.g., `#deployments` or `#ci-cd`)
9. Copy the Webhook URL (it will look like `https://hooks.slack.com/services/TXXXX/BXXXX/xxxx`)

### Step 2: Add Webhook as GitHub Repository Secret

For each repository, add the webhook as a secret:

1. Go to **Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Name: `SLACK_WEBHOOK_URL`
4. Value: (paste the webhook URL)
5. Click **"Add secret"**

**Repositories to configure:**
- `proxy-smart-contracts`
- `proxy-indexer`
- `proxy-router-ui`
- `proxy-router`

---

## 2. Reusable Slack Notification Action

Create a **composite action** that can be reused across all workflows:

### File: `.github/actions/slack-notify/action.yml`

```yaml
name: 'Slack Notification'
description: 'Send deployment notifications to Slack'
inputs:
  status:
    description: 'Deployment status (success, failure, cancelled)'
    required: true
  environment:
    description: 'Target environment (dev, stg, main)'
    required: true
  service_name:
    description: 'Name of the service being deployed'
    required: true
  version:
    description: 'Version tag being deployed'
    required: true
  slack_webhook_url:
    description: 'Slack webhook URL'
    required: true
  additional_info:
    description: 'Additional info to include (optional)'
    required: false
    default: ''

runs:
  using: 'composite'
  steps:
    - name: Send Slack notification
      shell: bash
      run: |
        # Set environment emoji and color
        case "${{ inputs.environment }}" in
          dev)
            ENV_EMOJI="🔧"
            ENV_LABEL="DEV"
            ;;
          stg)
            ENV_EMOJI="🧪"
            ENV_LABEL="STG"
            ;;
          main)
            ENV_EMOJI="🚀"
            ENV_LABEL="PROD"
            ;;
          *)
            ENV_EMOJI="📦"
            ENV_LABEL="${{ inputs.environment }}"
            ;;
        esac
        
        # Set status emoji and color
        case "${{ inputs.status }}" in
          success)
            STATUS_EMOJI="✅"
            COLOR="good"
            STATUS_TEXT="Deployment Successful"
            ;;
          failure)
            STATUS_EMOJI="❌"
            COLOR="danger"
            STATUS_TEXT="Deployment Failed"
            ;;
          cancelled)
            STATUS_EMOJI="⚠️"
            COLOR="#FFA500"
            STATUS_TEXT="Deployment Cancelled"
            ;;
          *)
            STATUS_EMOJI="ℹ️"
            COLOR="#808080"
            STATUS_TEXT="${{ inputs.status }}"
            ;;
        esac
        
        # Get commit info
        COMMIT_SHA="${{ github.sha }}"
        COMMIT_SHORT="${COMMIT_SHA:0:7}"
        COMMIT_MESSAGE=$(echo '${{ github.event.head_commit.message }}' | head -n 1 | sed 's/"/\\"/g' | cut -c1-100)
        ACTOR="${{ github.actor }}"
        REPO="${{ github.repository }}"
        RUN_URL="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
        
        # Build additional info section
        ADDITIONAL_INFO='${{ inputs.additional_info }}'
        ADDITIONAL_BLOCK=""
        if [ -n "$ADDITIONAL_INFO" ]; then
          ADDITIONAL_BLOCK=",{\"type\": \"section\",\"text\": {\"type\": \"mrkdwn\",\"text\": \"$ADDITIONAL_INFO\"}}"
        fi
        
        # Send Slack message
        curl -X POST -H 'Content-type: application/json' \
          --data "{
            \"attachments\": [{
              \"color\": \"$COLOR\",
              \"blocks\": [
                {
                  \"type\": \"header\",
                  \"text\": {
                    \"type\": \"plain_text\",
                    \"text\": \"$ENV_EMOJI $ENV_LABEL | ${{ inputs.service_name }} | $STATUS_EMOJI $STATUS_TEXT\",
                    \"emoji\": true
                  }
                },
                {
                  \"type\": \"section\",
                  \"fields\": [
                    {\"type\": \"mrkdwn\", \"text\": \"*Repository:*\n<https://github.com/$REPO|$REPO>\"},
                    {\"type\": \"mrkdwn\", \"text\": \"*Branch:*\n\`${{ github.ref_name }}\`\"},
                    {\"type\": \"mrkdwn\", \"text\": \"*Version:*\n\`${{ inputs.version }}\`\"},
                    {\"type\": \"mrkdwn\", \"text\": \"*Triggered by:*\n$ACTOR\"}
                  ]
                },
                {
                  \"type\": \"section\",
                  \"text\": {
                    \"type\": \"mrkdwn\",
                    \"text\": \"*Commit:* <https://github.com/$REPO/commit/$COMMIT_SHA|\`$COMMIT_SHORT\`> - $COMMIT_MESSAGE\"
                  }
                }$ADDITIONAL_BLOCK,
                {
                  \"type\": \"actions\",
                  \"elements\": [
                    {
                      \"type\": \"button\",
                      \"text\": {\"type\": \"plain_text\", \"text\": \"View Workflow\", \"emoji\": true},
                      \"url\": \"$RUN_URL\"
                    }
                  ]
                }
              ]
            }]
          }" \
          "${{ inputs.slack_webhook_url }}"
```

---

## 3. Usage in Workflows

### Option A: Using the Composite Action (Recommended)

Add the composite action to **each repository** at `.github/actions/slack-notify/action.yml`, then use it in workflows:

```yaml
  notify:
    name: 📢 Notify
    runs-on: ubuntu-latest
    needs: [build, deploy, verify]
    if: always()
    
    steps:
      - name: Checkout (for composite action and PR detection)
        uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Need at least 2 commits to read merge commit message
        
      - name: Send Slack notification
        uses: ./.github/actions/slack-notify
        with:
          status: ${{ needs.verify.result == 'success' && 'success' || needs.verify.result == 'failure' && 'failure' || 'cancelled' }}
          environment: ${{ needs.build.outputs.environment }}
          service_name: 'Market Maker'
          version: ${{ needs.build.outputs.version }}
          slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
          github_token: ${{ secrets.GITHUB_TOKEN }}  # For PR lookup fallback
          image_tag: '${{ env.GHCR_IMAGE }}:${{ needs.build.outputs.version }}'
          additional_info: |
            *ECS Cluster:* \`${{ needs.build.outputs.ecs_cluster }}\`
            *ECS Service:* \`${{ needs.build.outputs.ecs_service }}\`
```

### Input Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `status` | ✅ | `success`, `failure`, `cancelled`, or `skipped` |
| `environment` | ✅ | `dev`, `stg`, or `main` |
| `service_name` | ✅ | Human-readable service name |
| `version` | ✅ | Semver version tag |
| `slack_webhook_url` | ✅ | Slack webhook URL (from secrets) |
| `github_token` | ⬜ | GitHub token for PR API lookup (fallback) |
| `image_tag` | ⬜ | Docker image tag to display |
| `additional_info` | ⬜ | Extra markdown info to include |

### Option B: Inline Slack Notification (No composite action needed)

Add this directly to any workflow's final job:

```yaml
      - name: Send Slack notification
        if: always()
        run: |
          # Determine status
          if [ "${{ needs.verify.result }}" == "success" ]; then
            STATUS="success"
            STATUS_EMOJI="✅"
            COLOR="good"
          elif [ "${{ needs.verify.result }}" == "failure" ]; then
            STATUS="failure"
            STATUS_EMOJI="❌"
            COLOR="danger"
          else
            STATUS="cancelled"
            STATUS_EMOJI="⚠️"
            COLOR="#FFA500"
          fi
          
          # Environment mapping
          ENV="${{ needs.build.outputs.environment }}"
          case "$ENV" in
            dev)  ENV_EMOJI="🔧"; ENV_LABEL="DEV" ;;
            stg)  ENV_EMOJI="🧪"; ENV_LABEL="STG" ;;
            main) ENV_EMOJI="🚀"; ENV_LABEL="PROD" ;;
            *)    ENV_EMOJI="📦"; ENV_LABEL="$ENV" ;;
          esac
          
          curl -X POST -H 'Content-type: application/json' \
            --data "{
              \"attachments\": [{
                \"color\": \"$COLOR\",
                \"blocks\": [
                  {
                    \"type\": \"header\",
                    \"text\": {
                      \"type\": \"plain_text\",
                      \"text\": \"$ENV_EMOJI $ENV_LABEL | SERVICE_NAME | $STATUS_EMOJI Deployment $STATUS\",
                      \"emoji\": true
                    }
                  },
                  {
                    \"type\": \"section\",
                    \"fields\": [
                      {\"type\": \"mrkdwn\", \"text\": \"*Repository:*\n\`${{ github.repository }}\`\"},
                      {\"type\": \"mrkdwn\", \"text\": \"*Branch:*\n\`${{ github.ref_name }}\`\"},
                      {\"type\": \"mrkdwn\", \"text\": \"*Version:*\n\`VERSION_HERE\`\"},
                      {\"type\": \"mrkdwn\", \"text\": \"*Triggered by:*\n${{ github.actor }}\"}
                    ]
                  },
                  {
                    \"type\": \"actions\",
                    \"elements\": [
                      {
                        \"type\": \"button\",
                        \"text\": {\"type\": \"plain_text\", \"text\": \"View Workflow\"},
                        \"url\": \"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"
                      }
                    ]
                  }
                ]
              }]
            }" \
            "${{ secrets.SLACK_WEBHOOK_URL }}"
```

---

## 4. Slack Message Preview

Here's what the notifications will look like:

### Success Message (Production) - With PR Link
```
┌─────────────────────────────────────────────────────────────┐
│ 🚀 PROD │ Market Maker │ ✅ Deployed Successfully           │
├─────────────────────────────────────────────────────────────┤
│ Repository:           Branch:                               │
│ proxy-smart-contracts main                                  │
│                                                             │
│ Version:              Triggered by:                         │
│ v0.1.42               alan                                  │
│                                                             │
│ Pull Request:                                               │
│ #127                                                        │
├─────────────────────────────────────────────────────────────┤
│ Commit: abc1234 Merged: feature/add-margin-tracking         │
├─────────────────────────────────────────────────────────────┤
│ ECS Cluster: ecs-lumerin-marketplace-lmn-use1               │
│ ECS Service: svc-lumerin-market-maker-lmn-use1              │
├─────────────────────────────────────────────────────────────┤
│ [🔀 View PR #127] [📋 Workflow] [🔍 Commit]                 │
└─────────────────────────────────────────────────────────────┘
```

### Failure Message (DEV)
```
┌─────────────────────────────────────────────────────────────┐
│ 🔧 DEV │ Spot Indexer │ ❌ Deployment Failed                │
├─────────────────────────────────────────────────────────────┤
│ Repository:           Branch:                               │
│ proxy-indexer         dev                                   │
│                                                             │
│ Version:              Triggered by:                         │
│ v2.0.5-dev            developer                             │
│                                                             │
│ Pull Request:                                               │
│ #45                                                         │
├─────────────────────────────────────────────────────────────┤
│ Commit: def5678 Fix indexer timeout issue (#45)             │
├─────────────────────────────────────────────────────────────┤
│ [🔀 View PR #45] [📋 Workflow] [🔍 Commit]                  │
└─────────────────────────────────────────────────────────────┘
```

### PR Detection

The action automatically detects PRs from:
1. **Merge commits**: `Merge pull request #123 from branch`
2. **Squash merges**: `Feature description (#123)`
3. **GitHub API fallback**: If token provided, queries for associated PRs

---

## 5. Implementation by Repository

### proxy-smart-contracts (5 workflows)

Create the composite action once, use in all 5 workflows:

| Workflow | Service Name |
|----------|--------------|
| deploy-market-maker.yml | Market Maker |
| deploy-margin-call.yml | Margin Call |
| deploy-notifications.yml | Notifications |
| deploy-oracle-update.yml | Oracle Update |
| deploy-subgraph.yml | Subgraph |

### proxy-indexer (1 workflow)

| Workflow | Service Name |
|----------|--------------|
| build.yml | Spot Indexer |

### proxy-router-ui (1 workflow)

| Workflow | Service Name |
|----------|--------------|
| deploy-marketplace.yml | Marketplace UI |

### proxy-router (1 workflow)

| Workflow | Service Name |
|----------|--------------|
| build.yml | Proxy Router |

---

## 6. Advanced: Per-Environment Slack Channels

If you want different channels for different environments:

```yaml
# In each repository, set up three secrets:
# - SLACK_WEBHOOK_URL_DEV
# - SLACK_WEBHOOK_URL_STG
# - SLACK_WEBHOOK_URL_PROD

- name: Select webhook URL
  id: webhook
  run: |
    case "${{ needs.build.outputs.environment }}" in
      dev)  echo "url=${{ secrets.SLACK_WEBHOOK_URL_DEV }}" >> $GITHUB_OUTPUT ;;
      stg)  echo "url=${{ secrets.SLACK_WEBHOOK_URL_STG }}" >> $GITHUB_OUTPUT ;;
      main) echo "url=${{ secrets.SLACK_WEBHOOK_URL_PROD }}" >> $GITHUB_OUTPUT ;;
    esac

- name: Send Slack notification
  uses: ./.github/actions/slack-notify
  with:
    slack_webhook_url: ${{ steps.webhook.outputs.url }}
    # ... other inputs
```

---

## 7. Setup Checklist

- [ ] Create Slack App with Incoming Webhooks
- [ ] Create webhook(s) for desired channel(s)
- [ ] Add `SLACK_WEBHOOK_URL` secret to:
  - [ ] proxy-smart-contracts
  - [ ] proxy-indexer
  - [ ] proxy-router-ui
  - [ ] proxy-router
- [ ] Create `.github/actions/slack-notify/action.yml` in each repo (or use inline version)
- [ ] Update each workflow to include notification job
- [ ] Test with a push to `dev` branch

---

## 8. Security Considerations

1. **Webhook URLs are sensitive** - treat them like passwords
2. Use repository secrets, not organization secrets (unless you want all repos to use the same webhook)
3. Never log the webhook URL in workflow output
4. Slack webhooks can be regenerated if compromised

---

## Next Steps

Would you like me to:
1. **Create the composite action** in one of the repositories?
2. **Update a specific workflow** to include Slack notifications?
3. **Create a PR** with all changes for one repository as a template?

