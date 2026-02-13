# Décisions de Conception Détaillées

## Choix de MongoDB comme base NoSQL

### Justification
MongoDB a été choisi comme système de base de données principal pour plusieurs raisons :

1. **Modèle document flexible** : Permet d'évoluer le schéma sans migrations complexes
2. **Performance native** : Excellentes performances en lecture/écriture pour des milliers de transactions/seconde
3. **Sharding intégré** : Support natif du partitionnement horizontal
4. **Réplication robuste** : Replica sets avec failover automatique
5. **Aggregation framework** : Pipeline puissant pour analytics

### Alternatives considérées
- **Cassandra** : Excellente pour écriture massive, mais complexe pour requêtes flexibles
- **DynamoDB** : Bon choix cloud, mais moins flexible pour aggregations complexes
- **Couchbase** : Viable, mais écosystème moins mature

## Architecture Hybride

### Design Initial
```
┌─────────────┐
│   MongoDB   │ ← Base principale (Users, Products, Orders)
└─────────────┘
      ↓
┌─────────────┐
│    Redis    │ ← Cache layer (sessions, produits populaires)
└─────────────┘
      ↓
┌─────────────┐
│Elasticsearch│ ← Recherche full-text avancée
└─────────────┘
```

### Design Refactorisé
```
                    ┌──────────────────┐
                    │  Load Balancer   │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     ┌───────────┐    ┌───────────┐    ┌───────────┐
     │  Shard 1  │    │  Shard 2  │    │  Shard 3  │
     │ (Europe)  │    │ (Americas)│    │   (Asia)  │
     └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
           │                │                │
    ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
    │ Primary     │  │ Primary     │  │ Primary     │
    │ Secondary1  │  │ Secondary1  │  │ Secondary1  │
    │ Secondary2  │  │ Secondary2  │  │ Secondary2  │
    └─────────────┘  └─────────────┘  └─────────────┘
```

## Stratégies de Sharding

### 1. Users - Sharding géographique
**Clé de shard** : `region`

**Avantages** :
- Latence réduite (données proches des utilisateurs)
- Conformité réglementaire (RGPD, résidence des données)
- Isolation naturelle par marché

**Exemple** :
```javascript
// Europe shard
{region: "europe", email: "user@example.fr"}

// Americas shard  
{region: "americas", email: "user@example.com"}
```

### 2. Products - Sharding par SKU (hashed)
**Clé de shard** : `sku` (hashed)

**Avantages** :
- Distribution uniforme automatique
- Pas de hotspots
- Scalabilité linéaire

**Exemple** :
```javascript
// Le hash du SKU détermine le shard
{sku: "PROD-12345", name: "Laptop"}
```

### 3. Orders - Sharding temporel
**Clé de shard** : `shard_date` (YYYY-MM)

**Avantages** :
- Queries analytics ciblées sur périodes
- Archivage simplifié (shards anciens en read-only)
- Optimisation pour rapports mensuels/trimestriels

**Exemple** :
```javascript
{
  shard_date: "2025-02",  // Toutes commandes février 2025 sur même shard
  order_number: "ORD-98765",
  created_at: ISODate("2025-02-13")
}
```

## Modèle de Cohérence (Consistency Model)

### Niveau collection

| Collection | Read Concern | Write Concern | Rationale |
|-----------|--------------|---------------|-----------|
| users | local | w:1 | Performance, eventual consistency OK |
| products | local | w:1 | Catalogue non-critique |
| orders | majority | w:majority | Cohérence forte requise |
| analytics_* | local | w:1 | Données dérivées, peuvent être régénérées |

### Trade-offs acceptés

**Eventual Consistency pour le catalogue** :
- Un produit modifié peut prendre 1-2 secondes pour se propager
- Acceptable car les prix changent rarement
- Cache Redis compense avec TTL court

**Strong Consistency pour les commandes** :
- Garantit qu'une commande validée est visible immédiatement
- Critique pour éviter survente
- Performance légèrement réduite, mais nécessaire

## Dénormalisation Stratégique

### Principe
Dupliquer les données fréquemment lues ensemble pour éviter les jointures.

### Cas d'usage

#### 1. User snapshot dans Orders
```javascript
{
  order_number: "ORD-001",
  user_id: ObjectId("..."),
  user_snapshot: {
    email: "user@example.com",
    name: {first: "Jean", last: "Dupont"},
    phone: "+33612345678"
  }
}
```
**Avantage** : Afficher une commande sans requête supplémentaire vers users
**Coût** : +200 bytes par commande

#### 2. Product snapshot dans Orders
```javascript
{
  items: [{
    product_id: ObjectId("..."),
    product_snapshot: {
      sku: "LAPTOP-001",
      name: "MacBook Pro",
      price: {amount: 1999.99, currency: "EUR"}
    }
  }]
}
```
**Avantage** : Historique des prix au moment de l'achat
**Coût** : +300 bytes par item

#### 3. Métriques agrégées dans Products
```javascript
{
  sku: "LAPTOP-001",
  analytics: {
    views_count: 15420,
    purchases_count: 342,
    conversion_rate: 0.022,
    last_30_days_sales: 89
  }
}
```
**Avantage** : Affichage instantané sans calcul
**Coût** : +100 bytes, mis à jour async

## Indexes et Performance

### Stratégie d'indexation

