document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';
    const videoUrlInput = document.getElementById('video-url');
    const downloadBtn = document.getElementById('download-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const videoList = document.getElementById('video-list');
    const downloadingCountEl = document.getElementById('downloading-count');
    const completedCountEl = document.getElementById('completed-count');
    const speedStatusEl = document.getElementById('speed-status');
    const downloadSpeedEl = document.getElementById('download-speed');
    const progressBarContainer = document.getElementById('progress-bar-container');
    const progressBarInner = document.getElementById('progress-bar-inner');
    const toastContainer = document.getElementById('toast-container');

    const ICONS = {
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
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
                    downloadingCountEl.textContent = data.activeDownloads;
                    if (data.activeDownloads > 0) {
                        speedStatusEl.style.display = 'flex';
                        progressBarContainer.style.display = 'block';
                    } else {
                        speedStatusEl.style.display = 'none';
                        progressBarContainer.style.display = 'none';
                    }
                    break;
                case 'progress':
                    downloadSpeedEl.textContent = data.speed;
                    if (data.percent) {
                        const percentValue = parseFloat(data.percent);
                        progressBarInner.style.width = percentValue + '%';
                        progressBarInner.textContent = Math.floor(percentValue) + '%';
                    }
                    break;
                case 'downloadComplete':
                case 'videoDeleted':
                    if (data.type === 'downloadComplete') {
                        showToast(`Downloaded: ${data.video.title.substring(0, 40)}...`, 'success');
                    } else {
                        showToast('Media list was updated', 'info');
                    }
                    fetchAndRenderVideos();
                    break;
                case 'downloadError':
                    showToast(data.message, 'error');
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
                videoList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">Your library is empty.</p>';
                return;
            }

            videos.forEach(video => {
                const card = document.createElement('div');
                card.className = 'video-card';

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
                copyBtn.title = 'Copy Video Link';
                copyBtn.addEventListener('click', () => {
                    const shareLink = `${window.location.origin}/share/${video.id}`;
                    navigator.clipboard.writeText(shareLink).then(() => showToast('Link copied to clipboard!', 'success'));
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'action-btn';
                deleteBtn.innerHTML = ICONS.trash + ' <span>Delete</span>';
                deleteBtn.title = 'Delete Video';
                deleteBtn.addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to delete "${video.title}"?`)) {
                        await fetch(`${API_URL}/videos/${video.id}`, { method: 'DELETE' });
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Download failed');
            }

            videoUrlInput.value = '';
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            downloadBtn.disabled = false;
            loadingIndicator.classList.add('hidden');
        }
    }

    downloadBtn.addEventListener('click', handleDownload);
    videoUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleDownload();
    });

    fetchAndRenderVideos();
    connectWebSocket();
});
