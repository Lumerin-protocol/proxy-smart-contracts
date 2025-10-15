# Subgraph Troubleshooting & Logging

This guide covers how to troubleshoot issues with the Graph Node and IPFS services.

---

## 🔍 Viewing Logs in AWS CloudWatch

### Graph Node Logs

**Log Group:** `/aws/ecs/bedrock-dev-lumerin-marketplace-log-group`  
**Log Stream Pattern:** `lumerin-graph-node-tsk/*`

```bash
# View recent logs (last 10 minutes)
aws logs tail /aws/ecs/bedrock-dev-lumerin-marketplace-log-group \
  --follow \
  --filter-pattern "lumerin-graph-node" \
  --profile titanio-dev \
  --region us-east-1
```

### IPFS Logs

**Log Group:** `/aws/ecs/bedrock-dev-lumerin-marketplace-log-group`  
**Log Stream Pattern:** `lumerin-ipfs-tsk/*`

```bash
# View recent logs (last 10 minutes)
aws logs tail /aws/ecs/bedrock-dev-lumerin-marketplace-log-group \
  --follow \
  --filter-pattern "lumerin-ipfs" \
  --profile titanio-dev \
  --region us-east-1
```

---

## 🎚️ Log Levels by Environment

### DEV Environment (Verbose Logging)

| Service | Log Level | Additional Settings |
|---------|-----------|---------------------|
| **Graph Node** | `GRAPH_LOG=debug` | `GRAPH_LOG_QUERY_TIMING=gql` (logs GraphQL query performance) |
| **IPFS** | `IPFS_LOGGING=debug` | Verbose IPFS operations |

### STG/LMN Environments (Production Logging)

| Service | Log Level | Additional Settings |
|---------|-----------|---------------------|
| **Graph Node** | `GRAPH_LOG=info` | No query timing (production) |
| **IPFS** | `IPFS_LOGGING=info` | Standard IPFS logging |

---

## 🔧 Common Issues & Solutions

### 1. IPFS Upload Fails with "Content-Type: application/json is required"

**Symptoms:**
```
✖ Failed to upload subgraph to IPFS: Failed to upload file to IPFS: 
Supplied content type is not allowed. Content-Type: application/json is required
```

**Cause:**
The `graph deploy` command is being run with `--ipfs` flag pointing to the admin API endpoint, but Graph Node expects to handle IPFS uploads internally.

**Solution:**
Remove the `--ipfs` flag from the deploy command. Graph Node manages IPFS internally:

```yaml
# ❌ WRONG - Don't specify IPFS separately
graph deploy --node https://graphidx.dev.lumerin.io:8020 \
  --ipfs https://graphidx.dev.lumerin.io:8020 \
  marketplace

# ✅ CORRECT - Let Graph Node handle IPFS
graph deploy --node https://graphidx.dev.lumerin.io:8020 \
  --version-label v0.1.0-dev \
  marketplace
```

**Why This Works:**
- Graph Node has internal access to IPFS via Service Discovery (`ipfs.subgraph.local:5001`)
- When you deploy to the admin API, Graph Node automatically handles IPFS uploads
- The `--ipfs` flag is only needed when using external hosted IPFS

---

### 2. Subgraph Deployment Fails with "403 Forbidden" (IPFS)

**Symptoms:**
```
✖ Failed to upload subgraph to IPFS: Failed to upload file to IPFS: 
403 Forbidden
```

**Causes:**
- IPFS container is not running
- IPFS API port (5001) is not accessible
- Security group blocking traffic

**Check IPFS Health:**
```bash
# Check ECS service status
aws ecs describe-services \
  --cluster bedrock-dev-use1-1 \
  --services svc-lumerin-ipfs-dev-use1 \
  --profile titanio-dev \
  --region us-east-1 | jq '.services[0].runningCount'

# Check IPFS logs
aws logs tail /aws/ecs/bedrock-dev-lumerin-marketplace-log-group \
  --filter-pattern "lumerin-ipfs" \
  --since 10m \
  --profile titanio-dev \
  --region us-east-1
```

**Solution:**
- Verify IPFS container is running in ECS
- Check security groups allow internal communication between Graph Node and IPFS
- Ensure Service Discovery is working (`ipfs.subgraph.local:5001`)

---

### 3. Graph Node "Connection Refused" to IPFS

**Symptoms in Graph Node logs:**
```
ERROR Failed to connect to IPFS at ipfs.subgraph.local:5001: Connection refused
```

