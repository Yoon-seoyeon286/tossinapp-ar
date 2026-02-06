FROM node:18-alpine

WORKDIR /app

# package.json 복사 및 의존성 설치
COPY package.json ./
RUN npm install

# 소스(public) 복사
COPY public/ ./public/

# 포트 노출 (Railway는 환경 변수 PORT를 사용하지만 관례상 EXPOSE 추가)
EXPOSE 3000

# 서버 실행
CMD ["npm", "start"]