**Règle d'or** : Indexer les champs utilisés dans :
1. Clauses WHERE (filtrage)
2. Clauses ORDER BY (tri)
3. Clauses JOIN (lookups)

### Index critiques

```javascript
// Products - recherche et filtrage
db.products.createIndex({name: "text", description: "text"})
db.products.createIndex({category_id: 1, "price.amount": 1})
db.products.createIndex({sku: 1}, {unique: true})

// Orders - requêtes utilisateur
db.orders.createIndex({user_id: 1, created_at: -1})
db.orders.createIndex({order_number: 1}, {unique: true})
db.orders.createIndex({status: 1})

// Analytics - time-series
db.product_views.createIndex({timestamp: 1}, {expireAfterSeconds: 7776000}) // 90 jours
db.analytics_daily.createIndex({date: 1, region: 1})
```

### Index composés pour queries complexes

```javascript
// "Trouver produits d'une catégorie, prix < 1000€, triés par popularité"
db.products.createIndex({
  category_id: 1,
  "price.amount": 1,
  "analytics.trending_score": -1
})
```

## Gestion de la Haute Vélocité

### Problem
L'e-commerce génère des millions d'événements par jour :
- Vues de produits
- Ajouts au panier
- Achats
- Tracking de livraison

### Solution : Pattern Time-Series

```javascript
// Collection product_views avec TTL
{
  _id: ObjectId("..."),
  product_id: ObjectId("..."),
  event_type: "view",
  timestamp: ISODate("2025-02-13T14:30:00Z"),
  // ... metadata
}

// Index TTL - suppression automatique après 90 jours
db.product_views.createIndex(
  {timestamp: 1}, 
  {expireAfterSeconds: 7776000}
)
```

**Avantages** :
- Insertion ultra-rapide (pas de checks complexes)
- Archivage automatique (pas de batch cleanup)
- Queries analytics efficaces sur fenêtre glissante

### Aggregation Pipeline pour Analytics

```javascript
// Calcul des top produits des 7 derniers jours
db.product_views.aggregate([
  {$match: {
    event_type: "purchase",
    timestamp: {$gte: ISODate("2025-02-06")}
  }},
  {$group: {
    _id: "$product_id",
    count: {$sum: 1}
  }},
  {$sort: {count: -1}},
  {$limit: 10},
  {$lookup: {
    from: "products",
    localField: "_id",
    foreignField: "_id",
    as: "product"
  }}
])
```

## Stratégie de Cache

### Redis Layer
```
┌──────────────────────┐
│  Application Server  │
└──────────┬───────────┘
           │
    ┌──────▼──────┐
    │ Check Redis │
    └──────┬──────┘
           │
    ┌──────▼──────────────┐
    │ Cache Hit?          │
    │  Yes → Return       │
    │  No  → Query MongoDB│
    └─────────────────────┘
```

### Données cachées
- **Sessions utilisateurs** : TTL 30 minutes
- **Top 1000 produits** : TTL 5 minutes
- **Catégories** : TTL 1 heure (changent rarement)
- **Panier actif** : TTL 24 heures

### Cache invalidation
```javascript
// Invalidation lors de mise à jour produit
async function updateProduct(sku, updates) {
  await db.products.updateOne({sku}, {$set: updates})
  await redis.del(`product:${sku}`)  // Invalidation
  await elasticsearch.update({sku, ...updates})  // Sync search
}
```

## Monitoring et Maintenance

### Métriques clés à surveiller

1. **Replication Lag** : Doit rester < 1 seconde
2. **Shard Balance** : Chunks doivent être équilibrés (±10%)
3. **Query Performance** : P95 latency < 100ms
4. **Disk Usage** : Alerter à 70% capacité
5. **Connection Pool** : Surveiller utilisation

### Jobs de maintenance

```javascript
// Nightly job - Analytics daily
0 2 * * * node scripts/generate-daily-analytics.js

// Weekly job - Analytics monthly (1er du mois)
0 3 1 * * node scripts/generate-monthly-analytics.js

// Hourly job - Sync product analytics
0 * * * * node scripts/sync-product-metrics.js
```

## Sécurité et Conformité

### Encryption
- **At rest** : MongoDB encryption des fichiers de données
- **In transit** : TLS 1.3 obligatoire
- **Credentials** : Stockage dans vault (HashiCorp Vault)

### RGPD Compliance
- **Data residency** : Zone sharding (données EU en EU)
- **Right to erasure** : Script de suppression complète
- **Data portability** : Export JSON des données utilisateur

### Backup Strategy
- **Full backup** : Quotidien via mongodump
- **Incremental** : Oplog replay continu
- **Retention** : 30 jours online, 1 an archive
- **Testing** : Restore test mensuel

## Évolution Future

### Scaling Horizontal
Le design permet d'ajouter facilement des shards :
```
3 shards (10M users) → 6 shards (20M users) → 12 shards (40M users)
```

### Migration vers Cloud
Architecture compatible avec :
- **MongoDB Atlas** : Managed service
- **AWS DocumentDB** : Alternative compatible
- **Azure Cosmos DB** : API MongoDB

### Optimisations futures
- **GraphQL API** : Réduire over-fetching
- **Event Sourcing** : Pour audit trail complet
- **CQRS** : Séparer read/write models pour analytics
