import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StartupBoundary } from '../bootstrap/StartupBoundary';
import { initializeDatabase } from '../persistence/initializeDatabase';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StartupBoundary>
          <SQLiteProvider databaseName="one-chance.db" onInit={initializeDatabase}>
            <StatusBar hidden />
            <Stack screenOptions={{ headerShown: false, orientation: 'landscape', contentStyle: { backgroundColor: '#101820' } }} />
          </SQLiteProvider>
        </StartupBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
