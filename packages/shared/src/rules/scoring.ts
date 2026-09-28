export interface ScoringWeights {
  priorityWeight?: number; // w1
  historyWeight?: number; // w2
  completenessWeight?: number; // w3
}

export function calculateRecommendationScore(
  priority: number,
  history: { accepted: number; shown: number },
  completeness: number,
  weights: ScoringWeights = {},
): number {
  const w1 = weights.priorityWeight ?? 0.4;
  const w2 = weights.historyWeight ?? 0.4;
  const w3 = weights.completenessWeight ?? 0.2;

  // Normalize priority: 1 is best (1.0), 100 is worst (0.01)
  // Simple normalization: (100 - priority) / 99, or just 1 / priority
  const priorityScore = 1 / Math.max(1, priority);

  // Laplace smoothing for history
  const historyScore = (history.accepted + 1) / (history.shown + 2);

  // Completeness should be between 0 and 1
  const completenessScore = Math.max(0, Math.min(1, completeness));

  return w1 * priorityScore + w2 * historyScore + w3 * completenessScore;
}
