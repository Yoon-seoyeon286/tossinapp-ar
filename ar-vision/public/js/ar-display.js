/**
 * AR 디스플레이 모듈 - Three.js 기반
 * 크로마키 이미지를 카메라 피드 위에 AR로 표시
 */
class ARDisplay {
    constructor(container, videoElement, canvasElement) {
        this.container = container;
        this.video = videoElement;
        this.canvas = canvasElement;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.imagePlane = null;
        this.imageTexture = null;

        this.isRunning = false;
        this.cameraStream = null;

        // 터치/드래그 상태
        this.isDragging = false;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.pinchStartDistance = 0;
        this.initialScale = 1;

        // 이미지 위치/스케일
        this.position = { x: 0, y: 0 };
        this.scale = 0.5;
        this.minScale = 0.1;
        this.maxScale = 2.0;

        this._boundAnimate = this._animate.bind(this);

        // 워터마크 이미지
        this.watermarkImage = null;
        this._loadWatermark();
    }

    /**
     * 워터마크 이미지 로드
     */
    _loadWatermark() {
        this.watermarkImage = new Image();
        this.watermarkImage.src = 'logo.png';
        this.watermarkImage.onerror = () => {
            console.log('[ARDisplay] logo.png 로드 실패, el-logo.png 시도');
            this.watermarkImage.src = 'el-logo.png';
        };
        this.watermarkImage.onload = () => {
            console.log('[ARDisplay] 워터마크 이미지 준비 완료');
        };
    }

    /**
     * AR 디스플레이 초기화
     */
    async initialize() {
        // Three.js 씬 설정
        this.scene = new THREE.Scene();

        // 직교 카메라 (2D 오버레이)
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
        this.camera.position.z = 1;

        // 렌더러 설정
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0);

        // 리사이즈 핸들러
        window.addEventListener('resize', () => this._onResize());

        // 터치/마우스 이벤트 설정
        this._setupInteraction();

