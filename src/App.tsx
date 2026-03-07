import { Analytics } from '@vercel/analytics/react';
import DiagramEditor from './features/diagram/components/layout/DiagramEditor';
import MobileGuard from './features/diagram/components/layout/MobileGuard';

function App() {
  return (
    <>
    <MobileGuard/>
      <DiagramEditor />
      <Analytics />
    </>
  );
}

export default App;