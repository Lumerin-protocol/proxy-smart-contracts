# Subgraph Verification Guide

This guide covers how to verify the Futures Marketplace subgraph is deployed, healthy, and indexing correctly.

---

## 🌍 Subgraph Endpoints by Environment

| Environment | GraphQL Endpoint | Admin Endpoint | IPFS |
|-------------|------------------|----------------|------|
| **DEV** | `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace` | `https://graphidx.dev.lumerin.io:8020` | `https://graphidx.dev.lumerin.io/ipfs` |
| **STG** | `https://graphidx.stg.lumerin.io/subgraphs/name/marketplace` | `https://graphidx.stg.lumerin.io:8020` | `https://graphidx.stg.lumerin.io/ipfs` |
| **LMN** | `https://graphidx.lumerin.io/subgraphs/name/marketplace` | `https://graphidx.lumerin.io:8020` | `https://graphidx.lumerin.io/ipfs` |

---

## ✅ Quick Health Check

### 1. GraphQL Query (Check Deployment Status)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number hash timestamp } deployment hasIndexingErrors } }"}' \
  https://graphidx.dev.lumerin.io/subgraphs/name/marketplace
```

**Expected Response:**
```json
{
  "data": {
    "_meta": {
      "block": {
        "number": 123456,
        "hash": "0xabc...",
        "timestamp": 1697000000
      },
      "deployment": "QmXyz...",
      "hasIndexingErrors": false
    }
  }
}
```

**Key Fields:**
- `block.number`: Latest indexed block (should be recent)
- `deployment`: IPFS hash of the deployed subgraph
- `hasIndexingErrors`: Should be `false`

---

## 📋 Version Checking

### Method 1: Query Version Label (from `_meta`)

The version label is set during deployment via `--version-label`:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { deployment } }"}' \
  https://graphidx.dev.lumerin.io/subgraphs/name/marketplace | jq -r '.data._meta.deployment'
```

**Output:** `QmXyz...` (IPFS deployment hash)

### Method 2: Check Graph Node Admin API

List all deployed versions:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"marketplace\") { subgraph synced health chains { chainHeadBlock { number } latestBlock { number } } } }"}' \
  https://graphidx.dev.lumerin.io:8020/graphql
```

**Expected Response:**
```json
{
  "data": {
    "indexingStatusForCurrentVersion": {
      "subgraph": "marketplace",
      "synced": true,
      "health": "healthy",
      "chains": [
        {
          "chainHeadBlock": { "number": "123456" },
          "latestBlock": { "number": "123450" }
        }
      ]
    }
  }
}
```

**Key Fields:**
- `synced`: Should be `true` (subgraph is caught up)
- `health`: Should be `"healthy"`
- `chainHeadBlock` vs `latestBlock`: Should be close (< 10 blocks difference)

### Method 3: Check GitHub Actions Deployment Summary

After each deployment, the GitHub Actions workflow outputs:
- **Version**: `v0.1.0-dev` (semantic version with environment suffix)
- **Deployment ID**: IPFS hash
- **GraphQL Endpoint**: Full URL

---

## 🔍 Detailed Health Checks

### 1. Check Sync Status

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"marketplace\") { synced health fatalError { message } chains { latestBlock { number } chainHeadBlock { number } } } }"}' \
  https://graphidx.dev.lumerin.io:8020/graphql | jq '.'
```

**What to Look For:**
- ✅ `synced: true` → Subgraph is up-to-date
- ✅ `health: "healthy"` → No errors
- ✅ `fatalError: null` → No fatal errors
- ✅ `latestBlock` close to `chainHeadBlock` → Indexing is current

### 2. Check for Indexing Errors

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"marketplace\") { chains { latestBlock { number } earliestBlock { number } } fatalError { handler message block { number } } nonFatalErrors { handler message block { number } } } }"}' \
  https://graphidx.dev.lumerin.io:8020/graphql | jq '.'
```

**What to Look For:**
- ✅ `fatalError: null` → No fatal errors
- ✅ `nonFatalErrors: []` → No non-fatal errors
- ❌ If errors exist, check `message`, `handler`, and `block.number`

### 3. Query Actual Data

Test the subgraph with a real query:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ futures(first: 5) { id contractAddress buyer seller margin marginCall liquidated createdAt } }"}' \
  https://graphidx.dev.lumerin.io/subgraphs/name/marketplace | jq '.'
```

**Expected Response:**
```json
{
  "data": {
    "futures": [
      {
        "id": "0x123...",
        "contractAddress": "0xabc...",
        "buyer": "0xdef...",
        "seller": "0xghi...",
        "margin": "1000000000000000000",
        "marginCall": false,
        "liquidated": false,
        "createdAt": "1697000000"
      }
    ]
  }
}
```

---

## 🚨 Troubleshooting

### Problem: `hasIndexingErrors: true`

