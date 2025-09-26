document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    const videoUrlInput = document.getElementById('video-url');
    const downloadBtn = document.getElementById('download-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const videoList = document.getElementById('video-list');
    const downloadingCountEl = document.getElementById('downloading-count');
    const completedCountEl = document.getElementById('completed-count');
    const progressBarContainer = document.getElementById('progress-bar-container');
    const progressBarInner = document.getElementById('progress-bar-inner');
    const progressText = document.getElementById('progress-text');
    const toastContainer = document.getElementById('toast-container');
    const confirmModal = document.getElementById('confirm-modal');
    const modalText = document.getElementById('modal-text');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const themeButton = document.getElementById('theme-button');
    const themeDropdown = document.getElementById('theme-dropdown');
    const themeText = themeButton.querySelector('.theme-text');

    const ICONS = {
        copy: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>`,
        trash: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        copied: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        success: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.58L19 8l-9 9z"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
        close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>`
    };

    const THEMES = {
        light: 'Light',
        dark: 'Dark',
        system: 'Auto'
    };

    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function getCurrentTheme() {
        return localStorage.getItem('theme') || 'system';
    }

    function setTheme(theme) {
        localStorage.setItem('theme', theme);
        applyTheme(theme);
        updateThemeUI(theme);
    }

    function applyTheme(theme) {
        const actualTheme = theme === 'system' ? getSystemTheme() : theme;
        document.documentElement.setAttribute('data-theme', actualTheme);
    }

    function updateThemeUI(theme) {
        themeText.textContent = THEMES[theme];

        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === theme);
        });
    }

    function initTheme() {
        const currentTheme = getCurrentTheme();
        applyTheme(currentTheme);
        updateThemeUI(currentTheme);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (getCurrentTheme() === 'system') {
                applyTheme('system');
            }
        });
    }

    function toggleThemeDropdown() {
        themeDropdown.classList.toggle('show');
    }

    function hideThemeDropdown() {
        themeDropdown.classList.remove('show');
    }

    function showToast(message, type = 'info', duration = 5000) {
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
            <button class="toast-close" aria-label="Close notification">
                ${ICONS.close}
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => hideToast(toast));
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        const timeoutId = setTimeout(() => hideToast(toast), duration);
        toast.timeoutId = timeoutId;
        return toast;
    }

    function hideToast(toast) {
        if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
        }

        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, { once: true });
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
        placeholder.replaceWith(videoPlayer);
    }

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const socket = new WebSocket(`${protocol}://${window.location.host}`);
        socket.onopen = () => {};
        socket.onerror = () => {};
        socket.onclose = () => setTimeout(connectWebSocket, 5000);
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'status':
                    downloadingCountEl.textContent = data.activeDownloads + (data.queueSize || 0);
                    if (data.activeDownloads === 0 && (data.queueSize || 0) === 0) {
                        setTimeout(() => {
                            if (parseInt(downloadingCountEl.textContent) === 0) {
                                progressBarContainer.style.display = 'none';
                            }
                        }, 2000);
                    }
                    break;
                case 'progress':
                    if (progressBarContainer.style.display === 'none') {
                        progressBarContainer.style.display = 'flex';
                    }
                    progressText.textContent = data.message;
                    if (data.percent !== undefined) {
                        progressBarInner.style.width = `${data.percent}%`;
                    }
                    break;
                case 'downloadComplete':
                    showToast(`Downloaded: ${data.video.title.substring(0, 40)}...`, 'success');
                    fetchAndRenderVideos();
                    break;
                case 'downloadError':
                    showToast(data.message, 'error');
                    if (parseInt(downloadingCountEl.textContent, 10) === 0) {
                        progressBarContainer.style.display = 'none';
                    }
                    break;
                case 'videoDeleted':
                    const cardToRemove = document.querySelector(`.video-card[data-video-id="${data.videoId}"]`);
                    if (cardToRemove) {
                        cardToRemove.remove();
                        completedCountEl.textContent = parseInt(completedCountEl.textContent, 10) - 1;
                    }
                    break;
            }
        };
    }

    function showConfirmModal(title) {
        return new Promise(resolve => {
            modalText.innerHTML = `Are you sure you want to delete "<strong>${title}</strong>"?`;
            confirmModal.style.display = 'flex';
            setTimeout(() => confirmModal.classList.add('visible'), 10);

            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleOverlayClick = (e) => {
                if (e.target === confirmModal) {
                    handleCancel();
                }
            };

            const cleanup = () => {
                confirmModal.classList.remove('visible');
                setTimeout(() => {
                    confirmModal.style.display = 'none';
                    modalConfirmBtn.removeEventListener('click', handleConfirm);
                    modalCancelBtn.removeEventListener('click', handleCancel);
                    confirmModal.removeEventListener('click', handleOverlayClick);
                }, 200);
            };

            modalConfirmBtn.addEventListener('click', handleConfirm);
            modalCancelBtn.addEventListener('click', handleCancel);
            confirmModal.addEventListener('click', handleOverlayClick);
        });
    }

    async function fetchAndRenderVideos() {
        try {
            const response = await fetch(`${API_URL}/videos`);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const videos = await response.json();
            videoList.innerHTML = '';
            completedCountEl.textContent = videos.length;

            if (videos.length === 0) {
                videoList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">Your library is empty. Start by downloading a video</p>';
                return;
            }

            videos.forEach(video => {
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
                title.textContent = video.title;

                const date = document.createElement('p');
                date.className = 'card-date';
                date.textContent = 'Downloaded on ' + new Date(video.createdAt).toISOString().split('T')[0];

                const actions = document.createElement('div');
                actions.className = 'card-actions';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'action-btn copy-btn';
                copyBtn.innerHTML = ICONS.copy + ' <span>Copy Link</span>';
                copyBtn.title = 'Copy Link';
                copyBtn.addEventListener('click', () => {
                    if (copyBtn.disabled) return;
                    const shareLink = `${window.location.origin}/share/${video.id}`;
                    const fallbackCopyTextToClipboard = (text) => {
                        const textArea = document.createElement('textarea');
                        textArea.value = text;
                        textArea.style.position = 'absolute';
                        textArea.style.left = '-9999px';
                        
                        document.body.prepend(textArea);
                        textArea.select();
                        
                        let successful = false;
                        try {
                            successful = document.execCommand('copy');
                        } catch (err) {
                            console.error('Fallback: Gagal menyalin', err);
                        }
                        
                        textArea.remove();
                        return successful;
                    };

                    const copied = fallbackCopyTextToClipboard(shareLink);

                    if (copied) {
                        copyBtn.disabled = true;
                        copyBtn.innerHTML = ICONS.copied + ' <span>Copied!</span>';
                        showToast('Link copied successfully!', 'success');
                        setTimeout(() => {
                            copyBtn.innerHTML = ICONS.copy + ' <span>Copy Link</span>';
                            copyBtn.disabled = false;
                        }, 2000);
                    } else {
                        showToast('Failed to copy link.', 'error');
                    }
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'action-btn delete-btn';
                deleteBtn.innerHTML = ICONS.trash + ' <span>Delete</span>';
                deleteBtn.title = 'Delete Video';
                deleteBtn.addEventListener('click', async function () {
                    const confirmed = await showConfirmModal(video.title);
                    if (confirmed) {
                        const buttons = card.querySelectorAll('.action-btn');
                        buttons.forEach(btn => btn.disabled = true);
                        deleteBtn.innerHTML = `<div class="spinner-overlay"><div class="loading-spinner"></div></div>` + ICONS.trash + ' <span>Deleting...</span>';
                        try {
                            const response = await fetch(`${API_URL}/videos/${video.id}`, { method: 'DELETE' });
                            if (!response.ok) {
                                const result = await response.json();
                                throw new Error(result.message || 'Failed to delete on server');
                            }
                            showToast(`Successfully deleted "${video.title}"`, 'success');
                        } catch (error) {
                            showToast(`Failed to delete: ${error.message}`, 'error');
                            buttons.forEach(btn => btn.disabled = false);
                            deleteBtn.innerHTML = ICONS.trash + ' <span>Delete</span>';
                        }
                    }
                });

                actions.append(copyBtn, deleteBtn);
                info.append(title, date, actions);
                card.append(placeholder, info);
                videoList.appendChild(card);
            });
        } catch (error) {
            videoList.innerHTML = '<p style="text-align:center; color: var(--danger-color);">Failed to load video library.</p>';
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
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'An unknown error occurred during the request');
            showToast(result.message, 'info');
            videoUrlInput.value = '';
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            downloadBtn.disabled = false;
            loadingIndicator.classList.add('hidden');
        }
    }

    async function fetchVersionInfo() {
        try {
            const response = await fetch(`${API_URL}/version`);
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const versions = await response.json();

            document.getElementById('medis-version').textContent = versions.medis || '1.0.0';
            document.getElementById('ytdlp-version').textContent = versions.ytdlp || 'N/A';
        } catch (error) {
            console.error('Version fetch error:', error.message);
            document.getElementById('medis-version').textContent = '1.0.0';
            document.getElementById('ytdlp-version').textContent = 'N/A';

        }
    }

    downloadBtn.addEventListener('click', handleDownload);
    videoUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleDownload();
    });

    themeButton.addEventListener('click', toggleThemeDropdown);

    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            setTheme(option.dataset.theme);
            hideThemeDropdown();
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.theme-switcher')) {
            hideThemeDropdown();
        }
    });

    initTheme();
    fetchAndRenderVideos();
    connectWebSocket();
    fetchVersionInfo();
});