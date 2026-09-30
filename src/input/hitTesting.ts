import type { Point } from '../rendering/camera/coordinates';

export function containsCircle(point: Point, center: Point, radius: number): boolean {
  'worklet';
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return dx * dx + dy * dy <= radius * radius;
}
