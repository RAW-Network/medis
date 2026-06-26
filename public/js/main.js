// main.js - Entry point for the MEDIS frontend application

import { initToast } from './components/Toast.js';
import { initModal } from './components/Modal.js';
import { initHeader } from './components/Header.js';
import { initDownloadForm } from './components/DownloadForm.js';
import { initVideoLibrary } from './components/VideoLibrary.js';
import { initFooter } from './components/Footer.js';
import { connect as connectWebSocket } from './services/websocket.js';
import { runAutoUITest } from './utils/recorder.js';

// Wait for the DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI components
  initToast();
  initModal();
  initHeader();
  initDownloadForm();
  initVideoLibrary();
  initFooter();

  // Connect to backend via WebSocket for real-time updates
  connectWebSocket();

  // Check if auto test query parameter is present
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('autotest') === 'true') {
    // Wait a brief moment to make sure library is fully rendered
    setTimeout(() => {
      runAutoUITest();
    }, 1500);
  }
});
