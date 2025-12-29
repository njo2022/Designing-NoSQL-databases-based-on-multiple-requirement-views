// Implémentation de l'algorithme de Dijkstra pour un graphe pondéré représenté par un objet d'adjacence.
// Les commentaires sont en français pour expliciter chaque étape clé.

/**
 * Calcule les plus courts chemins depuis un sommet de départ vers tous les autres sommets du graphe.
 * @param {Record<string, Record<string, number>>} graph - Graphe pondéré : chaque clé est un sommet, chaque valeur une map des voisins et de leurs poids.
 * @param {string} start - Sommet de départ.
 * @returns {Record<string, number>} Dictionnaire des distances minimales depuis start vers chaque sommet.
 */
function dijkstra(graph, start) {
  if (graph == null || typeof graph !== 'object') {
    throw new Error("Graphe invalide : un objet d'adjacence est attendu.");
  }
  if (!(start in graph)) {
    throw new Error("Sommet de départ absent du graphe.");
  }

  // Initialisation des distances à l'infini et du sommet de départ à 0.
  const distances = {};
  for (const vertex of Object.keys(graph)) {
    distances[vertex] = Infinity;
  }
  distances[start] = 0;

  const visited = new Set();
  // File de priorité minimale simple (triée à chaque itération pour la clarté plutôt que pour la performance pure).
  const queue = [{ vertex: start, distance: 0 }];

  while (queue.length > 0) {
    // Extraction du sommet non visité le plus proche.
    queue.sort((a, b) => a.distance - b.distance);
    const { vertex, distance } = queue.shift();
    if (visited.has(vertex)) {
      continue; // On ignore les entrées obsolètes.
    }
    visited.add(vertex);

    // Détente des arêtes vers chaque voisin.
    const neighbors = graph[vertex] || {};
    for (const neighbor of Object.keys(neighbors)) {
      const weight = neighbors[neighbor];
      const candidate = distance + weight;
      if (candidate < distances[neighbor]) {
        distances[neighbor] = candidate;
        queue.push({ vertex: neighbor, distance: candidate });
      }
    }
  }

  return distances;
}

// Export pour réutilisation dans d'autres modules.
module.exports = { dijkstra };

// Exemple minimal d'utilisation (exécuté uniquement si le fichier est lancé directement).
if (require.main === module) {
  const graph = {
    A: { B: 4, C: 2 },
    B: { A: 4, C: 5, D: 10 },
    C: { A: 2, B: 5, D: 3 },
    D: { B: 10, C: 3 },
  };

  console.log('Distances depuis A :', dijkstra(graph, 'A'));
}
