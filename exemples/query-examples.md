# Exemples de Requêtes MongoDB

## Requêtes CRUD de Base

### 1. Créer un nouveau produit
```javascript
db.products.insertOne({
  sku: "LAPTOP-DELL-2025-001",
  name: "Dell XPS 15",
  description: "Laptop haute performance pour professionnels",
  category_id: ObjectId("65c3d4e5f6g7h8i9j0k1l2m3"),
  category_path: "Électronique > Ordinateurs > Laptops",
  price: {
    amount: 1899.00,
    currency: "EUR",
    price_history: []
  },
  inventory: {
    quantity: 250,
    warehouses: [
      {location: "Paris", quantity: 100},
      {location: "Lyon", quantity: 150}
    ]
  },
  images: ["https://cdn.example.com/dell-xps-001.jpg"],
  attributes: {
    brand: "Dell",
    screen_size: "15.6 inches",
    processor: "Intel i7-13700H",
    ram: "16GB",
    storage: "512GB SSD"
  },
  ratings: {average: 0, count: 0},
  analytics: {
    views_count: 0,
    purchases_count: 0,
    cart_adds_count: 0,
    conversion_rate: 0,
    last_30_days_sales: 0,
    trending_score: 0
  },
  tags: ["laptop", "dell", "professionnel"],
  status: "active",
  created_at: new Date(),
  updated_at: new Date()
})
```

### 2. Rechercher des produits
```javascript
// Recherche simple par nom
db.products.find({
  name: {$regex: "MacBook", $options: "i"}
})

// Recherche full-text
db.products.find({
  $text: {$search: "laptop professionnel performance"}
})

// Recherche avec filtres multiples
db.products.find({
  category_path: {$regex: "^Électronique > Ordinateurs"},
  "price.amount": {$gte: 1000, $lte: 3000},
  "inventory.quantity": {$gt: 0},
  status: "active"
}).sort({"analytics.trending_score": -1}).limit(20)
```

### 3. Créer une commande
```javascript
db.orders.insertOne({
  order_number: "ORD-" + new Date().getFullYear() + "-" + 
                new Date().getMonth() + "-" + 
                Math.floor(Math.random() * 1000000),
  shard_date: "2025-02",
  user_id: ObjectId("65a1b2c3d4e5f6g7h8i9j0k1"),
  region: "europe",
  user_snapshot: {
    email: "user@example.com",
    name: {first: "Marie", last: "Martin"},
    phone: "+33612345678"
  },
  items: [
    {
      product_id: ObjectId("65b2c3d4e5f6g7h8i9j0k1l2"),
      product_snapshot: {
        sku: "LAPTOP-MBP-2024-001",
        name: "MacBook Pro 14\"",
        category: "Laptops",
        price: {amount: 2499.00, currency: "EUR"}
      },
      quantity: 1,
      unit_price: 2499.00,
      subtotal: 2499.00
    }
  ],
  pricing: {
    subtotal: 2499.00,
    tax: 499.80,
    shipping: 0.00,
    discount: 0.00,
    total: 2998.80,
    currency: "EUR"
  },
  shipping_address: {
    street: "10 Avenue des Champs",
    city: "Paris",
    postal_code: "75008",
    country: "FR"
  },
  status: "pending",
  payment: {
    method: "credit_card",
    status: "pending",
    transaction_id: null
  },
  tracking: null,
  created_at: new Date(),
  updated_at: new Date(),
  completed_at: null,
  status_history: [
    {
      status: "pending",
      timestamp: new Date(),
      note: "Commande créée"
    }
  ]
})
```

## Requêtes d'Analytics

### 4. Top produits du mois
```javascript
db.orders.aggregate([
  {
    $match: {
      shard_date: "2025-02",
      status: {$in: ["shipped", "delivered"]}
    }
  },
  {
    $unwind: "$items"
  },
  {
    $group: {
      _id: "$items.product_id",
      total_quantity: {$sum: "$items.quantity"},
      total_revenue: {$sum: "$items.subtotal"},
      product_name: {$first: "$items.product_snapshot.name"}
    }
  },
  {
    $sort: {total_revenue: -1}
  },
  {
    $limit: 10
  }
])
```

### 5. Ventes par catégorie
```javascript
db.orders.aggregate([
  {
    $match: {
      created_at: {
        $gte: ISODate("2025-02-01"),
        $lt: ISODate("2025-03-01")
      }
    }
  },
  {
    $unwind: "$items"
  },
  {
    $group: {
      _id: "$items.product_snapshot.category",
      total_sales: {$sum: "$items.subtotal"},
      total_units: {$sum: "$items.quantity"}
    }
  },
  {
    $sort: {total_sales: -1}
  }
])
```

### 6. Taux de conversion par produit
```javascript
db.product_views.aggregate([
  {
    $match: {
      timestamp: {$gte: ISODate("2025-02-01")}
    }
  },
  {
    $group: {
      _id: {
        product_id: "$product_id",
        event_type: "$event_type"
      },
      count: {$sum: 1}
    }
  },
  {
    $group: {
      _id: "$_id.product_id",
      events: {
        $push: {
          type: "$_id.event_type",
          count: "$count"
        }
      }
    }
  },
  {
    $project: {
      product_id: "$_id",
      views: {
        $arrayElemAt: [
          {$filter: {input: "$events", as: "e", cond: {$eq: ["$$e.type", "view"]}}},
          0
        ]
      },
      purchases: {
        $arrayElemAt: [
          {$filter: {input: "$events", as: "e", cond: {$eq: ["$$e.type", "purchase"]}}},
          0
        ]
      }
    }
  },
  {
    $project: {
      product_id: 1,
      view_count: {$ifNull: ["$views.count", 0]},
      purchase_count: {$ifNull: ["$purchases.count", 0]},
      conversion_rate: {
        $cond: {
          if: {$gt: [{$ifNull: ["$views.count", 0]}, 0]},
          then: {
            $divide: [
              {$ifNull: ["$purchases.count", 0]},
              {$ifNull: ["$views.count", 1]}
            ]
          },
          else: 0
        }
      }
    }
  },
  {
    $sort: {conversion_rate: -1}
  }
])
```

