/**
 * MediaPipe Selfie Segmentation 기반 배경 제거 모듈
 */
class BackgroundRemover {
    constructor() {
        this.selfieSegmentation = null;
        this.isReady = false;
        this.onProgress = null;
    }

    /**
     * MediaPipe Selfie Segmentation 모델 초기화
     */
    async initialize(onProgress) {
        this.onProgress = onProgress || (() => {});

        this.onProgress(10, 'MediaPipe 모델 초기화 중...');

        return new Promise((resolve, reject) => {
            try {
                this.selfieSegmentation = new SelfieSegmentation({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                    }
                });

                // 모델 설정 - 고품질 모드
                this.selfieSegmentation.setOptions({
                    modelSelection: 1,  // 0: general, 1: landscape (더 정확)
                    selfieMode: false   // false: 더 정확한 세그멘테이션
                });

                this.onProgress(30, '모델 로딩 중...');

                // 결과 콜백 설정
                this.selfieSegmentation.onResults((results) => {
                    this._lastResults = results;
                });

                // 초기화 완료
                this.selfieSegmentation.initialize().then(() => {
                    this.isReady = true;
                    this.onProgress(50, '모델 로딩 완료');
                    console.log('[Segmentation] MediaPipe 모델 초기화 완료');
                    resolve();
                }).catch(reject);

            } catch (error) {
                console.error('[Segmentation] 초기화 실패:', error);
                reject(error);
            }
        });
    }

    /**
     * 이미지에서 인물 세그멘테이션 수행
     * @param {HTMLImageElement|HTMLCanvasElement} image - 입력 이미지
     * @returns {Promise<{mask: ImageData, originalWidth: number, originalHeight: number}>}
     */
    async segment(image) {
        if (!this.isReady) {
            throw new Error('모델이 초기화되지 않았습니다');
        }

        this.onProgress(60, '인물 감지 중...');

        return new Promise((resolve, reject) => {
            // 결과 콜백을 일회성으로 설정
            const originalCallback = this.selfieSegmentation.onResults;

            this.selfieSegmentation.onResults((results) => {
                this.onProgress(80, '세그멘테이션 완료');

                // 마스크 추출
                const mask = results.segmentationMask;

                resolve({
                    mask: mask,
                    image: results.image,
                    originalWidth: image.width || image.videoWidth,
                    originalHeight: image.height || image.videoHeight
                });
            });

            // 이미지 전송
            this.selfieSegmentation.send({ image: image }).catch(reject);
        });
    }

    /**
     * 세그멘테이션 마스크를 사용하여 배경을 크로마키 색상으로 교체
     * @param {HTMLCanvasElement} originalCanvas - 원본 이미지 캔버스
     * @param {ImageBitmap|HTMLCanvasElement} mask - 세그멘테이션 마스크
     * @param {Object} options - 옵션 (chromaColor, smoothEdge 등)
     * @returns {{chromaCanvas: HTMLCanvasElement, maskCanvas: HTMLCanvasElement}}
     */
    applyChromaKey(originalCanvas, mask, options = {}) {
        const {
            chromaColor = { r: 0, g: 255, b: 0 },  // 초록색 크로마키
            smoothEdge = 3,  // 엣지 스무딩 정도
            threshold = 0.5  // 마스크 임계값
        } = options;

        this.onProgress(85, '크로마키 배경 적용 중...');

        const width = originalCanvas.width;
        const height = originalCanvas.height;

        // 마스크 캔버스 생성
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');

        // 마스크 그리기
        maskCtx.drawImage(mask, 0, 0, width, height);
        const maskData = maskCtx.getImageData(0, 0, width, height);

        // 크로마키 캔버스 생성
        const chromaCanvas = document.createElement('canvas');
        chromaCanvas.width = width;
        chromaCanvas.height = height;
        const chromaCtx = chromaCanvas.getContext('2d');

        // 원본 이미지 데이터 가져오기
        const originalCtx = originalCanvas.getContext('2d');
        const originalData = originalCtx.getImageData(0, 0, width, height);
        const chromaData = chromaCtx.createImageData(width, height);

        // 픽셀별 처리
        for (let i = 0; i < maskData.data.length; i += 4) {
            const maskValue = maskData.data[i] / 255;  // 0~1 범위

            if (maskValue > threshold) {
                // 인물 영역 - 원본 유지
                chromaData.data[i] = originalData.data[i];         // R
                chromaData.data[i + 1] = originalData.data[i + 1]; // G
                chromaData.data[i + 2] = originalData.data[i + 2]; // B
                chromaData.data[i + 3] = 255;                       // A
            } else if (maskValue > threshold - 0.1) {
                // 엣지 영역 - 블렌딩
                const blend = (maskValue - (threshold - 0.1)) / 0.1;
                chromaData.data[i] = Math.round(originalData.data[i] * blend + chromaColor.r * (1 - blend));
                chromaData.data[i + 1] = Math.round(originalData.data[i + 1] * blend + chromaColor.g * (1 - blend));
                chromaData.data[i + 2] = Math.round(originalData.data[i + 2] * blend + chromaColor.b * (1 - blend));
                chromaData.data[i + 3] = 255;
            } else {
                // 배경 영역 - 크로마키 색상
                chromaData.data[i] = chromaColor.r;
                chromaData.data[i + 1] = chromaColor.g;
                chromaData.data[i + 2] = chromaColor.b;
                chromaData.data[i + 3] = 255;
            }
        }

        chromaCtx.putImageData(chromaData, 0, 0);

        // 마스크 캔버스 시각화 (흑백)
        const visualMaskData = maskCtx.createImageData(width, height);
        for (let i = 0; i < maskData.data.length; i += 4) {
            const v = maskData.data[i];
            visualMaskData.data[i] = v;
            visualMaskData.data[i + 1] = v;
            visualMaskData.data[i + 2] = v;
            visualMaskData.data[i + 3] = 255;
        }
        maskCtx.putImageData(visualMaskData, 0, 0);

        this.onProgress(100, '처리 완료');

        return { chromaCanvas, maskCanvas };
    }

    /**
     * 투명 배경 PNG 생성 (인물만 추출)
     */
    extractPerson(originalCanvas, mask, threshold = 0.5) {
        const width = originalCanvas.width;
        const height = originalCanvas.height;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.drawImage(mask, 0, 0, width, height);
        const maskData = maskCtx.getImageData(0, 0, width, height);

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        const originalCtx = originalCanvas.getContext('2d');
        const originalData = originalCtx.getImageData(0, 0, width, height);
        const resultData = resultCtx.createImageData(width, height);

        for (let i = 0; i < maskData.data.length; i += 4) {
            const maskValue = maskData.data[i] / 255;

            if (maskValue > threshold) {
                resultData.data[i] = originalData.data[i];
                resultData.data[i + 1] = originalData.data[i + 1];
                resultData.data[i + 2] = originalData.data[i + 2];
                resultData.data[i + 3] = 255;
            } else if (maskValue > threshold - 0.1) {
                // 반투명 엣지
                const alpha = ((maskValue - (threshold - 0.1)) / 0.1) * 255;
                resultData.data[i] = originalData.data[i];
                resultData.data[i + 1] = originalData.data[i + 1];
                resultData.data[i + 2] = originalData.data[i + 2];
                resultData.data[i + 3] = Math.round(alpha);
            } else {
                resultData.data[i] = 0;
                resultData.data[i + 1] = 0;
                resultData.data[i + 2] = 0;
                resultData.data[i + 3] = 0;
            }
        }

        resultCtx.putImageData(resultData, 0, 0);
        return resultCanvas;
    }
}

// 전역 노출
window.BackgroundRemover = BackgroundRemover;
