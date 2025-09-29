// src/api/auth/auth.dto.ts

// ============================
// 1. 클라이언트 <-> 우리 서버
// ============================

/**
 * @description 클라이언트 -> 서버: 카카오 로그인을 위해 인가 코드를 보낼 때 사용
 */
export interface KakaoLoginRequestDto {
  code: string;
}

export type User = "user" | "admin";

/**
 * @description 서버 -> 클라이언트: 로그인 성공 시 응답
 */
export interface KakaoLoginResponseDto {
  accessToken: string;
  refreshToken: string;
  userId: number; // 우리 서비스의 고유 사용자 ID
  userRole: User;
}

// ============================
// 2. 우리 서버 <-> 카카오 서버 (내부용)
// ============================

/**
 * @description 우리 서버 -> 카카오: 토큰 요청의 응답 DTO
 * @note 카카오 API는 snake_case를 사용하므로 그대로 따릅니다.
 */

export interface KakaoTokenRequestDto {
  grant_type: "authorization_code";
  client_id: string;
  redirect_uri: string;
  code: string;
  client_secret: string;
}

export interface KakaoTokenResponseDto {
  token_type: "bearer";
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  id_token?: string; // OpenID Connect 활성화 시 포함될 수 있음 => 지금은 안 쓰고 리팩 시 사용할 수도 있음
  scope: string;
}

/**
 * @description 카카오 사용자 정보 객체 중 'properties' 필드
 */

interface KakaoProfile {
  nickname: string;
  profile_image_url: string;
  thumbnail_image_url: string;
}

/**
 * @description 우리 서버 -> 카카오: 사용자 정보 요청의 응답 DTO
 */
export interface KakaoUserResponseDto {
  id: number; // 카카오가 발급하는 고유 사용자 ID
  connected_at: string; // ISO 8601 형식의 UTC 시간
  properties: KakaoProfile;
}
