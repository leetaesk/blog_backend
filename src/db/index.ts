import { Pool } from "pg";
import config from "../config";

// 👇 [수정됨] 배포 환경(DATABASE_URL)과 로컬 개발 환경 호환 로직
const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : config.db;

// 설정 정보를 바탕으로 새로운 Pool 인스턴스를 생성합니다.
const pool = new Pool(poolConfig);

// 간단한 쿼리 실행을 위한 함수
export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("executed query", { text, duration, rows: res.rowCount });
    return res;
};

export default pool;
