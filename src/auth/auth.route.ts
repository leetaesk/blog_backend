// src/api/auth/auth.route.ts

import { Router } from "express";
import * as authController from "./auth.controller";
import { authMiddleware } from "./auth.middleware";

const router = Router();

// 'POST /api/auth/kakao/login' 경로로 오는 요청을
// authController.handleKakaoLogin 함수가 처리하도록 연결합니다.
router.post("/kakao/login", authController.handleKakaoLogin);
router.post("/kakao/logout", authMiddleware, authController.handleKakaoLogout);
router.post("/reissue", authController.handleReissueToken);

export default router;
