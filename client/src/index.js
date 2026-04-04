import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// --- ANONYMOUS SESSION SETUP ---
let sessionId = localStorage.getItem('interviewSessionId');
if (!sessionId) {
  sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('interviewSessionId', sessionId);
}
// Automatically attach this ID to every backend request
axios.defaults.headers.common['X-Session-ID'] = sessionId;
// -------------------------------

// Suppress benign ResizeObserver errors in development
window.addEventListener('error', e => {
  if (e.message.includes('ResizeObserver')) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

// Wrap ResizeObserver to delay execution and strictly prevent the loop error
if (typeof window !== 'undefined' && window.ResizeObserver) {
  const OriginalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
    constructor(callback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          callback(entries, observer);
        });
      });
    }
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
