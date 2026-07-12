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
import usersRouter from "./users/users.route";
import { SitemapStream, streamToPromise } from "sitemap";
import { createGzip } from "zlib";
import { startBot } from "./bot";
import { startDailyKnowledge } from "./daily/dailyKnowledge";

const app = express();
app.set("trust proxy", 1); // 프록시 서버를 통한 요청을 신뢰
const port = 3000;

// const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = [
    "http://localhost:3001",
    "https://blog-frontend-delta-five.vercel.app",
    "https://www.leetaesk.com",
    "https://leetaesk.com",
];

const corsOptions = {
    origin: function (origin: any, callback: any) {
        // !origin은 서버끼리의 통신이나 Postman 같은 도구를 위해 허용
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            console.error(`🚫 CORS Blocked Origin: ${origin}`); // 디버깅용 로그 추가
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ==========================================
// 1. 일반 라우터 등록 (에러 핸들러보다 위에 있어야 함)
// ==========================================

const serverStartTime = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
});

app.get("/", (req, res) => {
    res.json({
        message: "Hello! My Blog Backend is Running! 🚀",
        deployedAt: serverStartTime,
        env: process.env.NODE_ENV || "development",
    });
});

// sitemap.xml 라우터
app.get("/sitemap.xml", async (req, res) => {
    res.header("Content-Type", "application/xml");
    res.header("Content-Encoding", "gzip");

    try {
        const smStream = new SitemapStream({
            hostname: "https://leetaesk.com",
        });
        const pipeline = smStream.pipe(createGzip());

        // 1. 고정 페이지 (메인)
        smStream.write({ url: "/", changefreq: "daily", priority: 1.0 });

        // 2. DB에서 게시글 가져오기 (SQL 방식 적용)
        // 실제 테이블명(posts)과 컬럼명(id)에 맞춰 수정해주세요.
        const postsResult = await query("SELECT id FROM posts");

        if (postsResult.rows && postsResult.rows.length > 0) {
            postsResult.rows.forEach((post: any) => {
                // 프론트엔드 URL 구조에 맞게 수정 (/posts/1, /article/1 등)
                smStream.write({
                    url: `/posts/${post.id}`,
                    changefreq: "weekly",
                    priority: 0.8,
                });
            });
        }

        smStream.end();

        pipeline.pipe(res).on("error", (e) => {
            throw e;
        });
    } catch (e) {
        console.error(e);
        res.status(500).end();
    }
});

// API 라우터들
app.use("/api/posts", postsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/auth", authRouter);
app.use("/api/images", imagesRouter);
app.use("/api/likes", likesRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/users", usersRouter);

// ==========================================
// 2. 에러 핸들링 미들웨어 (맨 마지막에 위치)
// ==========================================
app.use(
    (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
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
    },
);

// DB 연결 테스트
(async () => {
    try {
        const result = await query("SELECT NOW()");
        console.log(
            "✅ Database connection successful. Current time:",
            result.rows[0].now,
        );
    } catch (err) {
        console.error("🔥 Database connection failed.", err);
    }
})();

app.listen(port, "0.0.0.0", () => {
    // 한국 시간(KST)으로 보기 좋게 포맷팅
    const now = new Date().toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        hour12: false,
    });

    // 현재 실행 환경 (설정이 없으면 development로 표시)
    const env = process.env.NODE_ENV || "development";

    console.log(`
  ################################======================
  🛡️  Server listening on port: ${port}
  ################################======================
  📅  Time       : ${now} (KST)
  🌍  Env        : ${env}
  🔗  Local      : http://localhost:${port}
  ------------------------------------------------------
    `);

    // 디스코드 글쓰기 봇 시작 (토큰 없으면 내부에서 자동 비활성화)
    startBot();

    // 매일 아침 8시 "오늘의 개발지식" 크론잡 (웹훅 URL 없으면 자동 비활성화)
    startDailyKnowledge();
});