### 7. Rapport de ventes journalier
```javascript
db.orders.aggregate([
  {
    $match: {
      created_at: {
        $gte: ISODate("2025-02-13T00:00:00Z"),
        $lt: ISODate("2025-02-14T00:00:00Z")
      }
    }
  },
  {
    $group: {
      _id: null,
      total_orders: {$sum: 1},
      total_revenue: {$sum: "$pricing.total"},
      average_order_value: {$avg: "$pricing.total"},
      unique_customers: {$addToSet: "$user_id"}
    }
  },
  {
    $project: {
      _id: 0,
      total_orders: 1,
      total_revenue: 1,
      average_order_value: 1,
      unique_customers: {$size: "$unique_customers"}
    }
  }
])
```

## Requêtes de Maintenance

### 8. Mettre à jour le stock
```javascript
// Réduire le stock après une vente
db.products.updateOne(
  {sku: "LAPTOP-MBP-2024-001"},
  {
    $inc: {"inventory.quantity": -1},
    $set: {updated_at: new Date()}
  }
)

// Mettre à jour le stock d'un entrepôt spécifique
db.products.updateOne(
  {
    sku: "LAPTOP-MBP-2024-001",
    "inventory.warehouses.location": "Paris"
  },
  {
    $inc: {"inventory.warehouses.$.quantity": -1}
  }
)
```

### 9. Mettre à jour le statut de commande
```javascript
db.orders.updateOne(
  {order_number: "ORD-2025-02-00123456"},
  {
    $set: {
      status: "shipped",
      "tracking.carrier": "Colissimo",
      "tracking.tracking_number": "6A12345678901",
      updated_at: new Date()
    },
    $push: {
      status_history: {
        status: "shipped",
        timestamp: new Date(),
        note: "Expédié depuis Paris"
      }
    }
  }
)
```

### 10. Archiver anciennes données
```javascript
// Marquer les commandes de plus d'un an comme archivées
db.orders.updateMany(
  {
    created_at: {$lt: new Date(Date.now() - 365*24*60*60*1000)},
    status: {$in: ["delivered", "cancelled"]}
  },
  {
    $set: {archived: true}
  }
)
```

## Requêtes Utilisateur

### 11. Historique des commandes d'un utilisateur
```javascript
db.orders.find({
  user_id: ObjectId("65a1b2c3d4e5f6g7h8i9j0k1")
}).sort({created_at: -1}).limit(50)
```

### 12. Produits recommandés basés sur l'historique
```javascript
// Trouver les catégories fréquemment achetées par l'utilisateur
db.orders.aggregate([
  {
    $match: {
      user_id: ObjectId("65a1b2c3d4e5f6g7h8i9j0k1"),
      status: {$in: ["delivered"]}
    }
  },
  {
    $unwind: "$items"
  },
  {
    $group: {
      _id: "$items.product_snapshot.category",
      purchase_count: {$sum: 1}
    }
  },
  {
    $sort: {purchase_count: -1}
  },
  {
    $limit: 3
  }
])

// Puis chercher des produits similaires
db.products.find({
  category_path: {$regex: "Laptops"},
  _id: {$nin: [/* IDs déjà achetés */]},
  "inventory.quantity": {$gt: 0}
}).sort({"analytics.trending_score": -1}).limit(10)
```

## Requêtes de Performance

### 13. Produits à faible stock
```javascript
db.products.find({
  "inventory.quantity": {$lt: 10, $gt: 0},
  status: "active"
}).sort({"analytics.last_30_days_sales": -1})
```

### 14. Commandes bloquées
```javascript
db.orders.find({
  status: "processing",
  created_at: {$lt: new Date(Date.now() - 24*60*60*1000)}
})
```

### 15. Utilisation des index
```javascript
// Analyser l'exécution d'une requête
db.products.find({
  "price.amount": {$lte: 2000},
  category_id: ObjectId("...")
}).explain("executionStats")
```

## Requêtes Sharding

### 16. Statistiques par shard
```javascript
// Requête optimale - sur un seul shard (shard_date)
db.orders.find({
  shard_date: "2025-02",
  status: "delivered"
})

// Requête non-optimale - scatter-gather sur tous les shards
db.orders.find({
  user_id: ObjectId("...")
})
```

### 17. Distribution des données
```javascript
// Voir la distribution des chunks par shard
db.orders.getShardDistribution()

// Voir les stats par shard
sh.status()
```

## Notes d'Optimisation

### Index composés recommandés
```javascript
// Pour recherche produits avec filtres
db.products.createIndex({
  category_id: 1,
  "price.amount": 1,
  "analytics.trending_score": -1
})

// Pour historique utilisateur
db.orders.createIndex({
  user_id: 1,
  created_at: -1
})

// Pour analytics temporels
db.orders.createIndex({
  shard_date: 1,
  status: 1,
  created_at: 1
})
```

### Write Concern pour différents cas
```javascript
// Commande (consistance forte requise)
db.orders.insertOne(order, {writeConcern: {w: "majority"}})

// Produit (eventual consistency OK)
db.products.updateOne(filter, update, {writeConcern: {w: 1}})

// Analytics (peut être perdu et régénéré)
db.analytics_daily.insertOne(data, {writeConcern: {w: 0}})
```