**Causes:**
- IPFS service not running
- Service Discovery not working
- VPC networking issue

**Check Service Discovery:**
```bash
# Check if IPFS service is registered
aws servicediscovery list-services \
  --profile titanio-dev \
  --region us-east-1 | jq '.Services[] | select(.Name == "ipfs")'

# Check service instances
aws servicediscovery discover-instances \
  --namespace-name subgraph.local \
  --service-name ipfs \
  --profile titanio-dev \
  --region us-east-1
```

**Solution:**
- Restart IPFS ECS service
- Verify Service Discovery namespace exists
- Check VPC networking and security groups

---

### 3. IPFS Lock Contention During Deployment

**Symptoms:**
```
Error: lock /data/ipfs/repo.lock: someone else has the lock
```

**Causes:**
- ECS trying to start new IPFS task before old one stops
- Old IPFS task still has file lock on EFS-mounted repository
- Blue/green deployment attempting to run two IPFS instances simultaneously

**Why This Happens:**
IPFS uses a file lock (`/data/ipfs/repo.lock`) to prevent multiple instances from accessing the same repository. Since IPFS data is stored on EFS (shared filesystem), only one IPFS instance can have the lock at a time.

**Solution (Applied in Terraform):**
```hcl
# In 08_subgraph_indexer.tf
resource "aws_ecs_service" "ipfs_use1" {
  # CRITICAL: IPFS uses file locks on EFS - must stop old task before starting new one
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
  # ... rest of config
}
```

This forces ECS to:
1. Stop the old IPFS task first
2. Wait for it to release the lock
3. Then start the new IPFS task

**Manual Recovery (If Lock Persists):**
If the lock file is stale and IPFS won't start:

```bash
# 1. Stop all IPFS tasks
aws ecs update-service \
  --cluster ecs-lumerin-marketplace-dev-use1 \
  --service svc-lumerin-ipfs-dev-use1 \
  --desired-count 0 \
  --profile titanio-dev \
  --region us-east-1

# 2. Wait for tasks to stop
aws ecs wait services-stable \
  --cluster ecs-lumerin-marketplace-dev-use1 \
  --service svc-lumerin-ipfs-dev-use1 \
  --profile titanio-dev \
  --region us-east-1

# 3. Remove stale lock file (requires ECS Exec or EC2 with EFS mounted)
# Option A: Via ECS Exec to a stopped Graph Node container
aws ecs execute-command \
  --cluster ecs-lumerin-marketplace-dev-use1 \
  --task <TASK_ID> \
  --container graph-node-container \
  --command "rm -f /ipfs-data/repo.lock" \
  --interactive \
  --profile titanio-dev \
  --region us-east-1

# Option B: Mount EFS to EC2 and remove lock
# (See AWS EFS documentation)

# 4. Restart IPFS service
aws ecs update-service \
  --cluster ecs-lumerin-marketplace-dev-use1 \
  --service svc-lumerin-ipfs-dev-use1 \
  --desired-count 1 \
  --profile titanio-dev \
  --region us-east-1
```

**Expected Downtime:**
- 30-60 seconds during normal deployments (old task stops, new task starts)
- This is acceptable for DEV environment
- For production, consider running IPFS separately or using Graph Node's hosted IPFS

---

### 4. Graph Node "Syncing" But Not Progressing

**Symptoms:**
```
{ "synced": false, "health": "healthy", "latestBlock": 123000, "chainHeadBlock": 125000 }
```
Block number stuck and not increasing.

**Causes:**
- Ethereum RPC endpoint down or rate-limited
- Database connection issues
- Indexing errors

**Check Graph Node Logs:**
```bash
aws logs tail /aws/ecs/bedrock-dev-lumerin-marketplace-log-group \
  --filter-pattern "ERROR" \
  --since 30m \
  --profile titanio-dev \
  --region us-east-1
```

**Look for:**
- `ERROR ethereum rpc` → RPC issues
- `ERROR store` → Database issues
- `ERROR subgraph` → Indexing/handler errors

**Solution:**
- Verify Ethereum RPC URL is correct and accessible
- Check RDS database connectivity
- Review subgraph event handlers for bugs

---

### 5. Subgraph Has Indexing Errors

**Symptoms:**
```
{ "hasIndexingErrors": true, "health": "failed" }
```

**Check Indexing Status:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"marketplace\") { fatalError { message handler block { number } } nonFatalErrors { message handler block { number } } } }"}' \
  https://graphidx.dev.lumerin.io:8020/graphql | jq '.'