        console.log('[ARDisplay] 초기화 완료');
    }

    /**
     * 카메라 시작
     */
    async startCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.cameraStream;
            await this.video.play();

            console.log('[ARDisplay] 카메라 시작됨');
            return true;

        } catch (error) {
            console.warn('[ARDisplay] 후면 카메라 실패, 전면 카메라 시도:', error);

            try {
                this.cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: false
                });
                this.video.srcObject = this.cameraStream;
                this.video.classList.add('mirror');
                await this.video.play();
                return true;

            } catch (e2) {
                console.error('[ARDisplay] 카메라 접근 실패:', e2);
                return false;
            }
        }
    }

    /**
     * 크로마키 이미지 설정 (투명 배경 PNG)
     */
    setImage(transparentCanvas) {
        // 기존 이미지 제거
        if (this.imagePlane) {
            this.scene.remove(this.imagePlane);
            if (this.imageTexture) {
                this.imageTexture.dispose();
            }
        }

        // 텍스처 생성
        this.imageTexture = new THREE.CanvasTexture(transparentCanvas);
        this.imageTexture.minFilter = THREE.LinearFilter;
        this.imageTexture.magFilter = THREE.LinearFilter;

        // 평면 지오메트리 생성 (이미지 비율 유지)
        const imageAspect = transparentCanvas.width / transparentCanvas.height;
        const geometry = new THREE.PlaneGeometry(imageAspect, 1);

        // 머티리얼 (투명 지원)
        const material = new THREE.MeshBasicMaterial({
            map: this.imageTexture,
            transparent: true,
            side: THREE.DoubleSide
        });

        this.imagePlane = new THREE.Mesh(geometry, material);
        this.imagePlane.scale.set(this.scale, this.scale, 1);

        this.scene.add(this.imagePlane);
        this._updatePosition();

        console.log('[ARDisplay] 이미지 설정 완료');
    }

    /**
     * AR 루프 시작
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._animate();
        console.log('[ARDisplay] AR 루프 시작');
    }

    /**
     * AR 루프 정지
     */
    stop() {
        this.isRunning = false;
        console.log('[ARDisplay] AR 루프 정지');
    }

    /**
     * AR 화면 스크린샷 캡처
     * @returns {HTMLCanvasElement} 캡처된 캔버스
     */
    captureScreenshot() {
        const screenshotCanvas = document.createElement('canvas');
        // 해상도를 위해 실제 비디오 크기 또는 컨테이너 크기 사용
        const width = this.video.videoWidth || this.container.clientWidth;
        const height = this.video.videoHeight || this.container.clientHeight;

        screenshotCanvas.width = width;
        screenshotCanvas.height = height;
        const ctx = screenshotCanvas.getContext('2d');

        // 1. 비디오 피드 그리기
        ctx.drawImage(this.video, 0, 0, width, height);

        // 2. AR 캔버스 (Three.js 렌더링) 오버레이
        ctx.drawImage(this.canvas, 0, 0, width, height);

        // 3. 워터마크 로고 직접 그리기 (준비된 경우)
        if (this.watermarkImage && this.watermarkImage.complete && this.watermarkImage.naturalWidth > 0) {
            // 원본 비율 계산
            const logoAspect = this.watermarkImage.naturalWidth / this.watermarkImage.naturalHeight;
            const logoWidth = Math.min(width, height) * 0.20; // 가로 크기 결정
            const logoHeight = logoWidth / logoAspect;      // 비율에 따른 세로 크기 결정

            const margin = 30;
            // 우측 하단 배치
            const x = width - logoWidth - margin;
            const y = height - logoHeight - margin;

            ctx.save();
            ctx.globalAlpha = 0.6; // 워터마크 느낌의 투명도
            ctx.drawImage(this.watermarkImage, x, y, logoWidth, logoHeight);
            ctx.restore();

            console.log('[ARDisplay] 워터마크 합성 완료 (비율 유지)');
        }

        console.log('[ARDisplay] 스크린샷 캡처 완료');
        return screenshotCanvas;
    }

    /**
     * 리소스 정리
     */
    dispose() {
        this.stop();

        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
        }

        if (this.imageTexture) {
            this.imageTexture.dispose();
        }

        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    // ========== Private Methods ==========

    _animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(this._boundAnimate);
        this.renderer.render(this.scene, this.camera);
    }

    _onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / height;

        this.camera.left = -aspect;
        this.camera.right = aspect;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    _updatePosition() {
        if (!this.imagePlane) return;

        // 화면 비율에 맞게 위치 조정
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.imagePlane.position.x = this.position.x * aspect;
        this.imagePlane.position.y = this.position.y;
    }

    _setupInteraction() {
        const container = this.container;

        // 터치 이벤트
        container.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        container.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        container.addEventListener('touchend', (e) => this._onTouchEnd(e));

        // 마우스 이벤트 (데스크톱)
        container.addEventListener('mousedown', (e) => this._onMouseDown(e));
        container.addEventListener('mousemove', (e) => this._onMouseMove(e));
        container.addEventListener('mouseup', () => this._onMouseUp());
        container.addEventListener('mouseleave', () => this._onMouseUp());

        // 마우스 휠 (스케일)
        container.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    }

    _onTouchStart(e) {
        e.preventDefault();

        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastTouchX = e.touches[0].clientX;
            this.lastTouchY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            // 핀치 시작
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            this.pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
            this.initialScale = this.scale;
        }
    }

    _onTouchMove(e) {
        e.preventDefault();

        if (e.touches.length === 1 && this.isDragging) {
            const deltaX = (e.touches[0].clientX - this.lastTouchX) / this.container.clientWidth * 2;
            const deltaY = -(e.touches[0].clientY - this.lastTouchY) / this.container.clientHeight * 2;

            this.position.x += deltaX;
            this.position.y += deltaY;
            this._updatePosition();

            this.lastTouchX = e.touches[0].clientX;
            this.lastTouchY = e.touches[0].clientY;

        } else if (e.touches.length === 2) {
            // 핀치 줌
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const scaleChange = distance / this.pinchStartDistance;
            this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.initialScale * scaleChange));

            if (this.imagePlane) {
                this.imagePlane.scale.set(this.scale, this.scale, 1);
            }
        }
    }

    _onTouchEnd(e) {
        if (e.touches.length === 0) {
            this.isDragging = false;
        }
    }

    _onMouseDown(e) {
        this.isDragging = true;
        this.lastTouchX = e.clientX;
        this.lastTouchY = e.clientY;
    }

    _onMouseMove(e) {
        if (!this.isDragging) return;

        const deltaX = (e.clientX - this.lastTouchX) / this.container.clientWidth * 2;
        const deltaY = -(e.clientY - this.lastTouchY) / this.container.clientHeight * 2;

        this.position.x += deltaX;
        this.position.y += deltaY;
        this._updatePosition();

        this.lastTouchX = e.clientX;
        this.lastTouchY = e.clientY;
    }

    _onMouseUp() {
        this.isDragging = false;
    }

    _onWheel(e) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * delta));

        if (this.imagePlane) {
            this.imagePlane.scale.set(this.scale, this.scale, 1);
        }
    }
}

// 전역 노출
window.ARDisplay = ARDisplay;
