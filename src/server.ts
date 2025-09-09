import express from "express";
import cors from "cors";

const app = express();
const port = 3000;

// 허용할 출처(Origin) 목록
const allowedOrigins = ["http://localhost:5173"];

// CORS 옵션 설정
const corsOptions = {
  origin: function (origin: any, callback: any) {
    // 요청의 Origin이 허용된 목록에 있는지 확인
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true); // 허용
    } else {
      callback(new Error("Not allowed by CORS")); // 거부
    }
  },
};

// 특정 출처만 허용하도록 CORS 미들웨어 적용
app.use(cors(corsOptions));

app.get("/", (req, res) => {
  res.send("Hello, I am the TypeScript backend!");
});

app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
});

// 새로운 API 엔드포인트 추가
app.get("/api/test", (req, res) => {
  res.send("Hello Success connect the backend!");
});
