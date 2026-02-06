FROM node:18-alpine

WORKDIR /app

# ar-engine 디렉토리의 의존성 설치
COPY ar-engine/package.json ar-engine/package-lock.json* ./
RUN npm install --include=dev

# ar-engine 소스 복사
COPY ar-engine/ .

# webpack 빌드
RUN npm run build

# 포트 노출
EXPOSE 3000

# 서버 실행
CMD ["node", "server.js"]
