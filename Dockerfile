FROM node:18-alpine

WORKDIR /app

# 의존성 설치
COPY package.json package-lock.json* ./
RUN npm install

# 소스 복사
COPY public ./public

# 포트 설정
ENV PORT=3000
EXPOSE 3000

# 서버 실행
CMD ["npm", "start"]
