/**
 * AR Vision - 이미지 배경 제거 + AR 표시 시스템
 *
 * Layer 1: Background (현실 세계) - 카메라 비디오
 * Layer 2: Virtual (가상 객체) - Three.js 3D 렌더링 (투명 배경)
 * Layer 3: Compositing (합성) - 알파 블렌딩으로 실시간 합성
 *
 * 동작 흐름:
 * 이미지 업로드 → MediaPipe 세그멘테이션 → 배경 초록색 대체 → 크로마키 제거 → AR 표시
 */

import * as THREE from 'three';
import { CameraPoseManager } from './CameraPoseManager.js';
import { ImageProcessor } from './ImageProcessor.js';
import { ImageUploadUI } from './ImageUploadUI.js';

class ARApp {
    constructor() {
        // === Layer 1: Background ===
        this.video = null;

        // === Layer 2: Virtual ===
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // === 이미지 처리 ===
        this.imageProcessor = null;      // MediaPipe 이미지 프로세서
        this.imageUploadUI = null;       // 이미지 업로드 UI
        this.cameraPoseManager = null;   // Three.js 카메라 매니저

        // === HUD 오브젝트 (화면에 붙어다니는 이미지) ===
        this.hudMesh = null;             // 화면에 고정된 메시
        this.hudMeshBaseScale = 1.0;     // 핀치 기준 스케일
        this.hudTexture = null;          // 이미지 텍스처

        // === 제스처 상태 ===
        this.gesture = {
            isDragging: false,
            isPinching: false,
            // 드래그 상태
            dragStartX: 0,
            dragStartY: 0,
            objStartX: 0,
            objStartY: 0,
            // 핀치 상태
            pinchStartDist: 0,
            pinchStartScale: 1.0,
        };

        // === Sensor (폴백용) ===
        this.deviceOrientation = { alpha: 0, beta: 0, gamma: 0 };
        this.initialOrientation = null;
        this.useGyroscope = false;

        // === State ===
        this.isRunning = false;
        this.isReady = false;

        console.log('[AR] 이미지 배경 제거 AR 시스템 초기화');
    }

    /**
     * 권한이 이미 승인된 후 호출되는 초기화 함수
     */
    async init() {
        console.log('========================================');
        console.log('    AR Vision - 이미지 배경 제거 AR');
        console.log('========================================');

        try {
            // Step 1: Layer 1 - 카메라 비디오 초기화
            window.updateLoadingProgress?.(20, '카메라 연결 중...');
            await this.initBackgroundLayer();

            // Step 2: Layer 2 - Three.js 가상 레이어 초기화
            window.updateLoadingProgress?.(40, '3D 엔진 초기화...');
            this.initVirtualLayer();

            // Step 3: MediaPipe 이미지 프로세서 초기화
            window.updateLoadingProgress?.(60, 'MediaPipe 로딩...');
            await this.initImageProcessor();

            // Step 3.5: 이미지 업로드 UI 생성
            window.updateLoadingProgress?.(70, 'UI 생성...');
            this.initImageUploadUI();

            // Step 4: 센서 리스너 등록
            window.updateLoadingProgress?.(80, '센서 연결 중...');
            this.initSensors();

            // Step 5: 이벤트 설정
            window.updateLoadingProgress?.(90, '이벤트 설정...');
            this.setupEvents();

            // 완료
            window.updateLoadingProgress?.(100, '완료!');
            this.isRunning = true;
            this.isReady = true;

            setTimeout(() => {
                window.hideLoadingScreen?.();
                // 안내 오버레이 표시
                if (window.showInstruction) window.showInstruction();
                console.log('========================================');
                console.log('          AR 준비 완료!');
                console.log('========================================');
            }, 500);

            // 렌더 루프 시작
            this.animate();

        } catch (e) {
            console.error('[AR] 초기화 실패:', e);
            this.updateStatus('초기화 실패: ' + e.message);
        }
    }

