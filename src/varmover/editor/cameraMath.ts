export interface CameraTransformState {
  x: number;
  y: number;
  zoom: number;
}

export interface WorldViewBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export function clampCameraFov(value: number): number {
  if (!Number.isFinite(value)) return 60;
  return Math.min(160, Math.max(20, value));
}

export function cameraZoomForFov(baseZoom: number, fieldOfView: number): number {
  const safeZoom = Number.isFinite(baseZoom) ? Math.max(0.05, baseZoom) : 1;
  return safeZoom * (60 / clampCameraFov(fieldOfView));
}

export function cameraWorldView(
  camera: CameraTransformState,
  viewportWidth: number,
  viewportHeight: number,
): WorldViewBounds {
  const zoom = Math.max(0.0001, camera.zoom);
  const width = Math.max(1, viewportWidth) / zoom;
  const height = Math.max(1, viewportHeight) / zoom;
  const centerX = (Math.max(1, viewportWidth) / 2 - camera.x) / zoom;
  const centerY = (Math.max(1, viewportHeight) / 2 - camera.y) / zoom;
  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
    width,
    height,
    centerX,
    centerY,
  };
}

export function clampCameraCenter(
  centerX: number,
  centerY: number,
  viewWidth: number,
  viewHeight: number,
  bounds: { left: number; right: number; top: number; bottom: number },
): { x: number; y: number } {
  const halfWidth = viewWidth / 2;
  const halfHeight = viewHeight / 2;
  const minimumX = bounds.left + halfWidth;
  const maximumX = bounds.right - halfWidth;
  const minimumY = bounds.top + halfHeight;
  const maximumY = bounds.bottom - halfHeight;
  return {
    x: minimumX > maximumX ? (bounds.left + bounds.right) / 2 : Math.min(maximumX, Math.max(minimumX, centerX)),
    y: minimumY > maximumY ? (bounds.top + bounds.bottom) / 2 : Math.min(maximumY, Math.max(minimumY, centerY)),
  };
}
