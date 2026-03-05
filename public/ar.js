// === State ===
let video = null;
let overlayCanvas = null;
let overlayCtx = null;
let hudImage = null;
let imgX = 0, imgY = 0;
let imgW = 0, imgH = 0;
let imgScale = 1.0;
let isRunning = false;
let currentFacing = 'environment';
let lastCapturedBlob = null;
let logoImage = null;

// 제스처 상태
const gesture = {
    isDragging: false,
    isPinching: false,
    dragStartX: 0,
    dragStartY: 0,
    objStartX: 0,
    objStartY: 0,
    pinchStartDist: 0,
    pinchStartScale: 1.0,
};

// IndexedDB 헬퍼 함수
function openImageDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ARImageDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images', { keyPath: 'id' });
            }
        };
    });
}

async function getImageFromDB() {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const request = store.get('arImage');
        request.onsuccess = () => {
            db.close();
            if (request.result && request.result.blob) {
                resolve(request.result.blob);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

// === 초기화 ===
async function init() {
    console.log('[AR] 초기화 시작');
    document.getElementById('loading-screen').classList.remove('hidden');

    let imageBlob = null;
    try {
        imageBlob = await getImageFromDB();
    } catch (e) {
        console.error('[AR] IndexedDB 에러:', e);
    }

    if (!imageBlob) {
        showError('이미지가 없습니다. 먼저 이미지를 업로드해주세요.');
        return;
    }

    try {
        updateLoading('카메라 연결 중...');
        await initCamera();

        updateLoading('캔버스 초기화...');
        initCanvas();

        updateLoading('이미지 로딩...');
        await loadImageFromBlob(imageBlob);

        initEvents();

        logoImage = new Image();
        logoImage.src = 'logo.png';

        hideLoading();
        showHint();

        isRunning = true;
        animate();

        console.log('[AR] 초기화 완료');

    } catch (error) {
        console.error('[AR] 초기화 실패:', error);
        showError('초기화 실패: ' + error.message);
    }
}

// === 카메라 초기화 ===
async function initCamera() {
    video = document.getElementById('video-background');
    if (!video) throw new Error('비디오 요소를 찾을 수 없습니다.');

    await _requestCameraPermission();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저에서는 카메라를 사용할 수 없습니다. Safari 또는 앱을 최신 버전으로 업데이트해 주세요.');
    }

    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    try {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
        } catch (envErr) {
            console.warn('[AR] 후면 카메라 실패, 기본 카메라 시도:', envErr.message);
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        video.srcObject = stream;

        await new Promise((resolve, reject) => {
            let done = false;
            const doneWith = (err) => {
                if (done) return;
                done = true;
                clearTimeout(tid);
                video.removeEventListener('loadedmetadata', onReady);
                video.removeEventListener('error', onErr);
                err ? reject(err) : resolve();
            };
            const onReady = () => doneWith(null);
            const onErr = (e) => doneWith(new Error(e.message || '비디오 로드 실패'));
            video.addEventListener('loadedmetadata', onReady);
            video.addEventListener('error', onErr);
            if (video.readyState >= 1) {
                doneWith(null);
                return;
            }
            const tid = setTimeout(() => {
                if (video.readyState >= 1) doneWith(null);
                else doneWith(new Error('비디오 스트림 준비 시간 초과'));
            }, 3000);
        });

        const playPromise = video.play();
        if (playPromise !== undefined) {
            await playPromise;
        }
        currentFacing = 'environment';

        console.log('[AR] 카메라 연결됨:', video.videoWidth, 'x', video.videoHeight);

    } catch (e) {
        console.error('[AR] 카메라 에러:', e.name, e.message, e);
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            throw new Error('카메라 권한이 거부되었습니다. 설정에서 카메라를 허용해 주세요.');
        }
        throw new Error('카메라 연결 실패: ' + (e.message || e.name || String(e)));
    }
}

// === 2D 캔버스 초기화 ===
function initCanvas() {
    const container = document.getElementById('canvas-container');
    const dpr = window.devicePixelRatio || 1;

    overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = window.innerWidth * dpr;
    overlayCanvas.height = window.innerHeight * dpr;
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.width = window.innerWidth + 'px';
    overlayCanvas.style.height = window.innerHeight + 'px';
    overlayCanvas.style.zIndex = '1';
    overlayCanvas.style.pointerEvents = 'none';

    overlayCtx = overlayCanvas.getContext('2d');
    container.appendChild(overlayCanvas);

    console.log('[AR] 캔버스 초기화 완료');
}

// === 이미지 로딩 ===
async function loadImageFromBlob(blob) {
    const objectURL = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectURL);
            hudImage = img;
            // 화면 높이의 40%를 기본 크기로
            imgH = window.innerHeight * 0.4;
            imgW = imgH * (img.width / img.height);
            imgX = window.innerWidth / 2;
            imgY = window.innerHeight / 2;
            imgScale = 1.0;
            console.log('[AR] 이미지 로딩 완료:', img.width, 'x', img.height);
            resolve();
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectURL);
            reject(new Error('이미지 로딩 실패'));
        };
        img.src = objectURL;
    });
}