    /**
     * Layer 1: Background - 카메라 비디오
     */
    async initBackgroundLayer() {
        console.log('[Layer1] 카메라 비디오 연결');

        this.video = document.getElementById('video-background');
        if (!this.video) {
            throw new Error('video-background 엘리먼트 없음');
        }

        // 권한이 이미 승인되어 cameraStream이 존재하는 경우
        if (window.cameraStream) {
            console.log('[Layer1] 기존 카메라 스트림 사용');
            this.video.srcObject = window.cameraStream;

            if (this.video.paused) {
                this.video.muted = true;
                this.video.playsInline = true;
                await this.video.play();
            }

            console.log('[Layer1] 카메라 연결됨:', this.video.videoWidth, 'x', this.video.videoHeight);
            return true;
        }

        // 폴백: 직접 권한 요청
        console.log('[Layer1] 카메라 스트림 직접 요청');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            this.video.srcObject = stream;
            window.cameraStream = stream;

            this.video.muted = true;
            this.video.playsInline = true;
            await this.video.play();

            console.log('[Layer1] 카메라 시작:', this.video.videoWidth, 'x', this.video.videoHeight);
            return true;

        } catch (e) {
            console.error('[Layer1] 카메라 에러:', e);
            throw e;
        }
    }

    /**
     * Layer 2: Virtual - Three.js 3D 렌더링
     */
    initVirtualLayer() {
        console.log('[Layer2] Three.js 초기화');

        const container = document.getElementById('canvas-container');

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = null;  // 투명 배경

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            1000
        );
        this.camera.position.set(0, 0, 0);
        this.scene.add(this.camera);

        // Renderer - 투명 배경
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '1';
        this.renderer.domElement.style.pointerEvents = 'none';

        container.appendChild(this.renderer.domElement);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(1, 2, 1);
        this.scene.add(directional);

        // CameraPoseManager 초기화
        this.cameraPoseManager = new CameraPoseManager(this.camera);
        this.cameraPoseManager.setSmoothing(true, 0.2);

        console.log('[Layer2] Three.js 준비 완료');
    }

    /**
     * MediaPipe 이미지 프로세서 초기화
     */
    async initImageProcessor() {
        console.log('[ImageProcessor] MediaPipe 초기화');

        this.imageProcessor = new ImageProcessor();
        await this.imageProcessor.init();

        console.log('[ImageProcessor] 초기화 완료');
    }

    /**
     * 이미지 업로드 UI 초기화
     */
    initImageUploadUI() {
        console.log('[ImageUploadUI] UI 초기화');

        this.imageUploadUI = new ImageUploadUI({
            containerId: 'image-upload-container',
            onImageSelected: (file) => this.processAndPlaceImage(file),
            showPreview: true,
        });

        this.imageUploadUI.create();

        console.log('[ImageUploadUI] UI 생성 완료');
    }

    /**
     * 센서 초기화 (DeviceOrientation)
     */
    initSensors() {
        console.log('[Sensor] 센서 리스너 등록');

        if (window.sensorPermissionGranted !== false) {
            this.useGyroscope = true;
        }

        window.addEventListener('deviceorientation', (e) => this.onDeviceOrientation(e), true);
        console.log('[Sensor] DeviceOrientation 리스너 등록됨');
    }

    /**
     * DeviceOrientation 이벤트 핸들러
     */
    onDeviceOrientation(event) {
        if (event.alpha === null) return;

        this.deviceOrientation = {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma
        };

        if (!this.initialOrientation) {
            this.initialOrientation = { ...this.deviceOrientation };
            console.log('[Sensor] 초기 방향 저장:', this.initialOrientation);
        }
    }

    /**
     * 이벤트 설정 (드래그 + 핀치 제스처)
     */
    setupEvents() {
        console.log('[Event] 이벤트 설정');

        const touchArea = document.getElementById('touch-area');
        if (!touchArea) {
            console.error('[Event] touch-area 없음!');
            return;
        }

        // === 터치 이벤트 (모바일) ===
        touchArea.addEventListener('touchstart', (e) => {
            e.preventDefault();

            if (e.touches.length === 1 && this.hudMesh) {
                this.gesture.isDragging = true;
                this.gesture.isPinching = false;
                this.gesture.dragStartX = e.touches[0].clientX;
                this.gesture.dragStartY = e.touches[0].clientY;
                this.gesture.objStartX = this.hudMesh.position.x;
                this.gesture.objStartY = this.hudMesh.position.y;
            } else if (e.touches.length === 2 && this.hudMesh) {
                this.gesture.isDragging = false;
                this.gesture.isPinching = true;
                this.gesture.pinchStartDist = this.getTouchDistance(e.touches);
                this.gesture.pinchStartScale = this.hudMeshBaseScale;
            }
        }, { passive: false });

        touchArea.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.hudMesh) return;

            if (this.gesture.isDragging && e.touches.length === 1) {
                const dx = e.touches[0].clientX - this.gesture.dragStartX;
                const dy = e.touches[0].clientY - this.gesture.dragStartY;

                const scale = this.screenPixelToLocal();
                this.hudMesh.position.x = this.gesture.objStartX + dx * scale;
                this.hudMesh.position.y = this.gesture.objStartY - dy * scale;
            } else if (this.gesture.isPinching && e.touches.length === 2) {
                const dist = this.getTouchDistance(e.touches);
                const ratio = dist / this.gesture.pinchStartDist;
                const newScale = Math.max(0.3, Math.min(5.0, this.gesture.pinchStartScale * ratio));

                this.hudMeshBaseScale = newScale;
                this.hudMesh.scale.set(newScale, newScale, newScale);
            }
        }, { passive: false });

        touchArea.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.gesture.isDragging = false;
                this.gesture.isPinching = false;
            } else if (e.touches.length === 1) {
                this.gesture.isPinching = false;
                this.gesture.isDragging = true;
                this.gesture.dragStartX = e.touches[0].clientX;
                this.gesture.dragStartY = e.touches[0].clientY;
                this.gesture.objStartX = this.hudMesh ? this.hudMesh.position.x : 0;
                this.gesture.objStartY = this.hudMesh ? this.hudMesh.position.y : 0;
            }
        });

        // === 마우스 이벤트 (데스크탑) ===
        let mouseDown = false;
        touchArea.addEventListener('mousedown', (e) => {
            if (!this.hudMesh) return;
            mouseDown = true;
            this.gesture.dragStartX = e.clientX;
            this.gesture.dragStartY = e.clientY;
            this.gesture.objStartX = this.hudMesh.position.x;
            this.gesture.objStartY = this.hudMesh.position.y;
        });

        touchArea.addEventListener('mousemove', (e) => {
            if (!mouseDown || !this.hudMesh) return;

            const dx = e.clientX - this.gesture.dragStartX;
            const dy = e.clientY - this.gesture.dragStartY;
            const scale = this.screenPixelToLocal();

            this.hudMesh.position.x = this.gesture.objStartX + dx * scale;
            this.hudMesh.position.y = this.gesture.objStartY - dy * scale;
        });

        touchArea.addEventListener('mouseup', () => { mouseDown = false; });
        touchArea.addEventListener('mouseleave', () => { mouseDown = false; });

        // 마우스 휠: 스케일 조절
        touchArea.addEventListener('wheel', (e) => {
            if (!this.hudMesh) return;
            e.preventDefault();

            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.hudMeshBaseScale = Math.max(0.3, Math.min(5.0, this.hudMeshBaseScale * delta));
            this.hudMesh.scale.set(this.hudMeshBaseScale, this.hudMeshBaseScale, this.hudMeshBaseScale);
        }, { passive: false });

        // 카메라 전환 버튼
        const switchBtn = document.getElementById('camera-switch');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => this.switchCamera());
        }

        // 리사이즈
        window.addEventListener('resize', () => this.onResize());

        console.log('[Event] 제스처 이벤트 설정 완료');
    }

    /**
     * 두 터치 포인트 사이 거리 계산
     */
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 화면 1px을 카메라 로컬 좌표 단위로 변환
     */
    screenPixelToLocal() {
        const distance = 1.5;
        const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
        const screenHeight = window.innerHeight;
        return (2 * distance * Math.tan(fovRad / 2)) / screenHeight;
    }

    /**
     * 이미지 파일 처리 및 AR 배치
     * @param {File} file - 이미지 파일
     */
    async processAndPlaceImage(file) {
        if (!this.isReady || !this.imageProcessor) {
            console.log('[AR] 아직 준비 안됨');
            return;
        }

        console.log('[AR] ===== 이미지 처리 시작 =====');
        console.log('[AR] 파일명:', file.name);

        try {
            // 기존 HUD 정리
            this.cleanupHud();

            // MediaPipe로 배경 제거
            this.updateStatus('배경 제거 중...');
            const processedCanvas = await this.imageProcessor.processFile(file);

            // AR에 배치
            this.placeProcessedImage(processedCanvas);
            this.updateStatus('이미지 배치 완료!');

            // UI 상태 업데이트
            if (this.imageUploadUI) {
                this.imageUploadUI.showStatus('배치 완료! 드래그로 이동, 핀치로 크기 조절');
            }

        } catch (error) {
            console.error('[AR] 이미지 처리 실패:', error);
            this.updateStatus('이미지 처리 실패: ' + error.message);

            if (this.imageUploadUI) {
                this.imageUploadUI.showStatus('처리 실패: ' + error.message);
            }
        }
    }

    /**
     * 처리된 이미지를 AR에 배치 (크로마키 셰이더 적용)
     * @param {HTMLCanvasElement} canvas - 배경이 초록색으로 대체된 캔버스
     */
    placeProcessedImage(canvas) {
        console.log('[AR] 크로마키 이미지 배치');

        // 캔버스를 텍스처로 변환
        this.hudTexture = new THREE.CanvasTexture(canvas);
        this.hudTexture.colorSpace = THREE.SRGBColorSpace;
        this.hudTexture.minFilter = THREE.LinearFilter;
        this.hudTexture.magFilter = THREE.LinearFilter;

        // 크로마키 제거 셰이더 머티리얼
        const material = new THREE.ShaderMaterial({
            uniforms: {
                imageTexture: { value: this.hudTexture },
                keyColor: { value: new THREE.Color(0.0, 1.0, 0.0) },  // 초록
                similarity: { value: 0.4 },   // 색상 허용 범위
                smoothness: { value: 0.1 },   // 경계 부드러움
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D imageTexture;
                uniform vec3 keyColor;
                uniform float similarity;
                uniform float smoothness;
                varying vec2 vUv;

                vec2 RGBtoUV(vec3 rgb) {
                    return vec2(
                        rgb.r * -0.169 + rgb.g * -0.331 + rgb.b * 0.5 + 0.5,
                        rgb.r * 0.5 + rgb.g * -0.419 + rgb.b * -0.081 + 0.5
                    );
                }

                void main() {
                    vec4 texColor = texture2D(imageTexture, vUv);

                    vec2 chromaVec = RGBtoUV(texColor.rgb) - RGBtoUV(keyColor);
                    float chromaDist = sqrt(dot(chromaVec, chromaVec));

                    float alpha = smoothstep(similarity, similarity + smoothness, chromaDist);

                    gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
        });

        // 이미지 비율에 맞는 평면 생성
        const aspect = canvas.width / canvas.height;
        const height = 0.5;
        const width = height * aspect;

        const geometry = new THREE.PlaneGeometry(width, height);
        this.hudMesh = new THREE.Mesh(geometry, material);

        // 카메라의 자식으로 추가 → 화면에 고정
        this.hudMesh.position.set(0, 0, -1.5);
        this.hudMeshBaseScale = 1.0;
        this.hudMesh.scale.set(1, 1, 1);

        this.camera.add(this.hudMesh);

        console.log('[AR] 이미지 배치됨:', canvas.width, 'x', canvas.height);
    }

    /**
     * HUD 오브젝트 정리
     */
    cleanupHud() {
        if (this.hudMesh) {
            this.camera.remove(this.hudMesh);
            this.hudMesh.geometry.dispose();
            this.hudMesh.material.dispose();
            this.hudMesh = null;
        }
        if (this.hudTexture) {
            this.hudTexture.dispose();
            this.hudTexture = null;
        }
    }

    /**
     * 카메라 전환
     */
    async switchCamera() {
        if (window.switchCamera && typeof window.switchCamera === 'function') {
            await window.switchCamera();

            if (window.cameraStream && this.video) {
                this.video.srcObject = window.cameraStream;
            }
        }
    }

    /**
     * 리사이즈 핸들러
     */
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * 상태 표시 업데이트
     */
    updateStatus(text) {
        const el = document.getElementById('status');
        if (el) el.textContent = text;
    }

    /**
     * 메인 렌더 루프
     */
    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());

        // 센서 기반 카메라 업데이트
        this.updateCameraFromSensor();

        // 렌더링
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * 센서 기반 카메라 업데이트
     */
    updateCameraFromSensor() {
        if (!this.initialOrientation) return;

        if (this.cameraPoseManager) {
            const screenOrientation = window.orientation || 0;
            this.cameraPoseManager.applyDeviceOrientation(
                this.deviceOrientation.alpha,
                this.deviceOrientation.beta,
                this.deviceOrientation.gamma,
                screenOrientation
            );
        }
    }

    /**
     * 포즈 리셋
     */
    resetPose() {
        if (this.cameraPoseManager) {
            this.cameraPoseManager.reset();
        }
        this.initialOrientation = null;
        console.log('[AR] 포즈 리셋됨');
    }

    /**
     * 정리
     */
    destroy() {
        this.isRunning = false;
        this.cleanupHud();
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(t => t.stop());
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.imageProcessor) {
            this.imageProcessor.destroy();
        }
        if (this.imageUploadUI) {
            this.imageUploadUI.destroy();
        }
        console.log('[AR] 종료');
    }
}

// ==================== 앱 시작 ====================

const app = new ARApp();

// 전역 노출
window.arApp = app;
window.addEventListener('beforeunload', () => app.destroy());

// 전역 함수
window.resetARPose = () => app.resetPose();
window.processImage = (file) => app.processAndPlaceImage(file);

/**
 * 권한 승인 후 앱 시작
 */
function startARApp() {
    console.log('[Main] 권한 승인 완료 - AR 앱 시작');
    app.init();
}

// 권한 승인 이벤트 리스너
window.addEventListener('permissionsGranted', startARApp);

// 이미 권한이 승인된 경우
if (window.permissionsGranted) {
    startARApp();
}

// 데스크탑에서 시작 화면 없이 바로 시작
window.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    if (!startScreen || startScreen.classList.contains('hidden')) {
        if (!window.permissionsGranted) {
            console.log('[Main] 시작 화면 대기 중...');
        }
    }
});
