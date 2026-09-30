import { useCallback, useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { fitWorld, screenToWorld, zoomAt } from '../rendering/camera/coordinates';
import { diagnosticGeometry } from './geometry';
export function useDiagnosticCamera(width: number, height: number) {
    const camera = useSharedValue(fitWorld(width, height, diagnosticGeometry.width, diagnosticGeometry.height));
    const pinchStartScale = useSharedValue(1);
    const pinchAnchor = useSharedValue({ x: 0, y: 0 });
    const reset = useCallback(() => {
        camera.set(fitWorld(width, height, diagnosticGeometry.width, diagnosticGeometry.height));
    }, [camera, width, height]);
    useEffect(reset, [reset]);
    const pan = Gesture.Pan().maxPointers(1).onChange((event) => {
        camera.set({ ...camera.get(), x: camera.get().x + event.changeX, y: camera.get().y + event.changeY });
    });
    const pinch = Gesture.Pinch().onStart((event) => {
        pinchStartScale.set(camera.get().scale);
        pinchAnchor.set(screenToWorld({ x: event.focalX, y: event.focalY }, camera.get()));
    }).onUpdate((event) => {
        const scale = Math.min(4, Math.max(0.15, pinchStartScale.get() * event.scale));
        camera.set({
            scale,
            x: event.focalX - pinchAnchor.get().x * scale,
            y: event.focalY - pinchAnchor.get().y * scale,
        });
    });
    const zoom = (factor: number) => {
        const scale = Math.min(4, Math.max(0.15, camera.get().scale * factor));
        camera.set(zoomAt(camera.get(), { x: width / 2, y: height / 2 }, scale));
    };
    return { camera, pan, pinch, reset, zoom };
}
