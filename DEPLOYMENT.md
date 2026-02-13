# Guide de Déploiement et Utilisation

## Publication sur GitHub

### 1. Initialiser le repository
```bash
cd nosql-ecommerce-project
git init
git add .
git commit -m "Initial commit: Projet NoSQL E-Commerce"
```

### 2. Créer le repository sur GitHub
```bash
# Sur GitHub.com, créer un nouveau repository
# Puis lier au repository local:
git remote add origin https://github.com/VOTRE-USERNAME/nosql-ecommerce-project.git
git branch -M main
git push -u origin main
```

## Déploiement MongoDB (Production-Ready)

### Option 1: MongoDB Atlas (Recommandé)

#### Configuration initiale
```bash
1. Créer un compte sur mongodb.com/atlas
2. Créer un cluster M10 ou supérieur (pour sharding)
3. Activer le sharding dans Database Deployments
```

#### Configuration du sharding
```javascript
// Connecter au cluster via mongosh
mongosh "mongodb+srv://cluster.xxxxx.mongodb.net" --username admin

// Activer le sharding sur la database
sh.enableSharding("ecommerce_db")

// Sharder la collection users par région
sh.shardCollection("ecommerce_db.users", {region: "hashed"})

// Sharder la collection products par SKU
sh.shardCollection("ecommerce_db.products", {sku: "hashed"})

// Sharder la collection orders par date
sh.shardCollection("ecommerce_db.orders", {shard_date: 1})

// Configurer les zones géographiques
sh.addShardTag("shard0000", "europe")
sh.addShardTag("shard0001", "americas")
sh.addShardTag("shard0002", "asia")

// Définir les ranges pour zone sharding
sh.addTagRange(
  "ecommerce_db.users",
  {region: "europe"},
  {region: "europe"},
  "europe"
)
```

### Option 2: Self-Hosted avec Docker

#### docker-compose.yml
```yaml
version: '3.8'

services:
  # Config servers
  config1:
    image: mongo:7.0
    command: mongod --configsvr --replSet configRS --port 27019
    volumes:
      - config1:/data/configdb

  config2:
    image: mongo:7.0
    command: mongod --configsvr --replSet configRS --port 27019
    volumes:
      - config2:/data/configdb

  config3:
    image: mongo:7.0
    command: mongod --configsvr --replSet configRS --port 27019
    volumes:
      - config3:/data/configdb

  # Shard 1 replica set
  shard1-1:
    image: mongo:7.0
    command: mongod --shardsvr --replSet shard1RS --port 27018
    volumes:
      - shard1-1:/data/db

  shard1-2:
    image: mongo:7.0
    command: mongod --shardsvr --replSet shard1RS --port 27018
    volumes:
      - shard1-2:/data/db

  shard1-3:
    image: mongo:7.0
    command: mongod --shardsvr --replSet shard1RS --port 27018
    volumes:
      - shard1-3:/data/db

  # Shard 2 replica set
  shard2-1:
    image: mongo:7.0
    command: mongod --shardsvr --replSet shard2RS --port 27018
    volumes:
      - shard2-1:/data/db

  shard2-2:
    image: mongo:7.0
    command: mongod --shardsvr --replSet shard2RS --port 27018
    volumes:
      - shard2-2:/data/db

  shard2-3:
    image: mongo:7.0
    command: mongod --shardsvr --replSet shard2RS --port 27018
    volumes:
      - shard2-3:/data/db

  # Router (mongos)
  mongos:
    image: mongo:7.0
    command: mongos --configdb configRS/config1:27019,config2:27019,config3:27019 --bind_ip_all
    ports:
      - "27017:27017"
    depends_on:
      - config1
      - config2
      - config3

  # Redis cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis:/data

  # Elasticsearch
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch:/usr/share/elasticsearch/data

volumes:
  config1:
  config2:
  config3:
  shard1-1:
  shard1-2:
  shard1-3:
  shard2-1:
  shard2-2:
  shard2-3:
  redis:
  elasticsearch:
```

