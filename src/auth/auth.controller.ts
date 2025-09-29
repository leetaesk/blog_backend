// src/api/auth/auth.controller.ts

import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import { KakaoLoginRequestDto } from "./auth.dto";

export const handleKakaoLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. 클라이언트 요청의 body에서 인가 코드를 가져옵니다.
    const body: KakaoLoginRequestDto = req.body;

    // 2. Service 로직을 호출하여 로그인/회원가입을 처리합니다.
    const responseDto = await authService.kakaoLogin(body);

    // 3. 처리 결과를 클라이언트에 JSON 형태로 응답합니다.
    res.status(200).json(responseDto);
  } catch (error) {
    console.error("🔥🔥🔥 ERROR in handleKakaoLogin controller:", error);
    next(error); // 중앙 에러 핸들링 미들웨어로 에러를 전달합니다.
  }
};
