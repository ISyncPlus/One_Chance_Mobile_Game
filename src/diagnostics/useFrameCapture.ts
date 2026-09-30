import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
interface FrameSample {
    frames: number;
    elapsed: number;
    worst: number;
    overBudget: number;
}
const emptySample = (): FrameSample => ({ frames: 0, elapsed: 0, worst: 0, overBudget: 0 });
/** UI-frame intervals, not GPU timings. Never publishes React state per frame. */
export function useFrameCapture() {
    const sample = useSharedValue(emptySample());
    const recording = useSharedValue(false);
    const skipFirst = useSharedValue(true);
    const [summary, setSummary] = useState('UI-frame capture idle · not a performance certification');
    const finish = useCallback((result: FrameSample) => {
        setSummary(`${result.frames} frames · ${(result.frames * 1000 / result.elapsed).toFixed(1)} callbacks/s · worst ${result.worst.toFixed(1)} ms · ${result.overBudget} intervals >20 ms`);
    }, []);
    const frameCallback = useFrameCallback((frame) => {
        if (!recording.get() || frame.timeSincePreviousFrame === null)
            return;
        if (skipFirst.get()) {
            skipFirst.set(false);
            return;
        }
        const delta = frame.timeSincePreviousFrame;
        const previous = sample.get();
        sample.set({
            frames: previous.frames + 1,
            elapsed: previous.elapsed + delta,
            worst: Math.max(previous.worst, delta),
            overBudget: previous.overBudget + (delta > 20 ? 1 : 0),
        });
        if (sample.get().elapsed >= 10000) {
            recording.set(false);
            scheduleOnRN(finish, sample.get());
        }
    });
    useEffect(() => {
        const listener = AppState.addEventListener('change', (state) => {
            frameCallback.setActive(state === 'active');
            if (state !== 'active' && recording.get()) {
                recording.set(false);
                setSummary('Capture cancelled: app left foreground');
            }
        });
        return () => listener.remove();
    }, [frameCallback, recording]);
    const capture = () => {
        sample.set(emptySample());
        skipFirst.set(true);
        recording.set(true);
        setSummary('Capturing 10 seconds · pan, pinch and move the token');
    };
    return { summary, capture };
}
