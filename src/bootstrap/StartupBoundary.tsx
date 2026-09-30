import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class StartupBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application startup failed', error, info.componentStack);
  }

  override render() {
    if (this.state.error !== null) {
      return <View style={styles.root}>
        <Text style={styles.title}>Unable to open One Chance</Text>
        <Text style={styles.detail}>Close and reopen the app. Existing local data has not been reset.</Text>
        {__DEV__ && <Text style={styles.detail}>{this.state.error.message}</Text>}
      </View>;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#101820' },
  title: { color: '#fff', fontSize: 22 },
  detail: { color: '#c4cdd5', marginTop: 12 },
});
