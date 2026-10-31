import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/tokens.css';
import './ui/styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <div className="app-shell">
      <App />
    </div>
  </StrictMode>,
);
