import { Canvas, Circle, Group, Line, Rect } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';
import type { Camera } from '../rendering/camera/coordinates';
import { diagnosticGeometry as geometry } from './geometry';
interface Props {
    camera: SharedValue<Camera>;
    tokenX: SharedValue<number>;
    tokenY: SharedValue<number>;
}
const columns = Array.from({ length: geometry.width / geometry.gridSpacing + 1 }, (_, index) => index * geometry.gridSpacing);
const rows = Array.from({ length: geometry.height / geometry.gridSpacing + 1 }, (_, index) => index * geometry.gridSpacing);
export function DiagnosticScene({ camera, tokenX, tokenY }: Props) {
    const translation = useDerivedValue(() => [{ translateX: camera.get().x }, { translateY: camera.get().y }]);
    const scaling = useDerivedValue(() => [{ scale: camera.get().scale }]);
    return (<Canvas style={styles.canvas}>
      <Group transform={translation}>
        <Group transform={scaling}>
          <Rect x={0} y={0} width={geometry.width} height={geometry.height} color="#192c39"/>
          {columns.map((x) => <Line key={`x${x}`} p1={{ x, y: 0 }} p2={{ x, y: geometry.height }} color="#2c4655" strokeWidth={1}/>)}
          {rows.map((y) => <Line key={`y${y}`} p1={{ x: 0, y }} p2={{ x: geometry.width, y }} color="#2c4655" strokeWidth={1}/>)}
          <Line p1={{ x: 0, y: 0 }} p2={{ x: geometry.width, y: 0 }} color="#eb846d" strokeWidth={4}/>
          <Line p1={{ x: 0, y: 0 }} p2={{ x: 0, y: geometry.height }} color="#70d9bb" strokeWidth={4}/>
          <Circle cx={geometry.token.x} cy={geometry.token.y} r={40} color="#527282" style="stroke" strokeWidth={2}/>
          <Circle cx={geometry.destination.x} cy={geometry.destination.y} r={40} color="#527282" style="stroke" strokeWidth={2}/>
          <Circle cx={tokenX} cy={tokenY} r={geometry.token.radius} color="#f6c75c"/>
          <Circle cx={tokenX} cy={tokenY} r={9} color="#192c39"/>
        </Group>
      </Group>
    </Canvas>);
}
const styles = StyleSheet.create({ canvas: { flex: 1 } });
