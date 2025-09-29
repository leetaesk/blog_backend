// src/api/auth/auth.route.ts

import { Router } from "express";
import * as authController from "./auth.controller";

const router = Router();

// 'POST /api/auth/kakao/login' 경로로 오는 요청을
// authController.handleKakaoLogin 함수가 처리하도록 연결합니다.
router.post("/kakao/login", authController.handleKakaoLogin);

export default router;
