// utils/recorder.js - Browser-side DOM-to-Canvas UI testing & recording (Permission-free)

export async function runAutoUITest() {
  console.log("[AutoTest] Starting Permission-free UI Recording...");

  // 1. Inject html2canvas library dynamically from CDN
  if (!window.html2canvas) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    console.log("[AutoTest] html2canvas loaded successfully.");
  }

  // 2. Create a fake visual cursor element
  const cursor = document.createElement('div');
  cursor.id = 'fake-cursor';
  Object.assign(cursor.style, {
    position: 'fixed',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#3b82f6',
    border: '2px solid #ffffff',
    boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
    zIndex: '99999',
    pointerEvents: 'none',
    transition: 'all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)',
    top: '50%',
    left: '50%',
    transform: 'translate(-8px, -8px)'
  });
  document.body.appendChild(cursor);

  const moveCursorTo = (selector, offset = { x: 8, y: 8 }) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    cursor.style.left = `${rect.left + offset.x}px`;
    cursor.style.top = `${rect.top + offset.y}px`;
    return el;
  };

  const triggerHover = (selector, active = true) => {
    const el = document.querySelector(selector);
    if (!el) return;
    if (active) {
      el.classList.add('hover-test-active');
    } else {
      el.classList.remove('hover-test-active');
    }
  };

  const flashClick = () => {
    cursor.style.transform = 'translate(-8px, -8px) scale(0.7)';
    setTimeout(() => {
      cursor.style.transform = 'translate(-8px, -8px) scale(1)';
    }, 150);
  };

  // 3. Create a canvas stream recorder
  const recordWidth = 1024;
  const recordHeight = 640;
  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = recordWidth;
  captureCanvas.height = recordHeight;
  const ctx = captureCanvas.getContext('2d');

  // Start recording the canvas
  const stream = captureCanvas.captureStream(20); // 20 fps
  const chunks = [];
  const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    console.log("[AutoTest] Uploading recorded WebM blob (size:", blob.size, "bytes)...");
    
    const formData = new FormData();
    formData.append('video', blob);
    
    try {
      const res = await fetch('/api/save-test-video', {
        method: 'POST',
        headers: { 'Content-Type': 'video/webm' },
        body: blob
      });
      const data = await res.json();
      console.log("[AutoTest] Video successfully saved on server!", data);
    } catch (err) {
      console.error("[AutoTest] Failed to upload video", err);
    }
  };

  mediaRecorder.start();

  // Continuously render DOM to Canvas using html2canvas in the background
  let isRecording = true;
  const renderLoop = async () => {
    if (!isRecording) return;
    try {
      const canvas = await html2canvas(document.body, {
        width: recordWidth,
        height: recordHeight,
        scale: 1,
        logging: false,
        backgroundColor: '#0b1120'
      });
      ctx.clearRect(0, 0, recordWidth, recordHeight);
      ctx.drawImage(canvas, 0, 0);
    } catch (err) {
      console.error("[AutoTest] Render loop error", err);
    }
    if (isRecording) {
      requestAnimationFrame(renderLoop);
    }
  };
  renderLoop();

  // 4. Automation Steps Timeline
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  await delay(1000);
  
  // Step 1: Write Link in input field
  console.log("[AutoTest] Step 1: Write Link");
  const inputEl = moveCursorTo('#video-url');
  await delay(800);
  flashClick();
  if (inputEl) {
    inputEl.focus();
    const link = "https://www.youtube.com/watch?v=tPEE9ZwTmy0";
    inputEl.value = link;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  await delay(1200);
  
  // Step 2: Click Download button
  console.log("[AutoTest] Step 2: Press Download");
  moveCursorTo('#download-btn', { x: 30, y: 15 });
  await delay(800);
  flashClick();
  const dwnBtn = document.querySelector('#download-btn');
  if (dwnBtn) dwnBtn.click();
  
  await delay(2500); // Simulate network latency and loading state display
  
  // Step 3: Hover video card to reveal actions
  console.log("[AutoTest] Step 3: Hover video card");
  const firstCard = document.querySelector('.video-card');
  if (firstCard) {
    const cardId = firstCard.id;
    moveCursorTo(`#${cardId}`, { x: 80, y: 40 });
    await delay(600);
    triggerHover(`#${cardId}`, true);
    await delay(1200);
    
    // Step 4: Click Copy Link button
    console.log("[AutoTest] Step 4: Click Copy Link");
    const copyBtn = firstCard.querySelector('.btn-copy-overlay');
    if (copyBtn) {
      const btnRect = copyBtn.getBoundingClientRect();
      cursor.style.left = `${btnRect.left + 16}px`;
      cursor.style.top = `${btnRect.top + 16}px`;
      await delay(600);
      flashClick();
      copyBtn.click();
    }
  }

  await delay(2000); // Display copied status and Toast

  // End Automation & Save
  console.log("[AutoTest] Test completed. Stopping recorder...");
  isRecording = false;
  await delay(500);
  mediaRecorder.stop();
  cursor.remove();
}