// === 이벤트 설정 ===
function initEvents() {
    const touchArea = document.getElementById('touch-area');

    touchArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!hudImage) return;

        if (e.touches.length === 1) {
            gesture.isDragging = true;
            gesture.isPinching = false;
            gesture.dragStartX = e.touches[0].clientX;
            gesture.dragStartY = e.touches[0].clientY;
            gesture.objStartX = imgX;
            gesture.objStartY = imgY;
        } else if (e.touches.length === 2) {
            gesture.isDragging = false;
            gesture.isPinching = true;
            gesture.pinchStartDist = getTouchDistance(e.touches);
            gesture.pinchStartScale = imgScale;
        }
    }, { passive: false });

    touchArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!hudImage) return;

        if (gesture.isDragging && e.touches.length === 1) {
            imgX = gesture.objStartX + (e.touches[0].clientX - gesture.dragStartX);
            imgY = gesture.objStartY + (e.touches[0].clientY - gesture.dragStartY);
        } else if (gesture.isPinching && e.touches.length === 2) {
            const ratio = getTouchDistance(e.touches) / gesture.pinchStartDist;
            imgScale = Math.max(0.3, Math.min(5.0, gesture.pinchStartScale * ratio));
        }
    }, { passive: false });

    touchArea.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            gesture.isDragging = false;
            gesture.isPinching = false;
        } else if (e.touches.length === 1) {
            gesture.isPinching = false;
            gesture.isDragging = true;
            gesture.dragStartX = e.touches[0].clientX;
            gesture.dragStartY = e.touches[0].clientY;
            gesture.objStartX = imgX;
            gesture.objStartY = imgY;
        }
    });

    let mouseDown = false;
    touchArea.addEventListener('mousedown', (e) => {
        if (!hudImage) return;
        mouseDown = true;
        gesture.dragStartX = e.clientX;
        gesture.dragStartY = e.clientY;
        gesture.objStartX = imgX;
        gesture.objStartY = imgY;
    });

    touchArea.addEventListener('mousemove', (e) => {
        if (!mouseDown || !hudImage) return;
        imgX = gesture.objStartX + (e.clientX - gesture.dragStartX);
        imgY = gesture.objStartY + (e.clientY - gesture.dragStartY);
    });

    touchArea.addEventListener('mouseup', () => { mouseDown = false; });
    touchArea.addEventListener('mouseleave', () => { mouseDown = false; });

    touchArea.addEventListener('wheel', (e) => {
        if (!hudImage) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        imgScale = Math.max(0.3, Math.min(5.0, imgScale * delta));
    }, { passive: false });

    document.getElementById('btn-back').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    document.getElementById('btn-switch-camera').addEventListener('click', switchCamera);

    document.getElementById('btn-new-image').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    document.getElementById('btn-capture').addEventListener('click', captureScreen);
    document.getElementById('btn-download').addEventListener('click', downloadCapture);

    document.getElementById('hint-overlay').addEventListener('click', () => {
        document.getElementById('hint-overlay').classList.remove('visible');
    });

    window.addEventListener('resize', onResize);

    console.log('[AR] 이벤트 설정 완료');
}

// === 유틸리티 ===
function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// === 카메라 전환 ===
async function switchCamera() {
    currentFacing = currentFacing === 'environment' ? 'user' : 'environment';

    try {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentFacing,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        video.srcObject = stream;
        video.classList.toggle('mirror', currentFacing === 'user');
        await video.play();

        console.log('카메라 전환:', currentFacing);

    } catch (e) {
        console.error('카메라 전환 실패:', e);
    }
}

