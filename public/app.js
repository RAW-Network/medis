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

    const ICONS = {
        copy: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>`,
        trash: `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
    };

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 5000);
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
                    if (data.percent !== undefined && data.message) {
                        progressBarInner.style.width = `${data.percent}%`;
                        progressText.textContent = data.message;
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
            }
        };
    }

    async function fetchAndRenderVideos() {
        try {
            const response = await fetch(`${API_URL}/videos`);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const videos = await response.json();
            videoList.innerHTML = '';
            completedCountEl.textContent = videos.length;

            if (videos.length === 0) {
                videoList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">Your library is empty. Start by downloading a video.</p>';
                return;
            }

            videos.forEach(video => {
                const card = document.createElement('div');
                card.className = 'video-card';
                card.dataset.videoId = video.id;

                const placeholder = document.createElement('div');
                placeholder.className = 'card-video-placeholder';
                placeholder.dataset.src = `/videos/${video.filename}`;

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
                copyBtn.className = 'action-btn';
                copyBtn.innerHTML = ICONS.copy + ' <span>Copy Link</span>';
                copyBtn.title = 'Copy Shareable Link';
                copyBtn.addEventListener('click', () => {
                    const shareLink = `${window.location.origin}/share/${video.id}`;
                    navigator.clipboard.writeText(shareLink).then(() => showToast('Shareable link copied to clipboard!', 'success'));
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'action-btn';
                deleteBtn.innerHTML = ICONS.trash + ' <span>Delete</span>';
                deleteBtn.title = 'Delete Video';

                deleteBtn.addEventListener('click', async (e) => {
                    if (confirm(`Are you sure you want to delete "${video.title}"?`)) {
                        const cardToDelete = e.currentTarget.closest('.video-card');

                        cardToDelete.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        cardToDelete.style.opacity = '0';
                        cardToDelete.style.transform = 'scale(0.95)';

                        setTimeout(async () => {
                            try {
                                const response = await fetch(`${API_URL}/videos/${video.id}`, { method: 'DELETE' });
                                if (!response.ok) {
                                    throw new Error('Failed to delete on server.');
                                }
                                cardToDelete.remove();
                                completedCountEl.textContent = parseInt(completedCountEl.textContent) - 1;
                            } catch (error) {
                                showToast(`Error deleting "${video.title}". Restoring list.`, 'error');
                                cardToDelete.style.opacity = '1';
                                cardToDelete.style.transform = 'scale(1)';
                            }
                        }, 300);
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
            
            if (!response.ok) {
                throw new Error(result.message || 'An unknown error occurred during the request.');
            }
            
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
            if (!response.ok) throw new Error('Failed to fetch version');
            const versions = await response.json();
            document.getElementById('medis-version').textContent = versions.medis;
            document.getElementById('ytdlp-version').textContent = versions.ytdlp;
        } catch (error) {
            console.error(error);
            document.getElementById('medis-version').textContent = '1.0.0';
            document.getElementById('ytdlp-version').textContent = 'N/A';
        }
    }

    downloadBtn.addEventListener('click', handleDownload);
    videoUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleDownload();
    });

    fetchAndRenderVideos();
    connectWebSocket();
    fetchVersionInfo();
});