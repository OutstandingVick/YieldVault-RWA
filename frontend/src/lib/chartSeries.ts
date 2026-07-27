export function sampleChartSeries<T>(data: readonly T[], maxPoints: number): T[] {
  if (data.length === 0 || data.length <= maxPoints) {
    return [...data];
  }

  if (maxPoints <= 1) {
    return [data[0]];
  }

  const lastIndex = data.length - 1;
  return Array.from({ length: maxPoints }, (_, index) => {
    const sampleIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    return data[sampleIndex];
  });
}