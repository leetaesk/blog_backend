import { Pool } from "pg";
import config from "../config";

// 설정 정보를 바탕으로 새로운 Pool 인스턴스를 생성합니다.
const pool = new Pool(config.db);

// 간단한 쿼리 실행을 위한 함수
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log("executed query", { text, duration, rows: res.rowCount });
  return res;
};

export default pool;
