# Developer Guide

## 🎯 Endpoints

### DEV
- **Subgraph**: `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace`
- **Playground**: `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace/graphql`
- **Notifications**: `https://notifyint.dev.lumerin.io` (internal)

### STG
- **Subgraph**: `https://graphidx.stg.lumerin.io/subgraphs/name/marketplace`
- **Playground**: `https://graphidx.stg.lumerin.io/subgraphs/name/marketplace/graphql`
- **Notifications**: `https://notifyint.stg.lumerin.io` (internal)

### PROD
- **Subgraph**: `https://graphidx.lumerin.io/subgraphs/name/marketplace`
- **Playground**: `https://graphidx.lumerin.io/subgraphs/name/marketplace/graphql`
- **Notifications**: `https://notifyint.lumerin.io` (internal)

---

## 🚀 Quick Examples

### Check Subgraph Health
```bash
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}'
```

### Query Data
```bash
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ futures(first: 5) { id buyer seller } }"}'
```

### TypeScript/JavaScript
```typescript
const SUBGRAPH_URL = 'https://graphidx.dev.lumerin.io/subgraphs/name/marketplace';

const query = `
  query {
    futures(first: 10, orderBy: createdAt, orderDirection: desc) {
      id
      buyer
      seller
      price
    }
  }
`;

const response = await fetch(SUBGRAPH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
});

const { data } = await response.json();
```

### React + Apollo
```typescript
import { ApolloClient, InMemoryCache, gql, useQuery } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://graphidx.dev.lumerin.io/subgraphs/name/marketplace',
  cache: new InMemoryCache(),
});

const GET_FUTURES = gql`
  query {
    futures(first: 10) {
      id
      buyer
      seller
    }
  }
`;

function MyComponent() {
  const { loading, error, data } = useQuery(GET_FUTURES);
  
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  
  return <div>{/* render data */}</div>;
}
```

---

## 🚢 Deployment

### Automatic (Push to Branch)

```bash
# Deploy to DEV
git push origin dev

# Deploy to STG  
git push origin stg

# Deploy to PROD
git push origin main
```

Workflows automatically:
1. Build Docker images / Lambda packages
2. Push to GHCR / AWS
3. Update ECS services / Lambda functions
4. Wait for stabilization
5. Create version tags (PROD only)

### Manual (GitHub UI)

1. Go to **Actions** tab
2. Select workflow:
   - `Deploy Notifications Service`
   - `Deploy Margin Call Lambda`
   - `Deploy Oracle Update Lambda`
   - `Deploy Subgraph`
3. Click **Run workflow**
4. Choose environment (dev/stg/main)
5. Click **Run workflow**

### Service-Specific Paths

Workflows trigger on changes to:
- `notifications/**` → Deploy notifications
- `margin-call/**` → Deploy margin call
- `oracle-update/**` → Deploy oracle update
- `subgraph-futures/**` → Deploy subgraph

---

## 🔍 Monitoring

### CloudWatch Logs

```bash
# Graph Node
aws logs tail /ecs/lumerin-graph-node-dev --follow

# IPFS
aws logs tail /ecs/lumerin-ipfs-dev --follow

# Notifications
aws logs tail /ecs/lumerin-notifications-dev --follow

# Margin Call Lambda
aws logs tail /aws/lambda/margin-call-dev --follow

# Oracle Lambda
aws logs tail /aws/lambda/marketplace-oracle-update --follow
```

### GitHub Actions

- **Status**: Actions tab in GitHub
- **Logs**: Click on workflow run → Job → Step
- **Summary**: Each run shows deployment summary

---

## 🐛 Troubleshooting

### Subgraph Not Syncing

**Check sync status**:
```bash
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}'
```

**Common causes**:
- Ethereum RPC down/rate-limited
- Database connection issues
- Indexing errors in handlers

**Solution**: Check Graph Node logs in CloudWatch

### Deployment Failed

**Check GitHub Actions logs**:
1. Go to Actions tab
2. Click failed workflow run
3. Review error messages

**Common causes**:
- AWS IAM permission issues
- Resource not available (ECS/Lambda)
- Build errors (dependencies, syntax)

