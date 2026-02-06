FROM node:18-alpine

WORKDIR /app

# package.json 복사 및 의존성 설치
COPY package.json ./
RUN npm install

# 소스(public) 복사
COPY public/ ./public/

# 포트 노출
EXPOSE 3000

# 서버 실행 (npx serve 사용)
CMD ["npm", "start"]
