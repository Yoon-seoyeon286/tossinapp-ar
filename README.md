# AR Chroma

MediaPipe Selfie Segmentation을 활용하여 사진에서 배경을 제거(크로마키 변환)하고, 이를 실시간 카메라 위에 AR로 표시하는 웹 애플리케이션입니다.

## 주요 기능

1. **지능형 배경 제거**: MediaPipe의 Selfie Segmentation 모델을 사용하여 사진 속 인물만 정교하게 추출합니다.
2. **크로마키 변환**: 추출된 인물 뒤에 초록색(#00FF00) 배경을 입혀 크로마키 이미지를 생성합니다.
3. **AR 오버레이**: Three.js를 활용하여 실시간 카메라 피드 위에 추출된 인물 이미지를 띄웁니다.
4. **인터랙티브 조작**: 터치(드래그)를 통한 위치 이동 및 핀치 줌을 통한 크기 조절을 지원합니다.
5. **스크린샷 및 워터마크**: 합성된 AR 화면을 촬영하여 저장할 수 있으며, 저장 시 브랜드 로고 워터마크가 자동으로 삽입됩니다.

## 기술 스택

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Segmentation**: [MediaPipe Selfie Segmentation](https://google.github.io/mediapipe/solutions/selfie_segmentation)
- **3D/AR Rendering**: [Three.js](https://threejs.org/)
- **Serving**: Node.js (npx serve)

## 프로젝트 구조

```
/
├── public/                 # 정적 리소스 및 웹 에셋
│   ├── css/                # 스타일시트 (style.css)
│   ├── js/                 # 핵심 로직
│   │   ├── app.js          # 앱 메인 제어 및 UI 이벤트
│   │   ├── ar-display.js   # Three.js 기반 AR 렌더링 및 조작
│   │   ├── segmentation.js # MediaPipe 배경 제거 모듈
│   │   └── watermark.js    # 이미지 저장용 워터마크 유틸リティ
│   ├── index.html          # 메인 페이지
│   └── logo.png            # 워터마크용 로고 이미지
├── package.json            # 의존성 및 스크립트 설정
└── Dockerfile              # 배포용 컨테이너 설정
```

## 설치 및 실행

### 로컬 실행
```bash
# 의존성 설치
npm install

# 가동 (http://localhost:3000)
npm run dev
```

### Docker 실행
```bash
docker build -t ar-chroma .
docker run -p 3000:3000 ar-chroma
```

## 사용법

1. 앱을 실행하고 '사진 선택' 버튼을 눌러 인물이 포함된 사진을 업로드합니다.
2. '배경 제거 시작' 버튼을 클릭하면 모델이 구동되어 배경을 지웁니다.
3. 결과 화면에서 'AR 보기' 탭을 선택하여 카메라 권한을 허용합니다.
4. 화면에 나타난 인물을 드래그하여 이동하거나, 두 손가락으로 크기를 조절합니다.
5. '사진 촬영' 버튼을 눌러 촬영한 뒤 '이미지 저장'을 클릭하여 결과물을 다운로드합니다.

## 라이선스

MIT License
