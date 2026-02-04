/**
 * ImageProcessor.js
 *
 * @imgly/background-removal을 이용한 고품질 배경 제거 모듈
 * 이미지 업로드 → 배경 제거 → 투명 PNG 생성
 */

import { removeBackground } from '@imgly/background-removal';

export class ImageProcessor {
    constructor() {
        this.isReady = false;
        this.config = {
            debug: false,
            model: 'medium',  // 'small' | 'medium' | 'large'
            output: {
                format: 'image/png',
                quality: 0.9,
            }
        };
    }

    /**
     * 초기화 (모델 프리로드)
     */
    async init() {
        console.log('[ImageProcessor] 배경 제거 엔진 초기화 중...');

        // 첫 실행 시 모델이 다운로드됨 (캐시됨)
        this.isReady = true;
        console.log('[ImageProcessor] 초기화 완료!');
    }

    /**
     * 이미지 파일에서 배경 제거
     * @param {File} file - 이미지 파일
     * @param {Function} onProgress - 진행률 콜백 (0-100)
     * @returns {Promise<Blob>} - 투명 배경 PNG Blob
     */
    async processFile(file, onProgress = null) {
        if (!this.isReady) {
            throw new Error('ImageProcessor가 초기화되지 않음');
        }

        console.log('[ImageProcessor] 배경 제거 시작:', file.name);

        try {
            const blob = await removeBackground(file, {
                debug: this.config.debug,
                model: this.config.model,
                progress: (key, current, total) => {
                    const percent = Math.round((current / total) * 100);
                    if (onProgress) onProgress(percent);
                    console.log(`[ImageProcessor] ${key}: ${percent}%`);
                },
                output: this.config.output,
            });

            console.log('[ImageProcessor] 배경 제거 완료!');
            return blob;

        } catch (error) {
            console.error('[ImageProcessor] 배경 제거 실패:', error);
            throw error;
        }
    }

    /**
     * Blob을 Canvas로 변환
     * @param {Blob} blob - 이미지 Blob
     * @returns {Promise<HTMLCanvasElement>}
     */
    async blobToCanvas(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(img.src);
                resolve(canvas);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });
    }

    /**
     * 이미지 파일 처리 후 Canvas 반환
     * @param {File} file - 이미지 파일
     * @param {Function} onProgress - 진행률 콜백
     * @returns {Promise<HTMLCanvasElement>}
     */
    async processFileToCanvas(file, onProgress = null) {
        const blob = await this.processFile(file, onProgress);
        return await this.blobToCanvas(blob);
    }

    /**
     * Blob을 Data URL로 변환
     * @param {Blob} blob
     * @returns {Promise<string>}
     */
    blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 모델 품질 설정
     * @param {'small' | 'medium' | 'large'} model
     */
    setModel(model) {
        this.config.model = model;
    }

    /**
     * 정리
     */
    destroy() {
        this.isReady = false;
        console.log('[ImageProcessor] 정리 완료');
    }
}

export default ImageProcessor;
