export const DEFAULT_JPY_RATE = 150;
export const DEFAULT_USAGE_MODEL = 'gemini-2.5-flash-lite';

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-3.1-pro-preview': { input: 2, output: 12 },
  'gemini-1.5-flash': { input: 0.15, output: 0.6 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
};

const MODEL_ALIASES = Object.keys(MODEL_PRICING).sort((left, right) => right.length - left.length);

function resolvePricingModel(model: string) {
  if (MODEL_PRICING[model]) {
    return model;
  }

  return MODEL_ALIASES.find((candidate) => model.startsWith(candidate));
}

export function hasModelPricing(model: string) {
  return Boolean(resolvePricingModel(model));
}

export function getModelPricing(model: string) {
  const resolvedModel = resolvePricingModel(model);
  return MODEL_PRICING[resolvedModel ?? DEFAULT_USAGE_MODEL];
}

export function calculateUsageCostUsd(
  model: string,
  inputTokens?: number | null,
  outputTokens?: number | null,
): number {
  const pricing = getModelPricing(model);
  const normalizedInputTokens = inputTokens ?? 0;
  const normalizedOutputTokens = outputTokens ?? 0;
  const inputCost = (normalizedInputTokens / 1_000_000) * pricing.input;
  const outputCost = (normalizedOutputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function usdToJpy(usd: number, rate: number = DEFAULT_JPY_RATE): number {
  return Math.round(usd * rate);
}
