import * as Haptics from 'expo-haptics';

/** Resolution confirms the API call, not that hardware produced a sensation. */
export async function playSelectionHaptic(): Promise<void> {
  await Haptics.selectionAsync();
}
