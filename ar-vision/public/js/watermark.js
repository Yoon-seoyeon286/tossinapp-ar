/**
 * Watermark - 이미지에 워터마크를 추가하는 유틸리티
 */
const Watermark = {
    /**
     * 캔버스에 워터마크 적용
     * @param {HTMLCanvasElement} canvas - 원본 캔버스
     * @param {string} logoSrc - 로고 이미지 경로
     * @param {Object} options - 옵션 (opacity, sizeRatio, margin)
     * @returns {Promise<HTMLCanvasElement>}
     */
    apply: function(canvas, logoSrc, options = {}) {
        return new Promise((resolve, reject) => {
            const {
                opacity = 0.5,
                sizeRatio = 0.15,
                margin = 20
            } = options;

            const logo = new Image();

            logo.onload = () => {
                console.log('[Watermark] 로고 로드 성공');

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const ctx = tempCanvas.getContext('2d');

                ctx.drawImage(canvas, 0, 0);

                const logoSize = Math.min(tempCanvas.width, tempCanvas.height) * sizeRatio;
                const logoX = tempCanvas.width - logoSize - margin;
                const logoY = tempCanvas.height - logoSize - margin;

                console.log('[Watermark] 로고 위치:', { logoX, logoY, logoSize, opacity });

                ctx.globalAlpha = opacity;
                ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
                ctx.globalAlpha = 1.0;

                console.log('[Watermark] 워터마크 적용 완료');
                resolve(tempCanvas);
            };

            logo.onerror = (e) => {
                console.error('[Watermark] 로고 로드 실패:', e);
                reject(new Error('로고 이미지를 로드할 수 없습니다: ' + logoSrc));
            };

            logo.src = logoSrc;
            console.log('[Watermark] 로고 로딩 시작:', logoSrc);
        });
    }
};
