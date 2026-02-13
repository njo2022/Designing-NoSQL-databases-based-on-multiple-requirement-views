# Projet NoSQL E-Commerce

## Vue d'ensemble
Conception d'une base de données NoSQL pour une application e-commerce capable de gérer des milliers de transactions par seconde, avec support pour les analyses en temps réel et haute disponibilité.

## Structure du projet

```
nosql-ecommerce-project/
├── schemas/
│   ├── initial-design.json          # Schéma initial (MongoDB)
│   └── refactored-design.json       # Schéma refactorisé
├── exemples/
│   ├── sample-data.json             # Données d'exemple
│   └── query-examples.md            # Exemples de requêtes
├── docs/
│   ├── design-decisions.md          # Décisions de conception
│   └── reflection-report.md         # Rapport de réflexion
└── README.md
```

## Technologies choisies

- **Base de données principale**: MongoDB (Document-oriented)
- **Raison**: Flexibilité du schéma, performance élevée en lecture/écriture, support natif du sharding et de la réplication
- **Compléments**: Redis (cache), Elasticsearch (recherche full-text)

## Partie 1: Design Initial

### Entités principales
- **Users**: Profils utilisateurs
- **Products**: Catalogue de produits
- **Orders**: Commandes avec détails complets
- **Categories**: Classification des produits

### Caractéristiques
- Index optimisés pour recherches rapides
- Dénormalisation stratégique pour performance
- Support de milliers de transactions/seconde

## Partie 2: Design Refactorisé

### Nouvelles exigences
1. Analyses à grande échelle (tendances, ventes)
2. Haute disponibilité et tolérance aux partitions

### Stratégies implémentées
- **Sharding**: Distribution des données par région géographique
- **Réplication**: Ensemble de répliques (3+ nœuds)
- **Dénormalisation**: Données pré-agrégées pour analytics

## Démarrage rapide

Consultez les fichiers suivants dans l'ordre:
1. `schemas/initial-design.json` - Schéma de base
2. `schemas/refactored-design.json` - Schéma optimisé
3. `docs/design-decisions.md` - Explications détaillées
4. `docs/reflection-report.md` - Analyse et réflexion

