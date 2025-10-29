import { Response } from "express";
import axios from "axios";
import * as jwt from "jsonwebtoken";
import { query } from "../db";
import {
    KakaoLoginRequestDto,
    KakaoLoginResponseDto,
    KakaoLoginResultType,
    KakaoTokenResponseDto,
    KakaoUserResponseDto,
    LogoutResponseDto,
    LogoutResultType,
    KakaoLogoutResponseDto,
    ReissueResponseDto,
    ReissueResultType,
} from "./auth.dto";

// .env 파일에서 환경 변수를 안전하게 가져옵니다.
const {
    KAKAO_REST_API_KEY,
    KAKAO_CLIENT_SECRET,
    KAKAO_REDIRECT_URI,
    JWT_SECRET,
    JWT_REFRESH_SECRET,
} = process.env;

// ============================
//  카카오 로그인 서비스
// ============================
export const kakaoLogin = async (
    body: KakaoLoginRequestDto,
    res: Response // ⭐️ Express의 Response 객체를 인자로 추가
): Promise<KakaoLoginResponseDto> => {
    if (
        !KAKAO_REST_API_KEY ||
        !KAKAO_CLIENT_SECRET ||
        !KAKAO_REDIRECT_URI ||
        !JWT_SECRET ||
        !JWT_REFRESH_SECRET
    ) {
        throw new Error("환경 변수가 제대로 설정되지 않았습니다.");
    }

    const { code } = body;

    // 1. 인가 코드로 카카오 서버에 토큰을 요청합니다.
    const tokenResponse = await axios.post<KakaoTokenResponseDto>(
        "https://kauth.kakao.com/oauth/token",
        {
            grant_type: "authorization_code",
            client_id: KAKAO_REST_API_KEY,
            redirect_uri: KAKAO_REDIRECT_URI,
            code,
            client_secret: KAKAO_CLIENT_SECRET,
        },
        {
            headers: {
                "Content-type":
                    "application/x-www-form-urlencoded;charset=utf-8",
            },
        }
    );

    const kakaoAccessToken = tokenResponse.data.access_token;

    // 2. 발급받은 액세스 토큰으로 사용자 정보를 요청합니다.
    const userResponse = await axios.get<KakaoUserResponseDto>(
        "https://kapi.kakao.com/v2/user/me",
        {
            headers: { Authorization: `Bearer ${kakaoAccessToken}` },
        }
    );

    const { id: kakaoId, properties } = userResponse.data;
    const { nickname, profile_image_url } = properties;

    // 3. DB에서 유저를 찾거나, 없으면 새로 생성합니다.
    const findUserQuery = 'SELECT * FROM "users" WHERE "kakao_id" = $1';
    const findUserResult = await query(findUserQuery, [kakaoId.toString()]);
    let user = findUserResult.rows[0];

    if (!user) {
        const insertUserQuery = `
      INSERT INTO "users" (kakao_id, nickname, profile_image_url, kakao_access_token)
      VALUES ($1, $2, $3, $4) RETURNING *
    `;
        const insertResult = await query(insertUserQuery, [
            kakaoId.toString(),
            nickname,
            profile_image_url,
            kakaoAccessToken,
        ]);
        user = insertResult.rows[0];
    } else {
        const updateUserTokenQuery =
            'UPDATE "users" SET "kakao_access_token" = $1 WHERE "id" = $2';
        await query(updateUserTokenQuery, [kakaoAccessToken, user.id]);
    }

    // 4. 우리 서비스의 JWT 토큰을 생성합니다.
    const jwtPayload = { userId: user.id };
    const accessToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "2h" });
    const refreshToken = jwt.sign(jwtPayload, JWT_REFRESH_SECRET, {
        expiresIn: "12h",
    });

    // ⭐️ 5. refreshToken을 httpOnly 쿠키에 담아 응답 헤더에 설정합니다.
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14일
    });

    // 6. 클라이언트에 전달할 최종 응답 데이터를 구성합니다.
    const result: KakaoLoginResultType = {
        accessToken,
        // refreshToken은 더 이상 본문에 포함하지 않습니다.
        userId: user.id,
        userRole: user.role,
        userNickname: user.nickname,
        userProfileImageUrl: user.profile_image_url,
    };
    const response: KakaoLoginResponseDto = {
        isSuccess: true,
        code: "AUTH_001",
        message: "카카오 로그인에 성공했습니다.",
        result,
    };

    return response;
};

