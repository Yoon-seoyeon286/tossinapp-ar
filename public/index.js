// 배경 제거 라이브러리 동적 로딩 (페이지 렌더링 차단 방지)
var removeBackground = null;

(async function loadLibrary() {
    try {
        var mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.1/+esm');
        removeBackground = mod.removeBackground;
        console.log('[Upload] 배경 제거 라이브러리 로드 완료');
    } catch (e) {
        console.error('[Upload] 라이브러리 로드 실패:', e);
    }
})();

var processedImageBlob = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Upload] DOM 로드 완료');
    initApp();
});

function initApp() {
    var uploadArea = document.getElementById('upload-area');
    var fileInput = document.getElementById('file-input');
    var galleryBtn = document.getElementById('gallery-btn');
    var cameraBtn = document.getElementById('camera-btn');
    var previewContainer = document.getElementById('preview-container');
    var previewImage = document.getElementById('preview-image');
    var previewInfo = document.getElementById('preview-info');
    var progressContainer = document.getElementById('progress-container');
    var progressFill = document.getElementById('progress-fill');
    var progressText = document.getElementById('progress-text');
    var resultContainer = document.getElementById('result-container');
    var resultImage = document.getElementById('result-image');
    var arButton = document.getElementById('ar-button');
    var errorMessage = document.getElementById('error-message');

    galleryBtn.onclick = function() {
        fileInput.removeAttribute('capture');
        fileInput.click();
    };

    cameraBtn.onclick = function() {
        fileInput.setAttribute('capture', 'environment');
        fileInput.click();
    };

    uploadArea.onclick = function() {
        fileInput.removeAttribute('capture');
        fileInput.click();
    };

    fileInput.onchange = function(e) {
        var file = e.target.files[0];
        if (file) handleFile(file);
    };

    uploadArea.ondragover = function(e) {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    };

    uploadArea.ondragleave = function() {
        uploadArea.classList.remove('drag-over');
    };

    uploadArea.ondrop = function(e) {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        var file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFile(file);
        }
    };

    arButton.onclick = function(e) {
        e.preventDefault();
        goToAR();
    };

    async function handleFile(file) {
        if (file.size > 10 * 1024 * 1024) {
            showError('파일 크기가 너무 큽니다 (최대 10MB)');
            return;
        }
        if (!file.type.startsWith('image/')) {
            showError('이미지 파일만 지원됩니다');
            return;
        }
        hideError();

        var reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewInfo.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
            previewContainer.classList.add('visible');
        };
        reader.readAsDataURL(file);

        await processImage(file);
    }

    async function chokeAlpha(blob, amount) {
        amount = amount || 2;
        return new Promise(function(resolve) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var data = imageData.data;
                var w = canvas.width;
                var h = canvas.height;

                var alphaOrig = new Uint8Array(w * h);
                for (var i = 0; i < w * h; i++) {
                    alphaOrig[i] = data[i * 4 + 3];
                }

                for (var pass = 0; pass < amount; pass++) {
                    var alphaCopy = new Uint8Array(alphaOrig);
                    for (var y = 1; y < h - 1; y++) {
                        for (var x = 1; x < w - 1; x++) {
                            var idx = y * w + x;
                            var minAlpha = alphaCopy[idx];
                            for (var dy = -1; dy <= 1; dy++) {
                                for (var dx = -1; dx <= 1; dx++) {
                                    var nIdx = (y + dy) * w + (x + dx);
                                    minAlpha = Math.min(minAlpha, alphaCopy[nIdx]);
                                }
                            }
                            alphaOrig[idx] = minAlpha;
                        }
                    }
                }

                for (var i = 0; i < w * h; i++) {
                    data[i * 4 + 3] = alphaOrig[i];
                }
                ctx.putImageData(imageData, 0, 0);

                canvas.toBlob(function(resultBlob) {
                    URL.revokeObjectURL(img.src);
                    resolve(resultBlob);
                }, 'image/png');
            };
            img.src = URL.createObjectURL(blob);
        });
    }

    async function processImage(file) {
        if (!removeBackground) {
            showError('배경 제거 라이브러리를 로딩 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        progressContainer.classList.add('visible');
        resultContainer.classList.remove('visible');
        arButton.classList.remove('visible');
        progressFill.style.width = '0%';
        progressText.textContent = '모델 로딩 중...';

        try {
            var rawBlob = await removeBackground(file, {
                model: 'medium',
                output: { format: 'image/png', quality: 0.9 },
                progress: function(key, current, total) {
                    var percent = Math.round((current / total) * 100);
                    progressFill.style.width = (percent * 0.9) + '%';
                    if (percent < 30) {
                        progressText.textContent = '모델 로딩 중...';
                    } else if (percent < 70) {
                        progressText.textContent = '배경 분석 중...';
                    } else {
                        progressText.textContent = '배경 제거 중...';
                    }
                }
            });

            progressText.textContent = '테두리 정리 중...';
            progressFill.style.width = '95%';
            processedImageBlob = await chokeAlpha(rawBlob, 1);

            progressFill.style.width = '100%';
            progressText.textContent = '완료!';

            resultImage.src = URL.createObjectURL(processedImageBlob);
            resultContainer.classList.add('visible');
            arButton.classList.add('visible');

            setTimeout(function() {
                progressContainer.classList.remove('visible');
            }, 1000);
        } catch (error) {
            console.error('[Upload] 처리 실패:', error);
            showError('배경 제거에 실패했습니다: ' + error.message);
            progressContainer.classList.remove('visible');
        }
    }

    function openImageDB() {
        return new Promise(function(resolve, reject) {
            var request = indexedDB.open('ARImageDB', 1);
            request.onerror = function() { reject(request.error); };
            request.onsuccess = function() { resolve(request.result); };
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
            };
        });
    }

    async function saveImageToDB(blob) {
        var db = await openImageDB();
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('images', 'readwrite');
            tx.objectStore('images').put({ id: 'arImage', blob: blob });
            tx.oncomplete = function() { db.close(); resolve(); };
            tx.onerror = function() { db.close(); reject(tx.error); };
        });
    }

    async function goToAR() {
        if (!processedImageBlob) {
            alert('먼저 이미지를 업로드하고 배경 제거를 완료해주세요.');
            return;
        }
        try {
            arButton.querySelector('span').textContent = '로딩 중...';
            arButton.style.pointerEvents = 'none';
            await saveImageToDB(processedImageBlob);
            window.location.href = 'ar.html';
        } catch (err) {
            alert('오류가 발생했습니다: ' + err.message);
            arButton.querySelector('span').textContent = 'AR로 보기';
            arButton.style.pointerEvents = 'auto';
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('visible');
    }

    function hideError() {
        errorMessage.classList.remove('visible');
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    console.log('[Upload] 초기화 완료');
}