#### Démarrer le cluster
```bash
# Lancer tous les services
docker-compose up -d

# Attendre 30 secondes que tout démarre

# Initialiser les replica sets
docker exec -it $(docker ps -qf "name=config1") mongosh --port 27019 --eval "
rs.initiate({
  _id: 'configRS',
  configsvr: true,
  members: [
    {_id: 0, host: 'config1:27019'},
    {_id: 1, host: 'config2:27019'},
    {_id: 2, host: 'config3:27019'}
  ]
})
"

docker exec -it $(docker ps -qf "name=shard1-1") mongosh --port 27018 --eval "
rs.initiate({
  _id: 'shard1RS',
  members: [
    {_id: 0, host: 'shard1-1:27018'},
    {_id: 1, host: 'shard1-2:27018'},
    {_id: 2, host: 'shard1-3:27018'}
  ]
})
"

docker exec -it $(docker ps -qf "name=shard2-1") mongosh --port 27018 --eval "
rs.initiate({
  _id: 'shard2RS',
  members: [
    {_id: 0, host: 'shard2-1:27018'},
    {_id: 1, host: 'shard2-2:27018'},
    {_id: 2, host: 'shard2-3:27018'}
  ]
})
"

# Ajouter les shards au cluster
docker exec -it $(docker ps -qf "name=mongos") mongosh --eval "
sh.addShard('shard1RS/shard1-1:27018,shard1-2:27018,shard1-3:27018')
sh.addShard('shard2RS/shard2-1:27018,shard2-2:27018,shard2-3:27018')
"
```

## Charger les données initiales

### Script de seed
```javascript
// seed.js
const { MongoClient } = require('mongodb');

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function seed() {
  try {
    await client.connect();
    const db = client.db("ecommerce_db");
    
    // Activer le sharding
    await client.db("admin").command({ enableSharding: "ecommerce_db" });
    
    // Créer les collections avec validation
    await db.createCollection("users", {
      validator: {
        $jsonSchema: {
          required: ["email", "region", "name"],
          properties: {
            email: { bsonType: "string" },
            region: { bsonType: "string" }
          }
        }
      }
    });
    
    // Sharder les collections
    await client.db("admin").command({
      shardCollection: "ecommerce_db.users",
      key: { region: "hashed" }
    });
    
    await client.db("admin").command({
      shardCollection: "ecommerce_db.products",
      key: { sku: "hashed" }
    });
    
    await client.db("admin").command({
      shardCollection: "ecommerce_db.orders",
      key: { shard_date: 1 }
    });
    
    // Créer les index
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("products").createIndex({ sku: 1 }, { unique: true });
    await db.collection("products").createIndex({ name: "text", description: "text" });
    await db.collection("orders").createIndex({ order_number: 1 }, { unique: true });
    await db.collection("orders").createIndex({ user_id: 1, created_at: -1 });
    
    console.log("✅ Database initialized successfully!");
    
  } finally {
    await client.close();
  }
}

seed();
```

### Exécuter le seed
```bash
npm install mongodb
node seed.js
```

## Scripts de maintenance

### Génération des analytics quotidiennes
```javascript
// scripts/generate-daily-analytics.js
const { MongoClient } = require('mongodb');

async function generateDailyAnalytics() {
  const client = new MongoClient("mongodb://localhost:27017");
  
  try {
    await client.connect();
    const db = client.db("ecommerce_db");
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date(yesterday);
    today.setDate(today.getDate() + 1);
    
    // Agréger les données du jour
    const pipeline = [
      {
        $match: {
          created_at: { $gte: yesterday, $lt: today },
          status: { $in: ["delivered", "shipped"] }
        }
      },
      {
        $group: {
          _id: "$region",
          total_orders: { $sum: 1 },
          total_revenue: { $sum: "$pricing.total" },
          average_order_value: { $avg: "$pricing.total" },
          unique_customers: { $addToSet: "$user_id" }
        }
      }
    ];
    
    const results = await db.collection("orders").aggregate(pipeline).toArray();
    
    // Insérer dans analytics_daily
    for (const result of results) {
      await db.collection("analytics_daily").insertOne({
        date: yesterday,
        region: result._id,
        metrics: {
          total_orders: result.total_orders,
          total_revenue: result.total_revenue,
          average_order_value: result.average_order_value,
          unique_customers: result.unique_customers.length
        },
        generated_at: new Date()
      });
    }
    
    console.log(`✅ Generated analytics for ${yesterday.toISOString().split('T')[0]}`);
    
  } finally {
    await client.close();
  }
}

generateDailyAnalytics();
```

