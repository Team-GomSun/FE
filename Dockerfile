FROM node:22-alpine

# 필요한 툴 설치
RUN apk add --no-cache git

# 작업 디렉토리 설정
WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./

# 의존성 설치
-RUN pnpm install
+RUN pnpm install --frozen-lockfile
# 소스 코드 복사
COPY . .

# 개발 서버 포트
EXPOSE 3000

# 개발 서버 실행
CMD ["pnpm", "run", "dev"]