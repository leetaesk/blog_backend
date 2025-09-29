// src/api/auth/auth.service.ts

import axios from "axios";
import jwt from "jsonwebtoken";
// import { query } from "../../db"; // DB 헬퍼 경로는 실제 프로젝트 구조에 맞게 수정해주세요.
import {
  KakaoLoginRequestDto,
  KakaoLoginResponseDto,
  KakaoTokenResponseDto,
  KakaoUserResponseDto,
} from "./auth.dto";
import { query } from "../db";

// .env 파일에서 환경 변수를 안전하게 가져옵니다.
const {
  KAKAO_REST_API_KEY,
  KAKAO_CLIENT_SECRET,
  KAKAO_REDIRECT_URI,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
} = process.env;

/**
 * @description 카카오 로그인 전체 비즈니스 로직을 처리합니다.
 * @param {KakaoLoginRequestDto} body - 클라이언트로부터 받은 인가 코드
 * @returns {Promise<KakaoLoginResponseDto>} - accessToken, refreshToken 및 사용자 정보
 */
export const kakaoLogin = async (
  body: KakaoLoginRequestDto
): Promise<KakaoLoginResponseDto> => {
  // 0. 필요한 환경변수가 모두 있는지 확인합니다.
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
    null,
    {
      params: {
        grant_type: "authorization_code",
        client_id: KAKAO_REST_API_KEY,
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
        client_secret: KAKAO_CLIENT_SECRET,
      },
    }
  );
  const { access_token } = tokenResponse.data;

  // 2. 발급받은 액세스 토큰으로 사용자 정보를 요청합니다.
  const userResponse = await axios.get<KakaoUserResponseDto>(
    "https://kapi.kakao.com/v2/user/me",
    {
      headers: { Authorization: `Bearer ${access_token}` },
    }
  );

  const { id: kakaoId, properties } = userResponse.data;
  const { nickname, profile_image_url } = properties;

  // 3. DB에서 유저를 찾거나, 없으면 새로 생성합니다 (Find or Create).
  const findUserQuery = 'SELECT * FROM "users" WHERE "kakao_id" = $1';
  const findUserResult = await query(findUserQuery, [kakaoId.toString()]);
  let user = findUserResult.rows[0];

  if (!user) {
    // 유저가 없으면 새로 생성
    const insertUserQuery = `
      INSERT INTO "users" (kakao_id, nickname, profile_image_url)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const insertResult = await query(insertUserQuery, [
      kakaoId.toString(),
      nickname,
      profile_image_url,
    ]);
    user = insertResult.rows[0];
  }

  // 4. 우리 서비스의 JWT (Access & Refresh) 토큰을 생성합니다.
  const jwtPayload = { userId: user.id };
  const accessToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "2h" });
  const refreshToken = jwt.sign(jwtPayload, JWT_REFRESH_SECRET, {
    expiresIn: "14d",
  });

  // 5. 클라이언트에 전달할 최종 응답 데이터를 구성합니다.
  const response: KakaoLoginResponseDto = {
    accessToken,
    refreshToken,
    userId: user.id,
    userRole: user.role, // DB에서 조회한 사용자 role
  };

  return response;
};
