import express from "express";
import cors from "cors";
import { query } from "./db";
import postsRouter from "./posts/posts.route";
import categoriesRouter from "./categories/categories.route";
import authRouter from "./auth/auth.route";
import imagesRouter from "./images/images.routes";
import cookieParser from "cookie-parser";
import likesRouter from "./likes/likes.route";
import commentsRouter from "./comments/comments.route";

const app = express();
const port = 3000;

// 추후 개발 환경에서 maxAge 줄이기
// const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = ["http://localhost:5173"];
const corsOptions = {
    origin: function (origin: any, callback: any) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200, // 일부 구형 브라우저 호환성을 위해
    maxAge: 86400,
    // maxAge: isProduction ? 86400 : 600, // 운영: 24시간, 개발: 10분
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// api 등록
app.use("/api/posts", postsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/auth", authRouter);
app.use("/api/images", imagesRouter);
app.use("/api/likes", likesRouter);
app.use("/api/comments", commentsRouter);

// ✨ ===== 중앙 에러 핸들링 미들웨어 추가 ===== ✨
// ❗ 모든 라우터 등록 후에, 그리고 서버 실행(listen) 전에 위치해야 합니다.
app.use(
    (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        // Axios 에러인 경우 상세 에러를 로그에 남깁니다.
        if (err.isAxiosError) {
            console.error("🔥🔥🔥 Axios Error Details:", err.response?.data);
        } else {
            console.error("🔥🔥🔥 Unhandled Error:", err.stack);
        }

        const statusCode = err.status || 500;
        const message = err.message || "서버 내부 에러가 발생했습니다.";

        res.status(statusCode).json({
            isSuccess: false,
            code: err.code || "UNKNOWN_ERROR",
            message,
        });
    }
);

// DB 연결 테스트
(async () => {
    try {
        const result = await query("SELECT NOW()");
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
