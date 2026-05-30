import { Router } from "express";
import {
    createDraftController,
    deleteDraftController,
    deletePostController,
    getArchiveController,
    getArchiveLikedByMeController,
    getDraftsController,
    getPostByIdController,
    getPostForEditController,
    postPostController,
    updateDraftController,
    updatePostController,
} from "./posts.controller";
import { attachUserMiddleware, authMiddleware } from "../auth/auth.middleware";
import { isPostOwner } from "../auth/isOwner.middleware";

const router = Router();

// GET /api/posts
// 모든 글 목록 (/archive 페이지)
router.get("/", getArchiveController);

// ⭐️ (신규) 좋아요한 글 목록
router.get(
    "/liked-by/me",
    authMiddleware, // 1. 로그인 확인
    getArchiveLikedByMeController
);

// ⭐️ (신규) 임시저장(Draft) — 모두 로그인 필요
// ❗️ 반드시 "/:postId" 라우트보다 위에 두어야 함.
//    안 그러면 GET /drafts 가 GET /:postId 에 먼저 매칭되어 parseInt("drafts")=NaN 으로 깨짐.
//    (/liked-by/me 가 위에 있는 것과 동일 패턴)
router.get("/drafts", authMiddleware, getDraftsController);
router.post("/drafts", authMiddleware, createDraftController);
router.put("/drafts/:draftId", authMiddleware, updateDraftController);
router.delete("/drafts/:draftId", authMiddleware, deleteDraftController);

// POST /api/posts
// 글 작성
router.post("/", authMiddleware, postPostController);

// GET /api/posts/:postId
// 글 상세 (/posts/:postID)
router.get("/:postId", attachUserMiddleware, getPostByIdController);

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
