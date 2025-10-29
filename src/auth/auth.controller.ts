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
        // ⭐️ 변경점: 서비스 함수에 res 객체를 함께 전달합니다.
        const responseDto = await authService.kakaoLogin(body, res);
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
        // ⭐️ 변경점: 인증 미들웨어가 검증 후 req.user에 넣어준 userId를 사용합니다.
        // 더 이상 컨트롤러에서 토큰을 직접 파싱하고 검증할 필요가 없습니다.
        const userId = req.user?.userId;

        if (!userId) {
            // 미들웨어를 통과했다면 이럴 일은 없지만, 안전을 위한 타입 가드
            const err = new Error("인증 정보가 없습니다.");
            (err as any).status = 401;
            throw err;
        }

        // ⭐️ 변경점: 서비스 함수에 userId와 res 객체를 전달합니다.
        const responseDto = await authService.kakaoLogout(userId, res);

        res.status(200).json(responseDto);
    } catch (error) {
        console.error("🔥🔥🔥 ERROR in handleKakaoLogout controller:", error);
        next(error);
    }
};

// ============================
//  리이슈 컨트롤러
// ============================
export const handleReissueToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // httpOnly 쿠키에 담겨온 refreshToken을 가져옵니다.
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            const err = new Error(
                `Refresh Token이 없습니다. 가져온 리프레시토큰 : ${refreshToken}`
            );
            (err as any).status = 401; // Unauthorized
            throw err;
        }

        const responseDto = await authService.reissueToken(refreshToken);

        res.status(200).json(responseDto);
    } catch (error) {
        console.error("🔥🔥🔥 ERROR in handleReissueToken controller:", error);
        next(error);
    }
};
