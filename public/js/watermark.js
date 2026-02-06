/**
 * Watermark - 이미지에 워터마크를 추가하는 유틸리티
 */
window.Watermark = {
    apply: function (canvas, logoSrc, options = {}) {
        return new Promise((resolve) => {
            const src = logoSrc || 'el-logo.png';
            const {
                opacity = 0.5,
                sizeRatio = 0.1,
                margin = 20
            } = options;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('[Watermark] Context error');
                resolve(canvas);
                return;
            }

            const logo = new Image();

            logo.onload = () => {
                const logoSize = Math.min(canvas.width, canvas.height) * sizeRatio;
                const logoX = canvas.width - logoSize - margin;
                const logoY = canvas.height - logoSize - margin;

                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
                ctx.restore();

                resolve(canvas);
            };

            logo.onerror = () => {
                console.warn('[Watermark] 로고 로드 실패:', src);
                resolve(canvas);
            };

            logo.src = src;
        });
    }
};
