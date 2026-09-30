export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** Camera contract: screen = world * scale + translation. */
export function worldToScreen(point: Point, camera: Camera): Point {
  'worklet';
  return { x: point.x * camera.scale + camera.x, y: point.y * camera.scale + camera.y };
}

export function screenToWorld(point: Point, camera: Camera): Point {
  'worklet';
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale };
}

export function zoomAt(camera: Camera, anchor: Point, scale: number): Camera {
  'worklet';
  const world = screenToWorld(anchor, camera);
  return { x: anchor.x - world.x * scale, y: anchor.y - world.y * scale, scale };
}

export function fitWorld(width: number, height: number, worldWidth: number, worldHeight: number): Camera {
  'worklet';
  const scale = Math.max(0.01, Math.min(width / worldWidth, height / worldHeight) * 0.9);
  return { x: (width - worldWidth * scale) / 2, y: (height - worldHeight * scale) / 2, scale };
}
