import { Pressable, StyleSheet, Text } from 'react-native';

interface Props { label: string; onPress: () => void }

export function DiagnosticButton({ label, onPress }: Props) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <Text style={styles.label}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#243a49' },
  pressed: { backgroundColor: '#3b5666' },
  label: { color: '#eaf3f7', fontSize: 13, fontWeight: '600' },
});
