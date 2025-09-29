import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import { KakaoLoginRequestDto } from "./auth.dto";

// ============================
//  카카오 로그인 컨트롤러
// ============================
export const handleKakaoLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body: KakaoLoginRequestDto = req.body;
    const responseDto = await authService.kakaoLogin(body);
    res.status(200).json(responseDto);
  } catch (error) {
    console.error("🔥🔥🔥 ERROR in handleKakaoLogin controller:", error);
    next(error);
  }
};

// ============================
//  카카오 로그아웃 컨트롤러
// ============================
export const handleKakaoLogout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. 클라이언트 요청 헤더에서 'Authorization' 값을 추출합니다.
    const authHeader = req.headers["authorization"];

    // 2. 헤더가 없거나 'Bearer '로 시작하지 않으면 에러를 발생시킵니다.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const err = new Error(
        "Authorization header with Bearer token is required."
      );
      (err as any).status = 401; // 401 Unauthorized
      throw err;
    }

    // 3. 'Bearer ' 부분을 제외한 실제 토큰 값만 추출합니다.
    const accessToken = authHeader.split(" ")[1];

    // 4. Service 로직을 호출하여 로그아웃을 처리합니다.
    const responseDto = await authService.kakaoLogout(accessToken);

    // 5. 처리 결과를 클라이언트에 JSON 형태로 응답합니다.
    res.status(200).json(responseDto);
  } catch (error) {
    console.error("🔥🔥🔥 ERROR in handleKakaoLogout controller:", error);
    next(error); // 중앙 에러 핸들링 미들웨어로 에러를 전달합니다.
  }
};
