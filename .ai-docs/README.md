# Marketplace Subgraph Documentation

**Self-hosted Graph Protocol infrastructure for the Lumerin Marketplace**

---

## 📚 Documentation Index

### 🚀 **For Developers** (Start Here!)
- **[Developer Quick Reference](./DEVELOPER_QUICK_REFERENCE.md)** ← **START HERE**
  - One-page guide with endpoints, examples, and code snippets
  - How to query the subgraph from your app
  - Common queries and troubleshooting

### 🏗️ **For DevOps/Infrastructure**
- **[Graph Architecture Review](./GRAPH_ARCHITECTURE_REVIEW.md)**
  - Complete infrastructure overview (AWS ECS, RDS, IPFS)
  - Resource sizing and configuration
  - Deployment history and fixes applied
  - Production readiness checklist

- **[Subgraph Troubleshooting](./SUBGRAPH_TROUBLESHOOTING.md)**
  - Common issues and solutions
  - Deployment errors and fixes
  - Performance optimization tips
  - Log analysis guide

- **[Subgraph Verification](./SUBGRAPH_VERIFICATION.md)**
  - Testing procedures
  - Health checks
  - Validation commands

### 🔒 **For Security Review**
- **[Admin API Security](./SUBGRAPH_ADMIN_API_SECURITY.md)**
  - Port 8020 security considerations
  - VPN/WAF configuration recommendations
  - Access control best practices

---

## ⚡ Quick Links

### **DEV Environment Endpoints**
- **GraphQL Queries**: `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace`
- **GraphQL Playground**: `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace/graphql`
- **Admin API** (DevOps only): `https://graphidx.dev.lumerin.io:8020`

### **Infrastructure Status**
- **Graph Node**: v0.40.2 (1 vCPU, 2 GB)
- **IPFS**: v0.38.1 (1 vCPU, 2 GB)
- **PostgreSQL**: 17.2 (db.t3.small)
- **Status**: ✅ **FULLY OPERATIONAL**

### **CI/CD**
- **Workflow**: `.github/workflows/deploy-subgraph.yml`
- **Trigger**: Push to `cicd/initial_futures_deployment` branch
- **Build Time**: ~3-5 minutes
- **Deploy Time**: ~3-7 minutes

---

## 🎯 Common Tasks

### I want to query data from the subgraph
→ See [Developer Quick Reference](./DEVELOPER_QUICK_REFERENCE.md)

### I want to deploy a subgraph update
→ Push to GitHub - CI/CD handles it automatically

### I want to check subgraph health
```bash
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}'
```

### I want to troubleshoot an issue
→ See [Subgraph Troubleshooting](./SUBGRAPH_TROUBLESHOOTING.md)

### I want to understand the infrastructure
→ See [Graph Architecture Review](./GRAPH_ARCHITECTURE_REVIEW.md)

---

## 🆘 Getting Help

1. **Check the docs** in this directory (start with Developer Quick Reference)
2. **Review logs**:
   ```bash
   aws logs tail /ecs/lumerin-graph-node-dev --follow
   ```
3. **Check subgraph status**:
   ```bash
   curl https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
     -X POST -H "Content-Type: application/json" \
     -d '{"query": "{ _meta { hasIndexingErrors block { number } } }"}'
   ```

---

## 📊 Environment Overview

### **DEV** (Current)
- **Status**: ✅ Production-ready for development
- **Confidence**: 95%
- **Resources**: Optimized for development workloads
- **CI/CD**: Automated via GitHub Actions

### **STG** (Future)
- **Status**: 🔄 Not yet deployed
- **Recommended**: 2 vCPU/4 GB for Graph Node
- **RDS**: Upgrade to db.r6g.large
- **Multi-AZ**: Enable for higher availability

### **LMN** (Production - Future)
- **Status**: 🔄 Not yet deployed
- **Recommended**: Same as STG + monitoring
- **RDS**: db.r6g.large with Multi-AZ
- **WAF**: Enable for security

---

## 📅 Recent Updates

### October 16, 2025
- ✅ Initial DEV deployment successful
- ✅ Pinned versions: Graph Node v0.40.2, IPFS v0.38.1
- ✅ Resource upgrades: 4x IPFS, 2x Graph Node
- ✅ Subgraph indexing at block 195M+ with zero errors
- ✅ CI/CD pipeline validated and operational

---

## 🔗 External Resources

- **Graph Protocol Docs**: https://thegraph.com/docs/
- **GraphQL Tutorial**: https://graphql.org/learn/
- **Subgraph Studio**: https://thegraph.com/studio/
- **Graph Node GitHub**: https://github.com/graphprotocol/graph-node

---

**Last Updated:** October 16, 2025  
**Maintained By:** DevOps Team  
**Environment:** DEV (aws-titanio-dev)

