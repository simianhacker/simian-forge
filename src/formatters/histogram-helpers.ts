/**
 * Shared histogram value builders for Elasticsearch histogram field types.
 */

export function buildHistogramValue(value: number): {
  values: number[];
  counts: number[];
} {
  const base = Math.abs(value % 1000) || 1;
  return {
    values: [base * 0.5, base * 0.75, base, base * 1.25, base * 1.5],
    counts: [1, 2, 4, 2, 1],
  };
}

export function buildTdigestValue(value: number): {
  centroids: number[];
  counts: number[];
} {
  const base = Math.abs(value % 1000) || 1;
  return {
    centroids: [base * 0.5, base * 0.75, base, base * 1.25, base * 1.5],
    counts: [1, 2, 4, 2, 1],
  };
}

export function buildExponentialHistogramValue(
  value: number,
): Record<string, unknown> {
  const base = Math.abs(value % 1000) || 1;
  return {
    scale: 3,
    sum: base * 10,
    min: base * 0.5,
    max: base * 1.5,
    zero: { threshold: 0, count: 0 },
    positive: {
      indices: [0, 1, 2, 3, 4],
      counts: [1, 2, 4, 2, 1],
    },
    negative: {
      indices: [],
      counts: [],
    },
  };
}

/**
 * Formats a numeric value into the correct shape for a given Elasticsearch field type.
 */
export function formatValueForFieldType(
  fieldType: string,
  value: number,
): unknown {
  switch (fieldType) {
    case "exponential_histogram":
      return buildExponentialHistogramValue(value);
    case "tdigest":
      return buildTdigestValue(value);
    case "histogram":
      return buildHistogramValue(value);
    default:
      return value;
  }
}
