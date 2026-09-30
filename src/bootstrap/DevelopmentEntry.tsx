import { lazy, Suspense } from 'react';

import { FoundationScreen } from '../ui/FoundationScreen';

// Metro replaces __DEV__; the diagnostic import is unreachable in release bundles.
const Diagnostic = __DEV__ ? lazy(() => import('../diagnostics/RenderingDiagnostic')) : null;

export function DevelopmentEntry() {
  if (Diagnostic === null) return <FoundationScreen />;
  return <Suspense fallback={<FoundationScreen />}><Diagnostic /></Suspense>;
}
