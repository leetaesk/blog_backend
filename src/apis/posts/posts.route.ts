// src/api/posts/posts.route.ts

import { Router } from "express";
import { getArchiveController } from "./posts.controller";

const router = Router();

// GET /api/posts
router.get("/", getArchiveController);

export default router;
