/** Main frontend application entry point that initializes all components */
import { initToast } from './components/Toast.js';
import { initModal } from './components/Modal.js';
import { initHeader } from './components/Header.js';
import { initDownloadForm } from './components/DownloadForm.js';
import { initVideoLibrary } from './components/VideoLibrary.js';
import { initFooter } from './components/Footer.js';
import { connect as connectWebSocket } from './services/websocket.js';
import { runAutoUITest } from './utils/recorder.js';

/**
 * Application Bootstrap
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI components
  initToast();
  initModal();
  initHeader();
  initDownloadForm();
  initVideoLibrary();
  initFooter();

  // Setup navigation
  const brandBtn = document.getElementById('brand-btn');
  if (brandBtn) {
    brandBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  // Establish real-time connection
  connectWebSocket();

  // E2E Test Hooks
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('autotest') === 'true') {
    // Wait a brief moment to make sure library is fully rendered
    setTimeout(() => {
      runAutoUITest();
    }, 1500);
  }
});
