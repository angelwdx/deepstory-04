import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { AlertProvider } from './components/CustomAlert';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AlertProvider>
      <App />
    </AlertProvider>
  </React.StrictMode>
);