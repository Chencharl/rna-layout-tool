export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function getBounds(
  points: Array<{ x: number; y: number }>,
  padding = 24,
): Bounds {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    minX: Math.min(...xs) - padding,
    minY: Math.min(...ys) - padding,
    maxX: Math.max(...xs) + padding,
    maxY: Math.max(...ys) + padding,
  };
}
