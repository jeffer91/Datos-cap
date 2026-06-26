function calculateIntervals(events = []) {
  const sorted = [...events].sort((a, b) => a.start_seconds - b.start_seconds);
  const intervals = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const interval = Number((current.start_seconds - previous.start_seconds).toFixed(3));
    if (interval >= 0) intervals.push(interval);
  }
  return intervals;
}

function average(numbers = []) {
  if (!numbers.length) return null;
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return Number((total / numbers.length).toFixed(3));
}

function median(numbers = []) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(3));
  }
  return Number(sorted[middle].toFixed(3));
}

function calculateCutsPerMinute(cutCount, durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) return null;
  const minutes = durationSeconds / 60;
  if (minutes <= 0) return null;
  return Number((cutCount / minutes).toFixed(3));
}

function analyzeCutFrequency({ events = [], durationSeconds = null }) {
  const intervals = calculateIntervals(events);
  const cutCount = events.length;
  return {
    cutCount,
    intervals,
    averageCutSeconds: average(intervals),
    medianCutSeconds: median(intervals),
    shortestIntervalSeconds: intervals.length ? Math.min(...intervals) : null,
    longestIntervalSeconds: intervals.length ? Math.max(...intervals) : null,
    cutsPerMinute: calculateCutsPerMinute(cutCount, durationSeconds)
  };
}

module.exports = { calculateIntervals, analyzeCutFrequency };
