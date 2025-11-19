# ------------------------------
# 1단계: 빌드용 (Builder)
# ------------------------------
FROM node:20 AS builder
WORKDIR /app

# 1. [중요] pnpm 설치 (기본 이미지엔 없어서 설치해야 함)
RUN npm install -g pnpm

# 2. 설정 파일 복사 (package.json이랑 락파일 둘 다!)
COPY package.json pnpm-lock.yaml ./

# 3. 의존성 설치 (frozen-lockfile은 버전 고정용, 안전함)
RUN pnpm install --frozen-lockfile

# 4. 소스 코드 전체 복사
COPY . .

# 5. TypeScript 빌드 (dist 폴더 생성)
# (package.json에 "build": "tsc" 가 있어야 함!)
RUN pnpm run build

# 2단계: 실행용 (Runner) - 가볍게 만들기
FROM node:20
WORKDIR /app

# 1. 여기도 pnpm 설치
RUN npm install -g pnpm

# 2. 설정 파일 복사
COPY package.json pnpm-lock.yaml ./

# 3. [중요] 배포용 라이브러리만 설치 (--prod)
# devDependencies(typescript, nodemon 등)는 여기서 다 걸러짐
RUN pnpm install --prod --frozen-lockfile

# 4. 빌드된 파일(dist)만 1단계에서 가져오기
COPY --from=builder /app/dist ./dist

# 5. 포트 열기
EXPOSE 3000

# 6. 서버 실행 (빌드된 파일 실행)
CMD ["node", "dist/server.js"]