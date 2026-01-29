import DiagramEditor from './features/diagram/components/layout/DiagramEditor';
import MobileGuard from './features/diagram/components/layout/MobileGuard';

function App() {
  return (
    <>
    <MobileGuard/>
      <DiagramEditor />
    </>
  );
}

export default App;