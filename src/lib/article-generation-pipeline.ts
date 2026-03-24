export const CURRENT_GENERATION_PIPELINE_VERSION = 'stable-v1';
export const LEGACY_GENERATION_PIPELINE_VERSION = 'legacy';

export type CostDistribution = {
  count: number;
  min: number | null;
  p50: number | null;
  p90: number | null;
  max: number | null;
};

export function normalizeGenerationPipelineVersion(version?: string | null): string {
  const trimmed = version?.trim();
  return trimmed || LEGACY_GENERATION_PIPELINE_VERSION;
}

function pickPercentile(sortedCosts: number[], percentile: number): number | null {
  if (!sortedCosts.length) return null;
  const index = Math.min(
    sortedCosts.length - 1,
    Math.floor((sortedCosts.length - 1) * percentile),
  );
  return sortedCosts[index];
}

export function computeCostDistribution(costs: number[]): CostDistribution {
  const normalizedCosts = costs
    .filter((cost): cost is number => Number.isFinite(cost))
    .sort((left, right) => left - right);

  if (!normalizedCosts.length) {
    return {
      count: 0,
      min: null,
      p50: null,
      p90: null,
      max: null,
    };
  }

  return {
    count: normalizedCosts.length,
    min: normalizedCosts[0],
    p50: pickPercentile(normalizedCosts, 0.5),
    p90: pickPercentile(normalizedCosts, 0.9),
    max: normalizedCosts[normalizedCosts.length - 1],
  };
}
