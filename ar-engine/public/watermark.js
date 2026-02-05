/**
 * Watermark Utility
 * Adds a logo watermark to a canvas.
 */
window.Watermark = {
    /**
     * Applies a watermark to the given canvas.
     * @param {HTMLCanvasElement} canvas - The target canvas.
     * @param {string} logoUrl - URL of the logo image.
     * @param {Object} options - Customization options.
     * @returns {Promise<HTMLCanvasElement>}
     */
    apply: function (canvas, logoUrl, options = {}) {
        return new Promise((resolve, reject) => {
            const defaults = {
                opacity: 0.8,    // Increased from 0.5
                margin: 20,
                sizeRatio: 0.20, // Increased from 0.15
                position: 'bottom-right'
            };
            const config = { ...defaults, ...options };

            const ctx = canvas.getContext('2d');
            console.log('[Watermark] Canvas size:', canvas.width, 'x', canvas.height);

            const logoSize = Math.min(canvas.width, canvas.height) * config.sizeRatio;
            let x, y;

            if (config.position === 'bottom-right') {
                x = canvas.width - logoSize - config.margin;
                y = canvas.height - logoSize - config.margin;
            } else {
                // Default to bottom-right for now
                x = canvas.width - logoSize - config.margin;
                y = canvas.height - logoSize - config.margin;
            }

            // DEBUG: 무조건 그리기 테스트 [Watermark v3]
            ctx.save();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 20;
            ctx.strokeRect(0, 0, canvas.width, canvas.height); // 테두리

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(canvas.width, canvas.height);
            ctx.moveTo(canvas.width, 0);
            ctx.lineTo(0, canvas.height);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.stroke();

            ctx.fillStyle = 'red';
            ctx.fillRect(x, y, logoSize, logoSize);
            ctx.restore();
            console.log('[Watermark v3] Aggressive debug drawing done at:', x, y);

            const logo = new Image();

            logo.onload = () => {
                ctx.save();
                ctx.globalAlpha = config.opacity;
                ctx.drawImage(logo, x, y, logoSize, logoSize);
                ctx.restore();
                console.log('[Watermark] Logo drawn successfully');
                resolve(canvas);
            };

            logo.onerror = (e) => {
                console.error('[Watermark] Failed to load logo:', logoUrl);
                // Resolve with original canvas even if logo fails
                resolve(canvas);
            };

            logo.src = logoUrl;
        });
    }
};