// === 화면 캡처 ===
async function captureScreen() {
    console.log('[AR] captureScreen 호출됨');
    if (!video || !overlayCanvas) {
        alert('카메라 또는 AR 화면을 준비할 수 없습니다.');
        return;
    }

    try {
        const flash = document.getElementById('capture-flash');
        flash.classList.add('flash');
        setTimeout(() => flash.classList.remove('flash'), 100);

        showToast('캡처 중... 잠시만 기다려주세요');

        const canvas = document.createElement('canvas');
        canvas.width = overlayCanvas.width;
        canvas.height = overlayCanvas.height;
        const ctx = canvas.getContext('2d');

        const isMirrored = currentFacing === 'user';
        drawVideoCover(ctx, video, canvas.width, canvas.height, isMirrored);

        ctx.drawImage(overlayCanvas, 0, 0);

        if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
            const logoAspect = logoImage.naturalWidth / logoImage.naturalHeight;
            const lWidth = Math.min(canvas.width, canvas.height) * 0.20;
            const lHeight = lWidth / logoAspect;
            const lMargin = 30;
            const lx = canvas.width - lWidth - lMargin;
            const ly = canvas.height - lHeight - lMargin;

            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.drawImage(logoImage, lx, ly, lWidth, lHeight);
            ctx.restore();
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText('LOGO', canvas.width - 150, canvas.height - 50);
        }

        canvas.toBlob((blob) => {
            if (blob) {
                lastCapturedBlob = blob;
                console.log('[AR] 캡처 Blob 크기:', (blob.size / 1024).toFixed(0) + 'KB');

                const downloadBtn = document.getElementById('btn-download');
                downloadBtn.style.opacity = '1';
                downloadBtn.style.pointerEvents = 'auto';

                showToast('촬영 완료! 저장 버튼을 누르세요.');
            } else {
                showToast('캡처 실패 (Canvas 오류)');
            }
        }, 'image/jpeg', 0.85);

    } catch (err) {
        console.error('[AR] 캡처 중 치명적 오류:', err);
        alert('캡처 중 오류가 발생했습니다: ' + err.message);
    }
}

function drawVideoCover(ctx, video, canvasWidth, canvasHeight, mirror = false) {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (videoWidth === 0 || videoHeight === 0) return;

    const videoRatio = videoWidth / videoHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let sx, sy, sWidth, sHeight;

    if (videoRatio > canvasRatio) {
        sHeight = videoHeight;
        sWidth = videoHeight * canvasRatio;
        sx = (videoWidth - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = videoWidth;
        sHeight = videoWidth / canvasRatio;
        sx = 0;
        sy = (videoHeight - sHeight) / 2;
    }

    if (mirror) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sWidth, sHeight, -canvasWidth, 0, canvasWidth, canvasHeight);
        ctx.restore();
    } else {
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);
    }
}

// === 다운로드 ===
async function downloadCapture() {
    if (!lastCapturedBlob) {
        showToast('먼저 촬영(동그란 버튼)을 해주세요!');
        return;
    }

    showToast('저장 중...');

    try {
        await _saveToGallery(lastCapturedBlob);
        showToast('갤러리에 저장되었습니다');
    } catch (err) {
        var errMsg = err && err.message ? err.message : String(err);
        console.error('[AR] 저장 실패:', errMsg);
        showToast('저장 실패: ' + errMsg);
    }
}

// === 리사이즈 ===
function onResize() {
    const dpr = window.devicePixelRatio || 1;
    overlayCanvas.width = window.innerWidth * dpr;
    overlayCanvas.height = window.innerHeight * dpr;
    overlayCanvas.style.width = window.innerWidth + 'px';
    overlayCanvas.style.height = window.innerHeight + 'px';
}

// === UI 함수 ===
function updateLoading(text) {
    document.getElementById('loading-text').textContent = text;
}

function hideLoading() {
    document.getElementById('loading-screen').classList.add('hidden');
}

function showError(message) {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-screen').classList.add('visible');
}

function showHint() {
    document.getElementById('hint-overlay').classList.add('visible');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => {
        toast.classList.remove('visible');
    }, 2000);
}

// === 렌더 루프 ===
function animate() {
    if (!isRunning) return;
    requestAnimationFrame(animate);

    const dpr = window.devicePixelRatio || 1;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (hudImage) {
        const w = imgW * imgScale * dpr;
        const h = imgH * imgScale * dpr;
        overlayCtx.drawImage(hudImage, imgX * dpr - w / 2, imgY * dpr - h / 2, w, h);
    }
}

// === 시작 ===
(async function start() {
    let imageBlob = null;
    try {
        imageBlob = await getImageFromDB();
    } catch (e) {
        console.error('[AR] IndexedDB 에러:', e);
    }
    if (!imageBlob) {
        showError('이미지가 없습니다. 먼저 이미지를 업로드해주세요.');
        return;
    }
    const tapEl = document.getElementById('tap-to-start');
    tapEl.addEventListener('click', function onTap() {
        tapEl.removeEventListener('click', onTap);
        tapEl.classList.add('hidden');
        init();
    }, { once: true });
})();
