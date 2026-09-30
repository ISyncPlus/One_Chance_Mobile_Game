import { StyleSheet, Text, View } from 'react-native';

export function FoundationScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>One Chance</Text>
      <Text style={styles.description}>Technical foundation · Gameplay is not available in this build.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#101820' },
  title: { color: '#fff', fontSize: 30, fontWeight: '700' },
  description: { color: '#a5b4c0', fontSize: 15, marginTop: 12, textAlign: 'center' },
});
