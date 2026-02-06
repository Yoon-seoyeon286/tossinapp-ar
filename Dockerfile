FROM node:18-alpine

WORKDIR /app

# 의존성 설치
COPY ar-engine/package.json ar-engine/package-lock.json* ./
RUN npm install

# 소스 복사
COPY ar-engine/ .

# 포트 노출
EXPOSE 3000

# 서버 실행
CMD ["node", "server.js"]
