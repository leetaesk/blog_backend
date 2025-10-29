import { Router } from "express";
import {
    getArchiveController,
    getPostByIdController,
    postPostController,
} from "./posts.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

// GET /api/posts
// 모든 글 목록 (/archive 페이지)
router.get("/", getArchiveController);

// POST /api/posts
// 글 작성
router.post("/", authMiddleware, postPostController);

// GET /api/posts/:postId
// 글 상세 (/posts/:postID)
router.get("/:postId", getPostByIdController);

export default router;
