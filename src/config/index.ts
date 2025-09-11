import dotenv from "dotenv";

// .env 파일의 환경 변수를 process.env에 로드합니다.
dotenv.config();

const config = {
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
};

export default config;
