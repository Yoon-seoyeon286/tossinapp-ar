/**
 * Watermark - 이미지에 워터마크를 추가하는 유틸리티 (위치/크기 강화판)
 */
window.Watermark = {
    apply: function (canvas, logoSrc, options = {}) {
        return new Promise((resolve) => {
            // 기본값을 logo.png로 시도
            const src = logoSrc || 'logo.png';
            const {
                opacity = 0.9,
                sizeRatio = 0.25, // 조금 더 크게
                margin = 50       // 테두리에서 더 안쪽으로
            } = options;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('[Watermark] Context error');
                resolve(canvas);
                return;
            }

            // === [초강력 디버그 표식] ===
            // 캔버스 크기에 비례하여 왼쪽 상단에 핫핑크색 사각형을 그립니다.
            // 이게 안 보인다면 이 함수 자체가 실행되지 않은 것입니다.
            const debugSize = Math.min(canvas.width, canvas.height) * 0.1;
            ctx.fillStyle = '#FF00FF'; // 핫핑크
            ctx.fillRect(20, 20, debugSize, debugSize);

            // 안내 텍스트 추가
            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Arial';
            ctx.fillText('DEBUG ON', 25, 45);

            const logo = new Image();
            logo.crossOrigin = "anonymous";

            logo.onload = () => {
                const logoSize = Math.min(canvas.width, canvas.height) * sizeRatio;
                // 우측 하단에서 충분히 안쪽으로 배치
                const logoX = canvas.width - logoSize - margin;
                const logoY = canvas.height - logoSize - margin;

                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
                ctx.restore();

                console.log('[Watermark] 합성 완료 (logo.png)');
                resolve(canvas);
            };

            logo.onerror = () => {
                console.warn('[Watermark] 로고 로드 실패:', src);
                // 실패 시 우측 하단에 빨간색 사각형이라도 그려서 위치 확인
                ctx.fillStyle = 'red';
                const s = 100;
                ctx.fillRect(canvas.width - s - margin, canvas.height - s - margin, s, s);
                resolve(canvas);
            };

            logo.src = src + '?v=' + Date.now();
        });
    }
};