**Check Error Details:**
```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"marketplace\") { nonFatalErrors { handler message block { number } } fatalError { handler message block { number } } } }"}' \
  https://graphidx.dev.lumerin.io:8020/graphql | jq '.data.indexingStatusForCurrentVersion'
```

**Common Causes:**
- Smart contract ABI mismatch
- Event handler errors in AssemblyScript
- Network issues (RPC endpoint down)

**Solution:**
1. Check error message and handler name
2. Review `subgraph-futures/src/*.ts` handler code
3. Verify contract addresses in `subgraph.yaml`
4. Redeploy with fixes

---

### Problem: Subgraph Not Syncing (`synced: false`)

**Check Indexing Progress:**
```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"marketplace\") { chains { chainHeadBlock { number } latestBlock { number } } } }"}' \
  https://graphidx.dev.lumerin.io:8020/graphql | jq '.data.indexingStatusForCurrentVersion.chains[0]'
```

**What to Check:**
- `latestBlock` should be increasing over time
- Gap between `latestBlock` and `chainHeadBlock` should be shrinking
- If stuck, check Graph Node logs (CloudWatch)

---

### Problem: "Subgraph not found"

**List All Deployed Subgraphs:**
```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatuses { subgraph synced health } }"}' \
  https://graphidx.dev.lumerin.io:8020/graphql | jq '.data.indexingStatuses'
```

**Solution:**
- Verify subgraph name is `marketplace`
- Check deployment logs in GitHub Actions
- Redeploy using `graph create` then `graph deploy`

---

## 📊 Monitoring Dashboard (Manual Checks)

### Daily Health Check Checklist

1. ✅ **Subgraph is responding** (GraphQL query returns data)
2. ✅ **No indexing errors** (`hasIndexingErrors: false`)
3. ✅ **Synced to latest block** (`synced: true`, `latestBlock` close to `chainHeadBlock`)
4. ✅ **Health status is healthy** (`health: "healthy"`)
5. ✅ **Data is recent** (check `_meta.block.timestamp`)

### Example Health Check Script

```bash
#!/bin/bash
# Save as: check_subgraph_health.sh

ENV="${1:-dev}"
case $ENV in
  dev)
    URL="https://graphidx.dev.lumerin.io/subgraphs/name/marketplace"
    ;;
  stg)
    URL="https://graphidx.stg.lumerin.io/subgraphs/name/marketplace"
    ;;
  lmn)
    URL="https://graphidx.lumerin.io/subgraphs/name/marketplace"
    ;;
esac

echo "🔍 Checking subgraph: $ENV"
echo "URL: $URL"
echo ""

# Query _meta
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number timestamp } deployment hasIndexingErrors } }"}' \
  "$URL")

# Extract values
BLOCK=$(echo "$RESPONSE" | jq -r '.data._meta.block.number')
TIMESTAMP=$(echo "$RESPONSE" | jq -r '.data._meta.block.timestamp')
DEPLOYMENT=$(echo "$RESPONSE" | jq -r '.data._meta.deployment')
ERRORS=$(echo "$RESPONSE" | jq -r '.data._meta.hasIndexingErrors')

# Convert timestamp to human-readable
DATE=$(date -r "$TIMESTAMP" 2>/dev/null || date -d "@$TIMESTAMP" 2>/dev/null || echo "N/A")

echo "📊 Results:"
echo "  Block Number: $BLOCK"
echo "  Block Time: $DATE"
echo "  Deployment: $DEPLOYMENT"
echo "  Has Errors: $ERRORS"
echo ""

# Status check
if [ "$ERRORS" = "false" ]; then
  echo "✅ Subgraph is healthy!"
  exit 0
else
  echo "❌ Subgraph has indexing errors!"
  exit 1
fi
```

---

## 🔗 Useful Links

- **Graph Protocol Docs**: https://thegraph.com/docs/
- **GraphQL Playground**: Add `/graphql` to your Graph Node URL
- **IPFS Gateway**: Access deployment files via `https://graphidx.dev.lumerin.io/ipfs/<hash>`

---

## 📝 Version History Tracking

To track version history across deployments, you can:

1. **Check Git Tags**: Each production deployment creates a git tag (e.g., `subgraph-v0.1.0`)
2. **Check Deployment ID**: Each deployment has a unique IPFS hash
3. **Check GitHub Actions**: View past workflow runs for deployment history

**List Recent Deployments:**
```bash
# From proxy-smart-contracts repo
git tag -l "subgraph-v*" | sort -V | tail -5
```

---

## 🎯 Summary: Post-Deployment Verification

After a GitHub Actions deployment completes:

1. **Wait 1-2 minutes** for indexing to start
2. **Check `_meta`** for deployment ID and sync status
3. **Verify no errors** (`hasIndexingErrors: false`)
4. **Query real data** to ensure schema works
5. **Monitor sync progress** (block numbers increasing)

If everything looks good, the subgraph is ready for use! 🎉

