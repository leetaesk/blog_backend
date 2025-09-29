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
  body: KakaoLoginRequestDto
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
        "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    }
  );

  // ✨ 1-1. 발급받은 카카오 액세스 토큰을 변수에 저장합니다.
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
    // ✨ 3-1. 신규 유저 생성 시, 카카오 액세스 토큰도 함께 저장합니다.
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
    // ✨ 3-2. 기존 유저라면, 새로 발급받은 카카오 액세스 토큰으로 DB를 업데이트합니다.
    const updateUserTokenQuery =
      'UPDATE "users" SET "kakao_access_token" = $1 WHERE "id" = $2';
    await query(updateUserTokenQuery, [kakaoAccessToken, user.id]);
  }

  // 4. 우리 서비스의 JWT 토큰을 생성합니다.
  const jwtPayload = { userId: user.id };
  const accessToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "2h" });
  const refreshToken = jwt.sign(jwtPayload, JWT_REFRESH_SECRET, {
    expiresIn: "14d",
  });

  // 5. 클라이언트에 전달할 최종 응답 데이터를 구성합니다.
  const result: KakaoLoginResultType = {
    accessToken,
    refreshToken,
    userId: user.id,
    userRole: user.role,
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
  ourAccessToken: string // ✨ 이제 이 토큰은 '우리 서비스의 JWT'입니다.
): Promise<LogoutResponseDto> => {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined.");

  // ✨ 1. 우리 서비스의 JWT를 해독하여 어떤 유저인지 확인합니다 (userId).
  const decoded = jwt.verify(ourAccessToken, JWT_SECRET) as { userId: number };
  const { userId } = decoded;

  // ✨ 2. userId로 DB에서 유저를 찾아 저장된 '카카오 액세스 토큰'을 가져옵니다.
  const findUserQuery = 'SELECT kakao_access_token FROM "users" WHERE id = $1';
  const userResult = await query(findUserQuery, [userId]);

  if (userResult.rows.length === 0) {
    const err = new Error("User not found.");
    (err as any).status = 404;
    throw err;
  }

  const kakaoAccessToken = userResult.rows[0].kakao_access_token;

  // 만약 토큰이 없다면 이미 로그아웃 처리된 것으로 간주하고 성공 응답을 보냅니다.
  if (!kakaoAccessToken) {
    return {
      isSuccess: true,
      code: "AUTH_003",
      message: "이미 로그아웃 처리된 사용자입니다.",
      result: { message: "Already logged out or no token found." },
    };
  }

  // ✨ 3. DB에서 가져온 '카카오 액세스 토큰'으로 카카오에 로그아웃을 요청합니다.
  await axios.post<KakaoLogoutResponseDto>(
    "https://kapi.kakao.com/v1/user/logout",
    null,
    {
      headers: {
        Authorization: `Bearer ${kakaoAccessToken}`,
      },
    }
  );

  // ✨ 4. 로그아웃 성공 시, DB에 저장된 카카오 토큰을 비워줍니다 (재사용 방지).
  const clearTokenQuery =
    'UPDATE "users" SET kakao_access_token = NULL WHERE id = $1';
  await query(clearTokenQuery, [userId]);

  // 5. 최종 성공 응답을 구성하여 반환합니다.
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
