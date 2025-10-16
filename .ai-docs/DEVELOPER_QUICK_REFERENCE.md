# Marketplace Subgraph - Developer Quick Reference

**Environment:** DEV  
**Subgraph Name:** `marketplace`  
**Last Updated:** October 16, 2025

---

## 🎯 Endpoints

| What You Need | Use This Endpoint | Port |
|---------------|-------------------|------|
| **Query data from your app** | `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace` | 443 (HTTPS) |
| **Test queries in browser** | `https://graphidx.dev.lumerin.io/subgraphs/name/marketplace/graphql` | 443 (HTTPS) |
| **Deploy subgraph (DevOps only)** | `https://graphidx.dev.lumerin.io:8020` | 8020 |

---

## 💻 Quick Examples

### 1. Check Subgraph Health
```bash
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}'
```

**Expected Response:**
```json
{
  "data": {
    "_meta": {
      "block": { "number": 195372305 },
      "hasIndexingErrors": false
    }
  }
}
```

---

### 2. Query Futures Contracts (Example)
```bash
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ futures(first: 5) { id buyerAddress sellerAddress } }"}'
```

---

### 3. Use in JavaScript/TypeScript

```typescript
const SUBGRAPH_URL = 'https://graphidx.dev.lumerin.io/subgraphs/name/marketplace';

// Example query
const query = `
  query GetRecentFutures {
    futures(first: 10, orderBy: createdAt, orderDirection: desc) {
      id
      buyerAddress
      sellerAddress
      price
      createdAt
    }
  }
`;

// Fetch data
async function fetchSubgraph() {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  
  const { data, errors } = await response.json();
  
  if (errors) {
    console.error('Subgraph query failed:', errors);
    return null;
  }
  
  return data.futures;
}
```

---

### 4. Use with Apollo Client (React)

```typescript
import { ApolloClient, InMemoryCache, gql, useQuery } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://graphidx.dev.lumerin.io/subgraphs/name/marketplace',
  cache: new InMemoryCache(),
});

const GET_FUTURES = gql`
  query GetFutures {
    futures(first: 10) {
      id
      buyerAddress
      sellerAddress
    }
  }
`;

function MyComponent() {
  const { loading, error, data } = useQuery(GET_FUTURES);
  
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  
  return (
    <ul>
      {data.futures.map(future => (
        <li key={future.id}>{future.id}</li>
      ))}
    </ul>
  );
}
```

---

### 5. Use with wagmi/viem (React + TypeScript)

```typescript
import { useQuery } from '@tanstack/react-query';

const SUBGRAPH_URL = 'https://graphidx.dev.lumerin.io/subgraphs/name/marketplace';

interface Future {
  id: string;
  buyerAddress: string;
  sellerAddress: string;
}

async function fetchFutures(): Promise<Future[]> {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query {
          futures(first: 10) {
            id
            buyerAddress
            sellerAddress
          }
        }
      `
    })
  });
  
  const { data } = await response.json();
  return data.futures;
}

export function useFutures() {
  return useQuery({
    queryKey: ['futures'],
    queryFn: fetchFutures,
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

// Usage in component
function FuturesList() {
  const { data: futures, isLoading, error } = useFutures();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading futures</div>;
  
  return (
    <div>
      {futures?.map(future => (
        <div key={future.id}>{future.id}</div>
      ))}
    </div>
  );
}
```

---

## 📊 Common Queries

### Get Latest Block Number
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

### Check for Indexing Errors
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

### Get Deployment Info
```graphql
{
  _meta {
    deployment
    block {
      number
    }
  }
}
```

---

## 🚨 Troubleshooting

### Issue: "Network Error" or Connection Refused
**Solution:** Make sure you're using `https://` (not `http://`) and port 443 is the default (no need to specify `:443`)

### Issue: "Subgraph not found"
**Solution:** Verify the subgraph name is `marketplace` (case-sensitive)

### Issue: Query returns empty data
**Possible Causes:**
1. Subgraph is still syncing (check `_meta.block.number`)
2. No data exists for your query filters
3. Check `_meta.hasIndexingErrors` - should be `false`

### Issue: Slow queries
**Solution:** 
- Use pagination (`first: 100, skip: 0`)
- Add filters to reduce dataset
- Use `orderBy` and `orderDirection` for efficient sorting

---

## 🔄 Deployment Updates

**How to update the subgraph:**

1. Push changes to `cicd/initial_futures_deployment` branch
2. GitHub Actions automatically builds and deploys
3. Wait ~5-10 minutes for deployment
4. Subgraph will continue indexing from current block

**Check if update is live:**
```bash
curl -X POST https://graphidx.dev.lumerin.io/subgraphs/name/marketplace \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { deployment } }"}'
```

---

## 📚 Additional Resources

- **Full Architecture Docs**: `.ai-docs/GRAPH_ARCHITECTURE_REVIEW.md`
- **Troubleshooting Guide**: `.ai-docs/SUBGRAPH_TROUBLESHOOTING.md`
- **Graph Protocol Docs**: https://thegraph.com/docs/en/querying/querying-the-graph/
- **GraphQL Tutorial**: https://graphql.org/learn/

---

## 🆘 Need Help?

1. Check subgraph health: `curl https://graphidx.dev.lumerin.io/subgraphs/name/marketplace/_health`
2. Review Graph Node logs (DevOps): `aws logs tail /ecs/lumerin-graph-node-dev --follow`
3. Check for indexing errors in `_meta.hasIndexingErrors`

---

## 🎯 TL;DR

**Just want to query data?**
```typescript
const url = 'https://graphidx.dev.lumerin.io/subgraphs/name/marketplace';
const query = '{ futures(first: 10) { id } }';
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
});
const data = await response.json();
```

**That's it!** 🚀

