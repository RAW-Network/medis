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

    function createVideoCard(video) {
        const card = document.createElement('div');
        card.className = 'video-card';
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
                showToast('Link copied.', 'success');
                setTimeout(() => {
                    copyBtn.innerHTML = ICONS.copy + ' <span>Copy</span>';
                    copyBtn.disabled = false;
                }, 1400);
            } catch (e) {
                showToast('Failed to copy link.', 'error');
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.innerHTML = ICONS.trash + ' <span>Delete</span>';
        deleteBtn.title = 'Delete Video';

        deleteBtn.addEventListener('click', async function () {
            const confirmed = await showConfirmModal(video.title);
            if (!confirmed) return;

            const buttons = card.querySelectorAll('.action-btn');
            buttons.forEach(btn => btn.disabled = true);
            deleteBtn.innerHTML = `<div class="spinner-overlay"><div class="loading-spinner"></div></div>` + ICONS.trash + ' <span>Deleting</span>';

            try {
                const response = await fetch(`${API_URL}/videos/${video.id}`, { method: 'DELETE' });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.message || 'Failed to delete video');
                showToast('Video deleted.', 'success');
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
            showToast('Please enter a video URL.', 'error');
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
            showToast(result.message || 'Queued.', 'info');
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

    function setProgress(percent, message) {
        if (!progressBarContainer || !progressBarInner || !progressText) return;

        if (progressBarContainer.style.display === 'none') {
            progressBarContainer.style.display = 'block';
        }

        const p = (percent === undefined || percent === null || isNaN(Number(percent))) ? null : Math.max(0, Math.min(100, Number(percent)));
        if (p === null) {
            progressBarInner.style.width = '0%';
            if (progressBar) progressBar.setAttribute('aria-valuenow', '0');
            progressText.textContent = message || 'Working...';
            return;
        }

        progressBarInner.style.width = `${p}%`;
        if (progressBar) progressBar.setAttribute('aria-valuenow', String(Math.round(p)));

        const msg = message || 'Working...';
        progressText.textContent = `${msg} (${Math.round(p)}%)`;
    }

    function resetProgressSoon() {
        if (!progressBarContainer || !progressBarInner || !progressText) return;
        setTimeout(() => {
            if (parseInt(downloadingCountEl.textContent, 10) === 0) {
                progressBarContainer.style.display = 'none';
                progressBarInner.style.width = '0%';
                if (progressBar) progressBar.setAttribute('aria-valuenow', '0');
                progressText.textContent = 'Preparing...';
            }
        }, 900);
    }

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const socket = new WebSocket(`${protocol}://${window.location.host}`);

        socket.onclose = () => setTimeout(connectWebSocket, 5000);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'status') {
                const queued = (data.queueSize || 0);
                const active = (data.activeDownloads || 0);
                downloadingCountEl.textContent = active + queued;

                if (active === 0 && queued === 0) {
                    resetProgressSoon();
                }
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
                return;
            }

            if (data.type === 'downloadError') {
                showToast(data.message || 'Download error.', 'error');
                return;
            }
        };
    }

    async function fetchVersionInfo() {
        try {
            const response = await fetch(`${API_URL}/version`);
            if (!response.ok) throw new Error('Failed to fetch version info');
            const data = await response.json();
            const ytdlpVersionEl = document.getElementById('ytdlp-version');
            const medisVersionEl = document.getElementById('medis-version');
            if (ytdlpVersionEl) ytdlpVersionEl.textContent = data.ytdlp || 'unknown';
            if (medisVersionEl) medisVersionEl.textContent = data.medis || 'unknown';
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
            <button class="toast-close" aria-label="Close toast">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.42-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4Z"/>
                </svg>
            </button>
        `;

        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 40);

        const removeToast = () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        };

        toast.querySelector('.toast-close').addEventListener('click', removeToast);
        if (duration > 0) setTimeout(removeToast, duration);
    }

    function showConfirmModal(videoTitle) {
        return new Promise((resolve) => {
            modalText.innerHTML = `Are you sure you want to delete <strong>${videoTitle}</strong>? This action cannot be undone.`;
            confirmModal.classList.remove('hidden');
            setTimeout(() => confirmModal.classList.add('visible'), 10);

            const closeModal = (confirmed) => {
                confirmModal.classList.remove('visible');
                setTimeout(() => confirmModal.classList.add('hidden'), 250);
                modalCancelBtn.removeEventListener('click', cancelHandler);
                modalConfirmBtn.removeEventListener('click', confirmHandler);
                resolve(confirmed);
            };

            const cancelHandler = () => closeModal(false);
            const confirmHandler = () => closeModal(true);

            modalCancelBtn.addEventListener('click', cancelHandler);
            modalConfirmBtn.addEventListener('click', confirmHandler);

            confirmModal.addEventListener('click', (e) => {
                if (e.target === confirmModal) closeModal(false);
            }, { once: true });
        });
    }

    downloadBtn.addEventListener('click', handleDownload);
    videoUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleDownload();
    });

    fetchAndRenderVideos();
    connectWebSocket();
    fetchVersionInfo();
});
