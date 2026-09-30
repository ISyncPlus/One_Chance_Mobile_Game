import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { playSelectionHaptic } from '../haptics/selection';
import { containsCircle } from '../input/hitTesting';
import { screenToWorld } from '../rendering/camera/coordinates';
import { usePreferences } from '../state/preferences';
import { DiagnosticButton } from './DiagnosticButton';
import { DiagnosticScene } from './DiagnosticScene';
import { diagnosticGeometry as geometry } from './geometry';
import { useDatabaseStatus } from './useDatabaseStatus';
import { useDiagnosticCamera } from './useDiagnosticCamera';
import { useFrameCapture } from './useFrameCapture';
export default function RenderingDiagnostic() {
    const [viewport, setViewport] = useState({ width: 1, height: 1 });
    const [interaction, setInteraction] = useState('Tap the gold token · drag to pan · pinch to zoom');
    const [hapticStatus, setHapticStatus] = useState('Haptic API idle');
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { camera, pan, pinch, reset, zoom } = useDiagnosticCamera(viewport.width, viewport.height);
    const tokenX = useSharedValue<number>(geometry.token.x);
    const tokenY = useSharedValue<number>(geometry.token.y);
    const nextDestination = useSharedValue<number>(geometry.destination.x);
    const enabled = usePreferences((state) => state.hapticsEnabled);
    const setEnabled = usePreferences((state) => state.setHapticsEnabled);
    const databaseStatus = useDatabaseStatus();
    const { summary, capture } = useFrameCapture();
    const haptic = useCallback(() => {
        if (!enabled) {
            setHapticStatus('Haptics disabled');
            return;
        }
        void playSelectionHaptic().then(() => setHapticStatus('Haptic API resolved · hardware sensation unverified'))
            .catch((error: unknown) => {
            console.error('Haptic invocation failed', error);
            setHapticStatus(`Haptic ERROR: ${error instanceof Error ? error.message : String(error)}`);
        });
    }, [enabled]);
    const reportTap = (hit: boolean, x: number, y: number) => {
        setInteraction(`${hit ? 'TOKEN HIT' : 'Miss'} · world (${x.toFixed(1)}, ${y.toFixed(1)})`);
        if (hit)
            haptic();
    };
    const tap = Gesture.Tap().onEnd((event, success) => {
        if (!success)
            return;
        const world = screenToWorld({ x: event.x, y: event.y }, camera.get());
        const hit = containsCircle(world, { x: tokenX.get(), y: tokenY.get() }, geometry.token.radius);
        scheduleOnRN(reportTap, hit, world.x, world.y);
    });
    const moveToken = () => {
        tokenX.set(withTiming(nextDestination.get(), { duration: 1200 }));
        nextDestination.set(nextDestination.get() === geometry.destination.x ? geometry.token.x : geometry.destination.x);
    };
    useEffect(() => {
        const listener = AppState.addEventListener('change', (state) => {
            if (state !== 'active') {
                cancelAnimation(tokenX);
                cancelAnimation(tokenY);
            }
        });
        return () => { listener.remove(); cancelAnimation(tokenX); cancelAnimation(tokenY); };
    }, [tokenX, tokenY]);
    return (<SafeAreaView style={styles.root} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <View><Text style={styles.title}>RENDERING LAB</Text><Text style={styles.subtitle}>Development only · temporary geometry · no game rules</Text></View>
        <Text style={styles.metrics}>{Math.round(width)} × {Math.round(height)} · {width > height ? 'landscape' : 'PORTRAIT — CHECK CONFIG'}{'\n'}Safe L{insets.left} R{insets.right} T{insets.top} B{insets.bottom}</Text>
      </View>
      <View style={styles.stage} onLayout={({ nativeEvent }) => {
            const { width: stageWidth, height: stageHeight } = nativeEvent.layout;
            setViewport({ width: stageWidth, height: stageHeight });
        }}>
        <GestureDetector gesture={Gesture.Race(Gesture.Simultaneous(pan, pinch), tap)}>
          <View style={styles.canvasHost} collapsable={false} accessible accessibilityLabel="Diagnostic world. Gold token on a coordinate grid. Use the controls below as alternatives to gestures.">
            <DiagnosticScene camera={camera} tokenX={tokenX} tokenY={tokenY}/>
          </View>
        </GestureDetector>
        <Text pointerEvents="none" style={styles.worldLabel}>WORLD 960 × 480 · coral X / mint Y</Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.buttons}>
          <DiagnosticButton label="Move token" onPress={moveToken}/>
          <DiagnosticButton label="Zoom +" onPress={() => zoom(1.25)}/>
          <DiagnosticButton label="Zoom −" onPress={() => zoom(0.8)}/>
          <DiagnosticButton label="Fit world" onPress={reset}/>
          <DiagnosticButton label="Haptic" onPress={haptic}/>
          <DiagnosticButton label={enabled ? 'Haptics on' : 'Haptics off'} onPress={() => setEnabled(!enabled)}/>
          <DiagnosticButton label="Capture 10s" onPress={capture}/>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.status}>{interaction} · {hapticStatus}</Text>
        <Text style={styles.status}>{summary}</Text>
        <Text style={styles.database}>{databaseStatus}</Text>
      </View>
    </SafeAreaView>);
}
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#101820' },
    header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
    title: { color: '#f6c75c', fontSize: 17, fontWeight: '800', letterSpacing: 2 },
    subtitle: { color: '#a5b8c6', fontSize: 11, marginTop: 3 },
    metrics: { color: '#a5b8c6', textAlign: 'right', fontSize: 11 },
    stage: { flex: 1, minHeight: 80, marginHorizontal: 12, borderWidth: 1, borderColor: '#436171', borderRadius: 10, overflow: 'hidden' },
    canvasHost: { flex: 1 },
    worldLabel: { position: 'absolute', top: 8, left: 10, color: '#8ba6b8', fontSize: 10 },
    footer: { paddingHorizontal: 16, paddingVertical: 8, gap: 4 },
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 3 },
    status: { color: '#c4d3dc', fontSize: 11 },
    database: { color: '#70d9bb', fontSize: 10 },
});
