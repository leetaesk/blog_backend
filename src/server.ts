import express from "express";
import cors from "cors";
import { query } from "./db"; // db 모듈에서 query 함수를 가져옵니다.
import postsRouter from "./posts/posts.route"; // posts 라우터를 import 합니다.
import categoriesRouter from "./categories/categories.route";
import authRouter from "./auth/auth.route";

const app = express();
const port = 3000;

// 허용할 출처(Origin) 목록
const allowedOrigins = ["http://localhost:5173"];

// CORS 옵션 설정
const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// CORS 미들웨어 적용
app.use(cors(corsOptions));

// JSON 파싱을 위한 미들웨어 추가
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Hello, I am the TypeScript backend!");
});

// api 등록
app.use("/api/posts", postsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/auth", authRouter);

// DB 연결 테스트를 위한 즉시 실행 함수 (유지)
(async () => {
  try {
    const result = await query("SELECT NOW()"); // DB의 현재 시간을 조회하는 쿼리
    console.log(
      "✅ Database connection successful. Current time:",
      result.rows[0].now
    );
  } catch (err) {
    console.error("🔥 Database connection failed.", err);
  }
})();

app.listen(port, () => {
  console.log(`🚀 Backend server is running on http://localhost:${port}`);
});
