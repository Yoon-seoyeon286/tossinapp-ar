/**
 * ImageUploadUI.js
 *
 * 이미지 업로드 UI 컴포넌트
 * - 파일 선택 버튼
 * - 드래그 앤 드롭 지원
 * - 이미지 미리보기
 */

export class ImageUploadUI {
    constructor(options = {}) {
        this.container = null;
        this.fileInput = null;
        this.uploadButton = null;
        this.dropZone = null;
        this.previewImage = null;

        // 옵션
        this.options = {
            containerId: options.containerId || 'image-upload-container',
            onImageSelected: options.onImageSelected || (() => {}),
            acceptTypes: options.acceptTypes || 'image/*',
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024,  // 10MB
            showPreview: options.showPreview !== false,
        };
    }

    /**
     * UI 생성 및 DOM에 추가
     */
    create() {
        // 기존 컨테이너 확인
        this.container = document.getElementById(this.options.containerId);

        if (!this.container) {
            // 컨테이너 생성
            this.container = document.createElement('div');
            this.container.id = this.options.containerId;
            document.body.appendChild(this.container);
        }

        // 스타일 적용
        this.applyStyles();

        // UI 요소 생성
        this.container.innerHTML = `
            <div class="image-upload-wrapper">
                <input type="file" id="image-file-input" accept="${this.options.acceptTypes}" style="display:none;">

                <button id="image-upload-btn" class="upload-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span>이미지 업로드</span>
                </button>

                <div id="drop-zone" class="drop-zone hidden">
                    <p>이미지를 여기에 드롭하세요</p>
                </div>

                ${this.options.showPreview ? `
                <div id="image-preview-container" class="preview-container hidden">
                    <img id="image-preview" class="preview-image" alt="Preview">
                    <button id="clear-image-btn" class="clear-btn">✕</button>
                </div>
                ` : ''}

                <div id="upload-status" class="upload-status"></div>
            </div>
        `;

        // 요소 참조 저장
        this.fileInput = document.getElementById('image-file-input');
        this.uploadButton = document.getElementById('image-upload-btn');
        this.dropZone = document.getElementById('drop-zone');
        this.previewImage = document.getElementById('image-preview');

        // 이벤트 바인딩
        this.bindEvents();

        console.log('[ImageUploadUI] UI 생성 완료');
    }

    /**
     * 스타일 적용
     */
    applyStyles() {
        const styleId = 'image-upload-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${this.options.containerId} {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .image-upload-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }

            .upload-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 24px;
                background: rgba(0, 122, 255, 0.9);
                color: white;
                border: none;
                border-radius: 25px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0, 122, 255, 0.4);
                transition: all 0.2s ease;
            }

            .upload-btn:hover {
                background: rgba(0, 122, 255, 1);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 122, 255, 0.5);
            }

            .upload-btn:active {
                transform: translateY(0);
            }

            .drop-zone {
                width: 200px;
                height: 100px;
                border: 2px dashed rgba(255, 255, 255, 0.5);
                border-radius: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.3);
                color: white;
                transition: all 0.2s ease;
            }

            .drop-zone.drag-over {
                border-color: #00ff88;
                background: rgba(0, 255, 136, 0.2);
            }

            .drop-zone.hidden {
                display: none;
            }

            .preview-container {
                position: relative;
                max-width: 150px;
                max-height: 150px;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            }

            .preview-container.hidden {
                display: none;
            }

            .preview-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .clear-btn {
                position: absolute;
                top: 5px;
                right: 5px;
                width: 24px;
                height: 24px;
                background: rgba(255, 59, 48, 0.9);
                color: white;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                font-size: 14px;
                line-height: 1;
            }

            .upload-status {
                color: white;
                font-size: 14px;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
                min-height: 20px;
            }

            @media (max-width: 480px) {
                .upload-btn {
                    padding: 10px 20px;
                    font-size: 14px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // 업로드 버튼 클릭
        this.uploadButton.addEventListener('click', () => {
            this.fileInput.click();
        });

        // 파일 선택
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFile(file);
            }
        });

        // 드래그 앤 드롭
        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            this.dropZone?.classList.remove('hidden');
            this.dropZone?.classList.add('drag-over');
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('dragleave', (e) => {
            if (e.relatedTarget === null) {
                this.dropZone?.classList.add('hidden');
                this.dropZone?.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone?.classList.add('hidden');
            this.dropZone?.classList.remove('drag-over');

            const file = e.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFile(file);
            }
        });

        // 미리보기 삭제 버튼
        const clearBtn = document.getElementById('clear-image-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearPreview();
            });
        }
    }

    /**
     * 파일 처리
     * @param {File} file
     */
    handleFile(file) {
        // 파일 크기 검사
        if (file.size > this.options.maxFileSize) {
            this.showStatus('파일 크기가 너무 큽니다 (최대 10MB)');
            return;
        }

        // 파일 타입 검사
        if (!file.type.startsWith('image/')) {
            this.showStatus('이미지 파일만 업로드 가능합니다');
            return;
        }

        console.log('[ImageUploadUI] 파일 선택됨:', file.name, file.size);

        // 미리보기 표시
        if (this.options.showPreview && this.previewImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.previewImage.src = e.target.result;
                document.getElementById('image-preview-container')?.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }

        // 콜백 호출
        this.showStatus('처리 중...');
        this.options.onImageSelected(file);
    }

    /**
     * 미리보기 삭제
     */
    clearPreview() {
        if (this.previewImage) {
            this.previewImage.src = '';
        }
        document.getElementById('image-preview-container')?.classList.add('hidden');
        this.fileInput.value = '';
        this.showStatus('');
    }

    /**
     * 상태 메시지 표시
     * @param {string} message
     */
    showStatus(message) {
        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    /**
     * UI 숨기기
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * UI 표시
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }

    /**
     * 정리
     */
    destroy() {
        if (this.container) {
            this.container.remove();
        }
    }
}

export default ImageUploadUI;