**Solution**: Review error message, check AWS console

### Query Returns Empty Data

**Possible causes**:
1. Subgraph still syncing (check `_meta.block.number`)
2. No data matching query filters
3. Indexing errors (check `_meta.hasIndexingErrors`)

**Solution**:
```bash
# Check if subgraph has indexed data
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}'
```

### OIDC Authentication Failed

**Error**: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Solution**:
1. Verify OIDC provider exists in AWS
2. Check IAM role trust policy includes repo
3. Verify GitHub secret `AWS_ROLE_ARN_*` is set

### ECS Service Won't Start

**Check CloudWatch logs**:
```bash
aws logs tail /ecs/lumerin-notifications-dev --since 10m
```

**Common causes**:
- Container image doesn't exist / wrong tag
- Environment variables missing
- Security groups blocking traffic
- Database not accessible

---

## 🏷️ Versioning

### Format
- **DEV**: `v0.1.5-dev`
- **STG**: `v0.2.0-stg`  
- **PROD**: `v1.0.0` (no suffix)

### Git Tags
- Only created for PROD deployments
- Format: `{service}-v{version}`
- Examples: `subgraph-v1.0.0`, `margin-call-v1.0.0`

### Check Current Version
```bash
# List recent tags
git tag -l "*-v*" | sort -V | tail -5

# Check deployed version
curl https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -X POST -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { deployment } }"}'
```

---

## 📦 Local Development

### Subgraph
```bash
cd subgraph-futures
yarn install
yarn prepare-dev
yarn codegen
yarn build

# Deploy to dev
yarn graph deploy --node https://graphidx.dev.lumerin.io:8020 \
  --version-label v0.1.0-dev-local \
  marketplace
```

### Margin Call Lambda
```bash
cd margin-call
yarn install
yarn build

# Test locally
export ETH_NODE_URL="https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY"
export SUBGRAPH_URL="https://graphidx.dev.lumerin.io/subgraphs/name/marketplace"
export FUTURES_ADDRESS="0x..."
export HASHRATE_ORACLE_ADDRESS="0x..."
export NOTIFICATIONS_SERVICE_URL="https://notifyint.dev.lumerin.io/notifications"

node dist/index.js
```

### Notifications
```bash
cd notifications
docker-compose up

# Test health endpoint
curl http://localhost:3000/healthcheck
```

---

## 🔐 Secrets & Environment Variables

**Where secrets are stored**: AWS Secrets Manager

**Required secrets** (per environment):
- `telegram_bot_token` - Notifications Telegram bot
- `ethereum_rpc_url` - Ethereum node endpoint
- `database_url` - PostgreSQL connection (auto-generated)

**GitHub secrets** (repository-level):
- `AWS_ROLE_ARN_DEV` - IAM role for DEV
- `AWS_ROLE_ARN_STG` - IAM role for STG
- `AWS_ROLE_ARN_LMN` - IAM role for PROD

---

## 📊 Common Queries

### Get Latest Block
```graphql
{
  _meta {
    block {
      number
      timestamp
    }
  }
}
```

### Get Recent Futures
```graphql
{
  futures(first: 10, orderBy: createdAt, orderDirection: desc) {
    id
    buyer
    seller
    price
    createdAt
  }
}
```

### Check Indexing Errors
```graphql
{
  _meta {
    hasIndexingErrors
    block {
      number
    }
  }
}
```

---

## 🆘 Quick Commands

```bash
# Check subgraph health
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { hasIndexingErrors } }"}'

# Check ECS service status
aws ecs describe-services --cluster bedrock-dev-use1-1 \
  --services svc-lumerin-notifications-dev-use1

# Check Lambda status
aws lambda get-function --function-name margin-call-dev

# Restart ECS service
aws ecs update-service --cluster bedrock-dev-use1-1 \
  --service svc-lumerin-notifications-dev-use1 --force-new-deployment

# View logs
aws logs tail /ecs/lumerin-graph-node-dev --follow
```

---

For architecture details, see [Architecture](./ARCHITECTURE.md)

