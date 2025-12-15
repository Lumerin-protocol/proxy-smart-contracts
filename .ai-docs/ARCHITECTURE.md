# Architecture Overview

## Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Futures Marketplace                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 Subgraph (Public)              🔔 Notifications (Internal)│
│  ├─ Graph Node (ECS)              ├─ Telegram Bot (ECS)     │
│  ├─ IPFS (ECS)                    └─ PostgreSQL (RDS)       │
│  └─ PostgreSQL (RDS)                                         │
│                                                              │
│  ⏰ Margin Call Lambda             📡 Oracle Update Lambda   │
│  └─ Runs every 15 min             └─ Runs every 5 min       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Subgraph Indexer

**What**: Indexes blockchain events into queryable GraphQL API

**Stack**:
- Graph Node (ECS Fargate) - Indexes events, serves queries
- IPFS (ECS Fargate) - Stores subgraph metadata
- PostgreSQL (RDS) - Stores indexed data

**Endpoints**:
- GraphQL: `https://graphidx.{env}.lumerin.io/subgraphs/name/marketplace`
- Admin: `https://graphidx.{env}.lumerin.io:8020`

**Access**: Public (port 443), Admin restricted (port 8020)

---

## Notifications Service

**What**: Telegram bot for margin call alerts

**Stack**:
- Node.js/Fastify (ECS Fargate)
- PostgreSQL (RDS) - User subscriptions

**Endpoint**: `https://notifyint.{env}.lumerin.io` (internal only)

**Access**: VPC-internal only (called by Lambda)

---

## Margin Call Lambda

**What**: Monitors positions, triggers alerts

**Stack**:
- Node.js 22 Lambda
- EventBridge trigger (every 15 minutes)

**Flow**:
1. Query subgraph for open positions
2. Check oracle for current price
3. Calculate margin ratios
4. If < 10%, POST to Notifications service
5. Notifications sends Telegram alert

---

## Oracle Update Lambda

**What**: Updates on-chain BTC-USDC price

**Stack**:
- Node.js 22 Lambda
- EventBridge trigger (every 5 minutes)

**Flow**:
1. Fetch price from external API
2. Submit transaction to oracle contract
3. Update on-chain price feed

---

## Data Flow

```
Ethereum (Arbitrum)
    ↓ events
Graph Node → indexes → PostgreSQL
    ↓ GraphQL
Margin Call Lambda
    ↓ calculates margins
Notifications Service
    ↓ sends alerts
Telegram Users
```

---

## Resource Sizing

### DEV Environment
- Graph Node: 1 vCPU, 2 GB
- IPFS: 1 vCPU, 2 GB  
- RDS (Subgraph): db.t3.small
- RDS (Notifications): db.t3.micro
- Lambda: 512 MB
- **Cost**: ~$150/month

### STG/PROD
- Graph Node: 2 vCPU, 4 GB
- IPFS: 2 vCPU, 4 GB
- RDS (Subgraph): db.r6g.large
- RDS (Notifications): db.t3.small
- Lambda: 512 MB
- **Cost**: ~$250-$300/month

---

## Network & Security

**Public Access**:
- ✅ Subgraph GraphQL (port 443)
- ✅ HTTPS only, WAF protected

**Internal Only**:
- 🔒 Notifications service (VPC only)
- 🔒 RDS instances (private subnets)
- 🔒 Lambda (VPC enabled)

**Secrets**:
- AWS Secrets Manager for all sensitive data
- IAM-based access control
- No credentials in code

---

## Monitoring

**Logs** (CloudWatch):
- `/ecs/lumerin-graph-node-{env}`
- `/ecs/lumerin-ipfs-{env}`
- `/ecs/lumerin-notifications-{env}`
- `/aws/lambda/margin-call-{env}`
- `/aws/lambda/marketplace-oracle-update`

**Metrics**:
- ECS: CPU, memory, network
- RDS: Connections, storage, IOPS
- Lambda: Duration, errors, invocations

---

## Deployment

**Infrastructure**: Terraform/Terragrunt in `proxy-ui-foundation` repo

**Applications**: GitHub Actions in this repo
- Builds Docker images → GHCR
- Packages Lambda functions
- Updates ECS services
- Deploys subgraphs

**Authentication**: OIDC (no long-lived credentials)

---

## Key Technologies

- **Graph Protocol**: v0.40.2
- **IPFS**: v0.38.1
- **PostgreSQL**: 17.2
- **Node.js**: 22.x
- **ECS**: Fargate
- **Lambda**: Node.js 22.x runtime

---

For operational details, see [Developer Guide](./DEVELOPER_GUIDE.md)

