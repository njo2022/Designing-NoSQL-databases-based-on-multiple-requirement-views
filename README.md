# Algorithme de Dijkstra en JavaScript

## Qu'est-ce que l'algorithme de Dijkstra ?
Dijkstra est un algorithme de plus court chemin sur un graphe pondéré à poids non négatifs. Il part d'un sommet source, maintient une distance minimale provisoire pour chaque sommet, puis sélectionne itérativement le sommet non visité avec la plus petite distance connue pour détendre ses arêtes. Le résultat est la distance minimale de la source vers chaque sommet atteignable.

## Structure du projet
- `dijkstra.js` : implémentation de l'algorithme et exemple d'utilisation.

## Prérequis
- Node.js installé (version 14+ recommandée).

## Installation
Aucune dépendance externe n'est requise. Placez-vous simplement dans le dossier du projet.

## Exécution de l'exemple inclus
```bash
node dijkstra.js
```
La commande affiche les distances calculées depuis le sommet `A` pour le graphe d'exemple défini dans `dijkstra.js`.

## Utilisation dans un autre module
```javascript
const { dijkstra } = require('./dijkstra');

const graph = {
  A: { B: 4, C: 2 },
  B: { A: 4, C: 5, D: 10 },
  C: { A: 2, B: 5, D: 3 },
  D: { B: 10, C: 3 },
};

const distances = dijkstra(graph, 'A');
console.log(distances);
```
