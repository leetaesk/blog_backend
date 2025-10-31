import { Router } from "express";
import {
    deletePostController,
    getArchiveController,
    getPostByIdController,
    getPostForEditController,
    postPostController,
    updatePostController,
} from "./posts.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { isPostOwner } from "../auth/isOwner.middleware";

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

// 게시글 수정
router.patch(
    "/:postId",
    authMiddleware, // 1. 로그인 여부 확인
    isPostOwner, // 2. 게시글 소유자 또는 관리자인지 확인
    updatePostController
);

// 게시글 삭제
router.delete(
    "/:postId",
    authMiddleware, // 1. 로그인 여부 확인
    isPostOwner, // 2. 게시글 소유자 또는 관리자인지 확인
    deletePostController
);

// ⭐️ (신규) 게시글 수정을 위한 원본 데이터 조회 (보안 적용)
router.get(
    "/edit-data/:postId",
    authMiddleware, // 1. 로그인 확인
    isPostOwner, // 2. 소유자/관리자 확인
    getPostForEditController
);

export default router;
