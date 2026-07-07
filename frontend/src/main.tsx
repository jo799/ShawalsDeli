import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Applies the saved theme class to <html> the moment the app loads — importing
// this here (rather than relying on some deeper component to import it first)
// means the Login/Signup pages respect a saved preference too, not just
// pages behind the Sidebar.
import './store/themeStore';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);