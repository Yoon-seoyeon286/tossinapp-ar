# 가상내짤 (AR Chroma)

이미지에서 배경을 자동으로 제거하고 AR로 표시하는 웹 앱입니다.

## 주요 기능

- 📷 **배경 제거**: MediaPipe를 사용한 자동 배경 제거
- 🎨 **크로마키 변환**: 초록색 배경으로 자동 변환
- 📱 **AR 디스플레이**: Three.js 기반 실시간 AR 오버레이
- 💾 **이미지 저장**: 워터마크가 포함된 결과 이미지 다운로드

## 기술 스택

- **MediaPipe Selfie Segmentation**: 배경 제거
- **Three.js**: AR 렌더링
- **Vanilla JavaScript**: 프론트엔드 로직

## 프로젝트 구조

```
tossinapp-ar/
├── public/
│   ├── css/
│   │   └── style.css          # 전체 스타일
│   ├── js/
│   │   ├── app.js             # 메인 앱 로직
│   │   ├── segmentation.js    # 배경 제거 처리
│   │   ├── ar-display.js      # AR 디스플레이
│   │   └── watermark.js       # 워터마크 기능
│   ├── index.html             # 메인 HTML
│   └── el-logo.png            # 로고 이미지
├── package.json
└── README.md
```

## 로컬 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 배포

Railway, Vercel 등 정적 호스팅 서비스에 배포 가능합니다.

```bash
npm start
```

## 사용 방법

1. 이미지 업로드 또는 드래그 앤 드롭
2. 배경 제거 처리 대기
3. 결과 확인 (원본/마스크/크로마키/AR)
4. AR 탭에서 📷 촬영 버튼으로 스크린샷 캡처
5. 저장 버튼으로 워터마크 포함 이미지 다운로드

## 라이선스

MIT