### Cron jobs (Linux)
```bash
# Éditer crontab
crontab -e

# Ajouter:
# Analytics quotidiennes à 2h du matin
0 2 * * * cd /path/to/project && node scripts/generate-daily-analytics.js

# Analytics mensuelles le 1er de chaque mois à 3h
0 3 1 * * cd /path/to/project && node scripts/generate-monthly-analytics.js

# Sync des métriques produits toutes les heures
0 * * * * cd /path/to/project && node scripts/sync-product-metrics.js
```

## Monitoring

### Prometheus + Grafana

#### prometheus.yml
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mongodb'
    static_configs:
      - targets: ['localhost:9216']  # mongodb_exporter
  
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']  # redis_exporter
```

### Métriques clés à surveiller
```
# MongoDB
- mongodb_ss_connections{state="current"}
- mongodb_ss_opcounters_total
- mongodb_ss_wt_cache_bytes_currently_in_the_cache
- mongodb_rs_members_health

# Redis
- redis_connected_clients
- redis_memory_used_bytes
- redis_keyspace_hits_total
- redis_keyspace_misses_total

# Application
- http_requests_total
- http_request_duration_seconds
- order_creation_total
- product_search_duration_seconds
```

## Tests de charge

### Apache JMeter
```xml
<!-- test-plan.jmx -->
<jmeterTestPlan>
  <ThreadGroup>
    <stringProp name="ThreadGroup.num_threads">1000</stringProp>
    <stringProp name="ThreadGroup.ramp_time">60</stringProp>
    
    <HTTPSamplerProxy>
      <stringProp name="HTTPSampler.domain">localhost</stringProp>
      <stringProp name="HTTPSampler.port">3000</stringProp>
      <stringProp name="HTTPSampler.path">/api/products/search</stringProp>
    </HTTPSamplerProxy>
  </ThreadGroup>
</jmeterTestPlan>
```

### Artillery (Alternative)
```yaml
# load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 100
      name: "Warm up"
    - duration: 300
      arrivalRate: 1000
      name: "Sustained load"

scenarios:
  - name: "Search products"
    flow:
      - get:
          url: "/api/products/search?q=laptop"
  
  - name: "Create order"
    flow:
      - post:
          url: "/api/orders"
          json:
            user_id: "{{ $randomString() }}"
            items: [...]
```

## Sécurité

### Configuration MongoDB sécurisée
```javascript
// Créer des utilisateurs avec rôles appropriés
use admin
db.createUser({
  user: "appUser",
  pwd: "STRONG_PASSWORD",
  roles: [
    { role: "readWrite", db: "ecommerce_db" }
  ]
})

db.createUser({
  user: "analyticsUser",
  pwd: "STRONG_PASSWORD",
  roles: [
    { role: "read", db: "ecommerce_db" }
  ]
})

// Activer l'authentification
// Dans mongod.conf:
security:
  authorization: enabled
```

### Variables d'environnement
```bash
# .env (ne JAMAIS commiter!)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ecommerce_db
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

## Backup et Recovery

### Backup automatique
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb/$DATE"

# Backup MongoDB
mongodump --uri="mongodb://localhost:27017/ecommerce_db" --out="$BACKUP_DIR"

# Compression
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# Upload vers S3 (optionnel)
aws s3 cp "$BACKUP_DIR.tar.gz" s3://your-bucket/backups/

# Nettoyage (garder 30 jours)
find /backups/mongodb -name "*.tar.gz" -mtime +30 -delete
```

### Restore
```bash
# Restaurer depuis un backup
mongorestore --uri="mongodb://localhost:27017" --archive=/backups/mongodb/20250213.tar.gz
```

