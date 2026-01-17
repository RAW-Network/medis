document.addEventListener('DOMContentLoaded', () => {
  const API_URL = '/api';
  const videoUrlInput = document.getElementById('video-url');
  const downloadBtn = document.getElementById('download-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const videoList = document.getElementById('video-list');
  const downloadingCountEl = document.getElementById('downloading-count');
  const completedCountEl = document.getElementById('completed-count');
  const progressBarContainer = document.getElementById('progress-bar-container');
  const progressBar = progressBarContainer ? progressBarContainer.querySelector('.progress-bar') : null;
  const progressBarInner = document.getElementById('progress-bar-inner');
  const progressText = document.getElementById('progress-text');
  const toastContainer = document.getElementById('toast-container');
  const confirmModal = document.getElementById('confirm-modal');
  const modalText = document.getElementById('modal-text');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');

  const ICONS = {
    copy: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    trash: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    copied: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.58L19 8l-9 9z"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5 16.59L15.59 18 12 14.41 8.41 18 7 16.59 10.59 13 7 9.41 8.41 8 12 11.59 15.59 8 17 9.41 13.41 13 17 16.59z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM13 18h-2v-6h2v6zm0-8h-2V8h2v2z"/></svg>`
  };

  const progressState = {
    visible: false,
    lastAt: 0,
    lastPercent: null,
    lastBase: '',
    hideTimer: null,
    raf: 0,
    pending: null,
    lastRenderAt: 0
  };

  const UX = {
    hideGraceMs: 1200,
    hideAfterMs: 650,
    throttleMs: 90,
    stuckWarnMs: 15000,
    stuckPulseMs: 1200,
    regressThreshold: 10
  };

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }

  function normalizeSpaces(s){
    return String(s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function stripAllPercents(text){
    const s = normalizeSpaces(text);
    const pct = '%％٪';
    const reParen = new RegExp(`\\(\\s*\\d{1,3}\\s*[${pct}]\\s*\\)`, 'g');
    const reToken = new RegExp(`\\d{1,3}\\s*[${pct}]`, 'g');
    return normalizeSpaces(s.replace(reParen, '').replace(reToken, ''));
  }

  function showProgressUI(){
    if (!progressBarContainer || !progressBarInner || !progressText) return;
    if (!progressState.visible) {
      progressBarContainer.style.display = 'block';
      progressState.visible = true;
    }
  }

  function hideProgressUI(){
    if (!progressBarContainer || !progressBarInner || !progressText) return;
    progressBarContainer.style.display = 'none';
    progressBarInner.style.width = '0%';
    if (progressBar) progressBar.setAttribute('aria-valuenow', '0');
    progressText.textContent = 'Preparing...';
    progressState.visible = false;
    progressState.lastPercent = null;
    progressState.lastBase = '';
    progressState.pending = null;
    progressState.lastRenderAt = 0;
  }

  function scheduleHideIfIdle(){
    if (progressState.hideTimer) clearTimeout(progressState.hideTimer);
    const now = Date.now();
    const since = now - (progressState.lastAt || 0);
    const downloading = parseInt(downloadingCountEl.textContent || '0', 10);

    if (downloading > 0) return;
    if (since < UX.hideGraceMs) {
      progressState.hideTimer = setTimeout(scheduleHideIfIdle, UX.hideGraceMs - since + 10);
      return;
    }

    progressState.hideTimer = setTimeout(() => {
      const downloading2 = parseInt(downloadingCountEl.textContent || '0', 10);
      const since2 = Date.now() - (progressState.lastAt || 0);
      if (downloading2 === 0 && since2 >= UX.hideGraceMs) hideProgressUI();
    }, UX.hideAfterMs);
  }

  function applyProgressRender(p, base){
    showProgressUI();
    progressBarInner.style.width = `${p}%`;
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(p));
    progressText.textContent = `${base} ${p}%`;
  }

  function commitProgress(p, base){
    const now = Date.now();
    const delta = now - progressState.lastRenderAt;
    if (delta < UX.throttleMs) {
      progressState.pending = { p, base };
      if (!progressState.raf) {
        progressState.raf = requestAnimationFrame(() => {
          progressState.raf = 0;
          const wait = UX.throttleMs - (Date.now() - progressState.lastRenderAt);
          setTimeout(() => {
            const pend = progressState.pending;
            progressState.pending = null;
            if (!pend) return;
            progressState.lastRenderAt = Date.now();
            applyProgressRender(pend.p, pend.base);
          }, Math.max(0, wait));
        });
      }
      return;
    }
    progressState.lastRenderAt = now;
    applyProgressRender(p, base);
  }

  function setProgress(percent, message) {
    if (!progressBarContainer || !progressBarInner || !progressText) return;

    const now = Date.now();
    const rawMsg = normalizeSpaces(message || 'Working...');
    const base = stripAllPercents(rawMsg) || 'Working...';

    const n = Number(percent);
    const valid = !(percent === undefined || percent === null || Number.isNaN(n));
    if (!valid) {
      showProgressUI();
      progressBarInner.style.width = '0%';
      if (progressBar) progressBar.setAttribute('aria-valuenow', '0');
      progressText.textContent = base;
      progressState.lastAt = now;
      progressState.lastPercent = null;
      progressState.lastBase = base;
      return;
    }

    let p = Math.max(0, Math.min(100, Math.round(n)));

    if (progressState.lastPercent !== null && p + UX.regressThreshold < progressState.lastPercent) {
      progressState.lastPercent = null;
      progressState.lastBase = '';
      showProgressUI();
      progressBarInner.style.width = '0%';
      if (progressBar) progressBar.setAttribute('aria-valuenow', '0');
    }

    if (progressState.lastPercent !== null && p < progressState.lastPercent) {
      p = progressState.lastPercent;
    }

    progressState.lastAt = now;
    progressState.lastPercent = p;
    progressState.lastBase = base;

    if (progressState.hideTimer) {
      clearTimeout(progressState.hideTimer);
      progressState.hideTimer = null;
    }

    commitProgress(p, base);
  }

  function startStuckWatchdog(){
    setInterval(() => {
      const downloading = parseInt(downloadingCountEl.textContent || '0', 10);
      if (downloading <= 0) return;
      if (!progressState.visible) showProgressUI();

      const now = Date.now();
      const since = now - (progressState.lastAt || 0);
      if (since < UX.stuckWarnMs) return;

      let p = progressState.lastPercent;
      if (p === null) p = 1;
      const pulse = Math.min(100, Math.max(0, p + (Math.floor((since - UX.stuckWarnMs) / UX.stuckPulseMs) % 2)));

      const base = progressState.lastBase || 'Downloading video';
      commitProgress(pulse, base);
    }, 1500);
  }

  function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = `video-card-${video.id}`;
    card.dataset.videoId = video.id;

    const placeholder = document.createElement('div');
    placeholder.className = 'card-video-placeholder';
    placeholder.dataset.src = `/api/stream/${video.filename}`;

    if (video.thumbnailUrl && video.thumbnailUrl.trim() !== '') {
      placeholder.style.backgroundImage = `url('${video.thumbnailUrl}')`;
    } else {
      placeholder.classList.add('no-thumbnail');
    }

    const playIcon = document.createElement('div');
    playIcon.className = 'play-icon';
    placeholder.appendChild(playIcon);
    placeholder.addEventListener('click', playVideo);

    const info = document.createElement('div');
    info.className = 'card-info';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = video.title || 'Untitled';

    const date = document.createElement('p');
    date.className = 'card-date';
    const dt = video.createdAt ? new Date(video.createdAt) : null;
    date.textContent = dt && !isNaN(dt.getTime()) ? dt.toLocaleString() : '';

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn copy-btn';
    copyBtn.innerHTML = ICONS.copy + ' <span>Copy</span>';
    copyBtn.title = 'Copy Share Link';

    copyBtn.addEventListener('click', async () => {
      if (copyBtn.disabled) return;
      const shareLink = `${window.location.origin}/share/${video.id}`;
      try {
        const copied = await copyToClipboard(shareLink);
        if (!copied) throw new Error('copy failed');
        copyBtn.disabled = true;
        copyBtn.innerHTML = ICONS.copied + ' <span>Copied</span>';
        showToast('Link copied', 'success');
        setTimeout(() => {
          copyBtn.innerHTML = ICONS.copy + ' <span>Copy</span>';
          copyBtn.disabled = false;
        }, 1400);
      } catch (e) {
        showToast('Failed to copy link', 'error');
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.innerHTML = ICONS.trash + ' <span>Delete</span>';
    deleteBtn.title = 'Delete Video';

    deleteBtn.addEventListener('click', async function () {
      const confirmed = await showConfirmModal(video.title || 'Untitled');
      if (!confirmed) return;

      const buttons = card.querySelectorAll('.action-btn');
      buttons.forEach(btn => btn.disabled = true);
      deleteBtn.innerHTML = `<div class="spinner-overlay"><div class="loading-spinner"></div></div>` + ICONS.trash + ' <span>Deleting</span>';

      try {
        const response = await fetch(`${API_URL}/videos/${video.id}`, { method: 'DELETE' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Failed to delete video');
        showToast('Video deleted', 'success');
        await fetchAndRenderVideos();
      } catch (error) {
        showToast(error.message || 'Failed to delete video', 'error');
        buttons.forEach(btn => btn.disabled = false);
        deleteBtn.innerHTML = ICONS.trash + ' <span>Delete</span>';
      }
    });

    actions.append(copyBtn, deleteBtn);
    info.append(title, date, actions);
    card.append(placeholder, info);
    return card;
  }

  function renderVideos(videos) {
    videoList.innerHTML = '';
    completedCountEl.textContent = Array.isArray(videos) ? videos.length : 0;

    if (!videos || videos.length === 0) {
      videoList.innerHTML = `<p style="text-align:center; color: rgba(255,255,255,.68); grid-column: 1 / -1;">Your library is empty. Start by downloading a video.</p>`;
      return;
    }

    videos.forEach(video => {
      videoList.appendChild(createVideoCard(video));
    });
  }

  async function fetchAndRenderVideos() {
    try {
      const response = await fetch(`${API_URL}/videos`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const videos = await response.json();
      renderVideos(Array.isArray(videos) ? videos : []);
    } catch (error) {
      videoList.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color: rgba(251,113,133,.95);">Failed to load video library.</p>';
    }
  }

  async function handleDownload() {
    const url = videoUrlInput.value.trim();
    if (!url) {
      showToast('Please enter a video URL', 'error');
      return;
    }
    downloadBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');
    try {
      const response = await fetch(`${API_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'An unknown error occurred during the request');
      showToast(result.message || 'Queued', 'info');
      videoUrlInput.value = '';
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      downloadBtn.disabled = false;
      loadingIndicator.classList.add('hidden');
    }
  }

  function playVideo(event) {
    const placeholder = event.currentTarget;
    const videoSrc = placeholder.dataset.src;
    if (!videoSrc) return;
    const videoPlayer = document.createElement('video');
    videoPlayer.className = 'card-video-player';
    videoPlayer.src = videoSrc;
    videoPlayer.controls = true;
    videoPlayer.autoplay = true;
    videoPlayer.preload = 'auto';
    placeholder.parentNode.replaceChild(videoPlayer, placeholder);
    videoPlayer.focus();
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}`);

    socket.onclose = () => setTimeout(connectWebSocket, 1200);

    socket.onopen = () => {
      if (parseInt(downloadingCountEl.textContent || '0', 10) > 0) showProgressUI();
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        const queued = (data.queueSize || 0);
        const active = (data.activeDownloads || 0);
        downloadingCountEl.textContent = active + queued;
        if (active === 0 && queued === 0) scheduleHideIfIdle();
        return;
      }

      if (data.type === 'progress') {
        setProgress(data.percent, data.message);
        return;
      }

      if (data.type === 'downloadComplete') {
        const t = (data.video && data.video.title) ? data.video.title : 'Completed';
        showToast(`Downloaded: ${t}`, 'success');
        fetchAndRenderVideos();
        scheduleHideIfIdle();
        return;
      }

      if (data.type === 'downloadError') {
        showToast(data.message || 'Download error', 'error');
        scheduleHideIfIdle();
        return;
      }

      if (data.type === 'VIDEO_DELETED') {
        const videoId = data.payload.id;
        const cardElement = document.getElementById(`video-card-${videoId}`);

        if (cardElement) {
          cardElement.style.transition = 'opacity 0.3s, transform 0.3s';
          cardElement.style.opacity = '0';
          cardElement.style.transform = 'scale(0.9)';

          setTimeout(() => {
            cardElement.remove();
            const currentCount = parseInt(completedCountEl.textContent || '0');
            completedCountEl.textContent = Math.max(0, currentCount - 1);

            if (videoList.children.length === 0) {
              videoList.innerHTML = `<p style="text-align:center; color: rgba(255,255,255,.68); grid-column: 1 / -1;">Your library is empty. Start by downloading a video.</p>`;
            }
          }, 300);
        }
        return;
      }
    };
  }

  async function fetchVersionInfo() {
    const ytdlpVersionEl = document.getElementById('ytdlp-version');
    const medisVersionEl = document.getElementById('medis-version');

    const cached = localStorage.getItem('medis_versions');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (ytdlpVersionEl) ytdlpVersionEl.textContent = data.ytdlp;
        if (medisVersionEl) medisVersionEl.textContent = data.medis;
      } catch (e) {}
    }

    try {
      const response = await fetch(`${API_URL}/version`);
      if (!response.ok) throw new Error('Failed to fetch version info');
      const data = await response.json();

      if (ytdlpVersionEl) ytdlpVersionEl.textContent = data.ytdlp || 'unknown';
      if (medisVersionEl) medisVersionEl.textContent = data.medis || 'unknown';

      localStorage.setItem('medis_versions', JSON.stringify(data));
    } catch (e) {}
  }

  function showToast(message, type = 'info', duration = 4200) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
      success: ICONS.success,
      error: ICONS.error,
      info: ICONS.info
    };

    toast.innerHTML = `
      <div class="toast-icon">${iconMap[type] || ICONS.info}</div>
      <div class="toast-content">${message}</div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 40);

    const removeToast = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    };

    if (duration > 0) setTimeout(removeToast, duration);
  }

  function showConfirmModal(videoTitle){
    return new Promise(resolve=>{
      const icon = `
        <div class="modal-icon-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6M14 11v6"></path>
          </svg>
        </div>
      `;

      modalText.innerHTML = `
        ${icon}
        <h3 class="custom-modal-title">Delete Video?</h3>
        <p class="modal-message">
          This action is permanent and cannot be undone.
          <span class="video-highlight">${videoTitle}</span>
        </p>
      `;

      confirmModal.classList.remove('hidden');
      requestAnimationFrame(()=>confirmModal.classList.add('visible'));

      const close = ok=>{
        confirmModal.classList.remove('visible');
        setTimeout(()=>{
          confirmModal.classList.add('hidden');
          resolve(ok);
        },220);
      };

      const onOverlayClick = e=>{
        if(e.target===confirmModal) close(false);
      };

      const onEsc = e=>{
        if(e.key==='Escape') close(false);
      };

      confirmModal.addEventListener('click', onOverlayClick, { once: true });
      document.addEventListener('keydown', onEsc, { once: true });

      modalCancelBtn.onclick = ()=>close(false);
      modalConfirmBtn.onclick = ()=>close(true);
    });
  }

  downloadBtn.addEventListener('click', handleDownload);
  videoUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleDownload();
  });

  fetchAndRenderVideos();
  connectWebSocket();
  fetchVersionInfo();
  startStuckWatchdog();
});
