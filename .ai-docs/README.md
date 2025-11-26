# Futures Marketplace - Documentation

**Self-hosted infrastructure for the Lumerin Marketplace**

---

## 🚀 Quick Start

### For Developers
Need to query data or deploy code? → **[Developer Guide](./DEVELOPER_GUIDE.md)**

### For Infrastructure
Want to understand the architecture? → **[Architecture](./ARCHITECTURE.md)**

---

## 📚 What's in This Repo

- **Smart Contracts** (`contracts/`) - Solidity contracts for futures marketplace
- **Subgraph** (`subgraph-futures/`) - GraphQL indexer for blockchain data  
- **Notifications** (`notifications/`) - Telegram bot for alerts
- **Margin Call** (`margin-call/`) - Lambda checking positions
- **Oracle Update** (`oracle-update/`) - Lambda updating prices

---

## 🌍 Environments

| Environment | Branch | Endpoints |
|-------------|--------|-----------|
| **DEV** | `dev` | `*.dev.lumerin.io` |
| **STG** | `stg` | `*.stg.lumerin.io` |
| **PROD** | `main` | `*.lumerin.io` |

---

## 🔗 Key Endpoints (DEV)

- **Subgraph GraphQL**: `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace`
- **Subgraph Playground**: `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace/graphql`
- **Notifications** (internal): `https://notifyint.dev.lumerin.io`

---

## 🚢 Deployment

Push to branch → GitHub Actions automatically deploys:

```bash
git push origin dev    # Deploys to DEV
git push origin stg    # Deploys to STG  
git push origin main   # Deploys to PROD
```

Or use **Actions** tab → **Run workflow** → Select environment

---

## 📋 Documentation

| Doc | What's Inside |
|-----|---------------|
| **[Developer Guide](./DEVELOPER_GUIDE.md)** | Endpoints, CI/CD, querying data, troubleshooting |
| **[Architecture](./ARCHITECTURE.md)** | Infrastructure overview, components, data flow |

---

## 🆘 Quick Help

**Query not working?**
```bash
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}'
```

**Check deployment status?**
- GitHub: **Actions** tab
- AWS: CloudWatch logs

**Need more help?**
- Check [Developer Guide](./DEVELOPER_GUIDE.md)
- Review GitHub Actions logs
- Check CloudWatch logs in AWS

---

**Last Updated:** November 26, 2025  
**Status:** ✅ Operational