// ============================
//  카카오 로그아웃 서비스
// ============================
export const kakaoLogout = async (
    userId: number, // ⭐️ 인증 미들웨어를 통해 얻은 userId를 직접 받음
    res: Response // ⭐️ 쿠키 삭제를 위해 Response 객체를 인자로 추가
): Promise<LogoutResponseDto> => {
    // 1. userId로 DB에서 유저를 찾아 저장된 '카카오 액세스 토큰'을 가져옵니다.
    const findUserQuery =
        'SELECT kakao_access_token FROM "users" WHERE id = $1';
    const userResult = await query(findUserQuery, [userId]);

    if (userResult.rows.length === 0) {
        const err = new Error("User not found.");
        (err as any).status = 404;
        throw err;
    }

    const kakaoAccessToken = userResult.rows[0].kakao_access_token;

    // 2. DB에 카카오 토큰이 있는 경우에만 카카오 로그아웃을 진행합니다.
    if (kakaoAccessToken) {
        try {
            // 2-1. 카카오 서버에 로그아웃을 요청합니다.
            await axios.post<KakaoLogoutResponseDto>(
                "https://kapi.kakao.com/v1/user/logout",
                null,
                { headers: { Authorization: `Bearer ${kakaoAccessToken}` } }
            );

            // 2-2. 성공 시, DB에 저장된 카카오 토큰을 비워줍니다.
            const clearTokenQuery =
                'UPDATE "users" SET kakao_access_token = NULL WHERE id = $1';
            await query(clearTokenQuery, [userId]);
        } catch (error) {
            // 카카오 서버와의 통신 에러가 발생해도 우리 서비스 로그아웃은 계속 진행합니다.
            console.error("🔥🔥🔥 ERROR in Kakao API logout:", error);
        }
    }

    // ⭐️ 3. 우리 서비스의 refreshToken 쿠키를 삭제합니다.
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });

    // 4. 최종 성공 응답을 구성하여 반환합니다.
    const result: LogoutResultType = {
        message: `User (ID: ${userId}) has been successfully logged out.`,
    };
    const response: LogoutResponseDto = {
        isSuccess: true,
        code: "AUTH_002",
        message: "성공적으로 로그아웃되었습니다.",
        result,
    };

    return response;
};

export const reissueToken = async (
    refreshToken: string
): Promise<ReissueResponseDto> => {
    if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
        throw new Error("환경 변수가 제대로 설정되지 않았습니다.");
    }

    try {
        // 1. refreshToken을 검증합니다.
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
            userId: number;
        };
        const { userId } = decoded;

        // 2. DB에 해당 유저가 존재하는지 확인합니다.
        const findUserQuery = 'SELECT id FROM "users" WHERE id = $1';
        const userResult = await query(findUserQuery, [userId]);

        if (userResult.rows.length === 0) {
            const err = new Error("User not found.");
            (err as any).status = 404;
            throw err;
        }

        // 3. 새로운 accessToken을 생성합니다.
        const newAccessToken = jwt.sign({ userId }, JWT_SECRET, {
            expiresIn: "2h",
        });

        // 4. 성공 응답을 구성합니다.
        const result: ReissueResultType = {
            accessToken: newAccessToken,
        };
        const response: ReissueResponseDto = {
            isSuccess: true,
            code: "AUTH_003",
            message: "Access Token이 성공적으로 재발급되었습니다.",
            result,
        };

        return response;
    } catch (error: any) {
        // refreshToken이 만료되었거나 유효하지 않은 경우
        if (
            error.name === "TokenExpiredError" ||
            error.name === "JsonWebTokenError"
        ) {
            const err = new Error(
                "유효하지 않은 Refresh Token입니다. 다시 로그인해주세요."
            );
            (err as any).status = 401; // Unauthorized
            throw err;
        }
        // 그 외의 에러
        throw error;
    }
};
