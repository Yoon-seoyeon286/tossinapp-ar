/**
 * AR Chroma - 메인 앱 로직
 */
(function() {
    'use strict';

    // ========== 상태 관리 ==========
    let selectedImage = null;
    let backgroundRemover = null;
    let arDisplay = null;

    // 처리 결과 저장
    let results = {
        original: null,
        mask: null,
        chroma: null,
        transparent: null
    };

    // ========== DOM 요소 ==========
    const $startScreen = document.getElementById('start-screen');
    const $processingScreen = document.getElementById('processing-screen');
    const $resultScreen = document.getElementById('result-screen');

    const $uploadArea = document.getElementById('upload-area');
    const $fileInput = document.getElementById('file-input');
    const $uploadBtn = document.getElementById('upload-btn');
    const $previewArea = document.getElementById('preview-area');
    const $previewCanvas = document.getElementById('preview-canvas');
    const $processBtn = document.getElementById('process-btn');
    const $resetBtn = document.getElementById('reset-btn');

    const $processingStatus = document.getElementById('processing-status');
    const $progressFill = document.getElementById('progress-fill');

    const $originalCanvas = document.getElementById('original-canvas');
    const $maskCanvas = document.getElementById('mask-canvas');
    const $chromaCanvas = document.getElementById('chroma-canvas');

    const $downloadChromaBtn = document.getElementById('download-chroma-btn');
    const $newImageBtn = document.getElementById('new-image-btn');

    const $tabBtns = document.querySelectorAll('.tab-btn');
    const $tabPanels = document.querySelectorAll('.tab-panel');

    const $arContainer = document.getElementById('ar-container');
    const $cameraVideo = document.getElementById('camera-video');
    const $arCanvas = document.getElementById('ar-canvas');
    const $arControls = document.getElementById('ar-controls');

    // ========== 초기화 ==========
    function init() {
        console.log('[App] 초기화 시작');

        // 파일 입력 이벤트
        $uploadBtn.addEventListener('click', () => $fileInput.click());
        $fileInput.addEventListener('change', handleFileSelect);

        // 드래그 앤 드롭
        $uploadArea.addEventListener('dragover', handleDragOver);
        $uploadArea.addEventListener('dragleave', handleDragLeave);
        $uploadArea.addEventListener('drop', handleDrop);

        // 버튼 이벤트
        $processBtn.addEventListener('click', processImage);
        $resetBtn.addEventListener('click', resetSelection);
        $newImageBtn.addEventListener('click', resetAll);
        $downloadChromaBtn.addEventListener('click', downloadChromaImage);

        // 탭 이벤트
        $tabBtns.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // AR 안내창 클릭 시 닫기
        if ($arControls) {
            $arControls.addEventListener('click', () => {
                $arControls.style.display = 'none';
            });
        }

        console.log('[App] 초기화 완료');
    }

    // ========== 파일 선택 ==========
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            loadImage(file);
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        $uploadArea.classList.add('dragover');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        $uploadArea.classList.remove('dragover');
    }

    function handleDrop(e) {
        e.preventDefault();
        $uploadArea.classList.remove('dragover');

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImage(file);
        }
    }

    function loadImage(file) {
        console.log('[App] 이미지 로드:', file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                selectedImage = img;

                // 프리뷰 표시
                const ctx = $previewCanvas.getContext('2d');

                // 최대 크기 제한 (성능 최적화)
                const maxSize = 1024;
                let width = img.width;
                let height = img.height;

                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }

                $previewCanvas.width = width;
                $previewCanvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                $uploadArea.classList.add('hidden');
                $previewArea.classList.remove('hidden');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function resetSelection() {
        selectedImage = null;
        $fileInput.value = '';
        $uploadArea.classList.remove('hidden');
        $previewArea.classList.add('hidden');
    }

    // ========== 이미지 처리 ==========
    async function processImage() {
        if (!selectedImage) return;

        console.log('[App] 이미지 처리 시작');

        // 화면 전환
        $startScreen.classList.add('hidden');
        $processingScreen.classList.remove('hidden');

        try {
            // BackgroundRemover 초기화
            backgroundRemover = new BackgroundRemover();

            await backgroundRemover.initialize((progress, status) => {
                updateProgress(progress, status);
            });

            // 세그멘테이션 실행
            const segResult = await backgroundRemover.segment($previewCanvas);

            // 크로마키 적용
            const { chromaCanvas, maskCanvas } = backgroundRemover.applyChromaKey(
                $previewCanvas,
                segResult.mask,
                { chromaColor: { r: 0, g: 255, b: 0 } }
            );

            // 투명 배경 버전 생성 (AR용)
            const transparentCanvas = backgroundRemover.extractPerson(
                $previewCanvas,
                segResult.mask
            );

            // 결과 저장
            results.original = $previewCanvas;
            results.mask = maskCanvas;
            results.chroma = chromaCanvas;
            results.transparent = transparentCanvas;

            // 결과 화면에 표시
            displayResults();

            // 화면 전환
            $processingScreen.classList.add('hidden');
            $resultScreen.classList.remove('hidden');

            console.log('[App] 처리 완료');

        } catch (error) {
            console.error('[App] 처리 실패:', error);
            alert('이미지 처리 중 오류가 발생했습니다: ' + error.message);

            $processingScreen.classList.add('hidden');
            $startScreen.classList.remove('hidden');
        }
    }

    function updateProgress(progress, status) {
        $progressFill.style.width = progress + '%';
        $processingStatus.textContent = status;
    }

    function displayResults() {
        // 원본
        copyCanvas(results.original, $originalCanvas);

        // 마스크
        copyCanvas(results.mask, $maskCanvas);

        // 크로마키
        copyCanvas(results.chroma, $chromaCanvas);
    }

    function copyCanvas(source, target) {
        target.width = source.width;
        target.height = source.height;
        target.getContext('2d').drawImage(source, 0, 0);
    }

    // ========== 탭 전환 ==========
    function switchTab(tabName) {
        // 탭 버튼 활성화
        $tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // 탭 패널 표시
        $tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === 'tab-' + tabName);
        });

        // AR 탭일 경우 AR 디스플레이 시작
        if (tabName === 'ar') {
            startARMode();
        } else {
            stopARMode();
        }
    }

    // ========== AR 모드 ==========
    async function startARMode() {
        if (!results.transparent) return;

        console.log('[App] AR 모드 시작');

        if (!arDisplay) {
            arDisplay = new ARDisplay($arContainer, $cameraVideo, $arCanvas);
            await arDisplay.initialize();
        }

        const cameraStarted = await arDisplay.startCamera();
        if (!cameraStarted) {
            alert('카메라에 접근할 수 없습니다.');
            return;
        }

        arDisplay.setImage(results.transparent);
        arDisplay.start();
    }

    function stopARMode() {
        if (arDisplay) {
            arDisplay.stop();
        }
    }

    // ========== 다운로드 ==========
    function downloadChromaImage() {
        if (!results.chroma) return;

        console.log('[App] 다운로드 시작 - 워터마크 적용');

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = results.chroma.width;
        tempCanvas.height = results.chroma.height;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });

        ctx.drawImage(results.chroma, 0, 0);

        const logo = new Image();
        
        logo.onload = () => {
            console.log('[App] 로고 로드 성공, 워터마크 추가 중...');
            
            const logoSize = Math.min(tempCanvas.width, tempCanvas.height) * 0.1;
            const margin = 15;
            const logoX = tempCanvas.width - logoSize - margin;
            const logoY = tempCanvas.height - logoSize - margin;

            console.log('[App] 로고 위치:', { logoX, logoY, logoSize });

            const logoCanvas = document.createElement('canvas');
            logoCanvas.width = logoSize;
            logoCanvas.height = logoSize;
            const logoCtx = logoCanvas.getContext('2d');
            
            logoCtx.drawImage(logo, 0, 0, logoSize, logoSize);
            
            const imageData = logoCtx.getImageData(0, 0, logoSize, logoSize);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
                data[i + 3] = data[i + 3] * 0.45;
            }
            
            logoCtx.putImageData(imageData, 0, 0);
            
            ctx.drawImage(logoCanvas, logoX, logoY);

            console.log('[App] 워터마크 적용 완료, 이미지 저장 중...');

            tempCanvas.toBlob((blob) => {
                console.log('[App] Blob 생성 완료:', blob.size, 'bytes');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'chroma-' + Date.now() + '.png';
                a.click();
                URL.revokeObjectURL(url);
                console.log('[App] 다운로드 완료');
            }, 'image/png');
        };
        
        logo.onerror = (e) => {
            console.error('[App] 로고 로드 실패:', e);
            console.error('[App] 로고 경로 확인 필요: ./el-logo.png');
            
            tempCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'chroma-' + Date.now() + '.png';
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
        
        logo.src = './el-logo.png';
        console.log('[App] 로고 로딩 시작:', logo.src);
    }

    // ========== 리셋 ==========
    function resetAll() {
        // AR 정리
        if (arDisplay) {
            arDisplay.dispose();
            arDisplay = null;
        }

        // 결과 초기화
        results = {
            original: null,
            mask: null,
            chroma: null,
            transparent: null
        };

        // 선택 초기화
        resetSelection();

        // 화면 전환
        $resultScreen.classList.add('hidden');
        $startScreen.classList.remove('hidden');

        // 첫 번째 탭으로 리셋
        switchTab('original');
    }

    // ========== 시작 ==========
    document.addEventListener('DOMContentLoaded', init);
})();
