import { Router } from "express";
import {
  getArchiveController,
  getPostByIdController,
} from "./posts.controller";

const router = Router();

// GET /api/posts
// 모든 글 목록 (/archive 페이지)
router.get("/", getArchiveController);

// GET /api/posts/:postId
// 글 상세 (/posts/:postID)
router.get("/:postId", getPostByIdController);

export default router;