```

**Common Errors:**
- **ABI mismatch**: Contract ABI doesn't match deployed contract
- **Handler error**: Bug in `subgraph-futures/src/*.ts` event handler
- **Missing entity**: Entity not created before being referenced

**Solution:**
1. Check error message and handler name
2. Review handler code in `subgraph-futures/src/`
3. Verify contract ABIs are up to date
4. Fix and redeploy subgraph

---

## 📊 Useful CloudWatch Insights Queries

### Query 1: Find All Errors (Last Hour)

```sql
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

### Query 2: IPFS Upload Activity

```sql
fields @timestamp, @message
| filter @logStream like /ipfs/
| filter @message like /POST|PUT|add/
| sort @timestamp desc
| limit 50
```

### Query 3: Graph Node Indexing Progress

```sql
fields @timestamp, @message
| filter @message like /block|sync|index/
| sort @timestamp desc
| limit 100
```

---

## 🔍 Debugging Checklist

When troubleshooting subgraph deployment issues, check in this order:

1. ✅ **ECS Services Running**
   - Graph Node: `svc-lumerin-graph-node-dev-use1`
   - IPFS: `svc-lumerin-ipfs-dev-use1`

2. ✅ **RDS Database Accessible**
   - Check connectivity from ECS tasks
   - Verify credentials in Secrets Manager

3. ✅ **Service Discovery Working**
   - IPFS discoverable at `ipfs.subgraph.local:5001`
   - Namespace `subgraph.local` exists

4. ✅ **Security Groups Allow Traffic**
   - Graph Node → IPFS (port 5001)
   - Graph Node → RDS (port 5432)
   - External → ALB (ports 80, 443, 8020)

5. ✅ **Ethereum RPC Accessible**
   - Test RPC URL from within VPC
   - Check rate limits

6. ✅ **IPFS Has Storage**
   - EFS volume mounted
   - Sufficient space available

7. ✅ **Logs Show Activity**
   - No connection errors
   - Indexing progressing
   - No fatal errors

---

## 🚨 Emergency Commands

### Restart Services

```bash
# Restart Graph Node
aws ecs update-service \
  --cluster bedrock-dev-use1-1 \
  --service svc-lumerin-graph-node-dev-use1 \
  --force-new-deployment \
  --profile titanio-dev \
  --region us-east-1

# Restart IPFS
aws ecs update-service \
  --cluster bedrock-dev-use1-1 \
  --service svc-lumerin-ipfs-dev-use1 \
  --force-new-deployment \
  --profile titanio-dev \
  --region us-east-1
```

### Check Resource Usage

```bash
# Check task CPU/Memory
aws ecs describe-tasks \
  --cluster bedrock-dev-use1-1 \
  --tasks $(aws ecs list-tasks --cluster bedrock-dev-use1-1 --service svc-lumerin-graph-node-dev-use1 --profile titanio-dev --region us-east-1 --query 'taskArns[0]' --output text) \
  --profile titanio-dev \
  --region us-east-1 | jq '.tasks[0].containers[] | {name, cpu, memory}'
```

### Delete and Redeploy Subgraph

```bash
cd /Volumes/moon/repo/hub/proxy-smart-contracts/subgraph-futures

# Remove existing subgraph
graph remove --node https://graphidx.dev.lumerin.io:8020 marketplace

# Recreate and deploy
graph create --node https://graphidx.dev.lumerin.io:8020 marketplace
graph deploy --node https://graphidx.dev.lumerin.io:8020 \
  --ipfs https://graphidx.dev.lumerin.io:8020 \
  --version-label v0.1.0-dev \
  marketplace
```

---

## 📞 Support Resources

- **Graph Node Docs**: https://thegraph.com/docs/en/operating-graph-node/
- **IPFS Docs**: https://docs.ipfs.tech/
- **CloudWatch Logs Console**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups

---

## 🎯 Success Indicators

When everything is working correctly, you should see:

1. **Both ECS services running** with `runningCount = desiredCount`
2. **Graph Node logs** showing block progression:
   ```
   INFO Syncing blocks from Ethereum, current: 123450, head: 123456
   ```
3. **IPFS logs** showing successful API calls
4. **Subgraph health check** returns:
   ```json
   { "synced": true, "health": "healthy", "hasIndexingErrors": false }
   ```
5. **GraphQL queries** returning data

If all these check out, your subgraph is healthy! ✅

