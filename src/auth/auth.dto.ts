// src/api/auth/auth.dto.ts

import { CommonResponseDto } from "../types/common.types";

// ============================
// 1. 클라이언트 <-> 우리 서버
// ============================

/**
 * @description 클라이언트 -> 서버: 카카오 로그인을 위해 인가 코드를 보낼 때 사용
 */
export interface KakaoLoginRequestDto {
    code: string;
    redirectURI: string;
}

export type User = "user" | "admin";

/**
 * @description 서버 -> 클라이언트: 로그인 성공 시 응답
 */

export interface KakaoLoginResultType {
    accessToken: string;
    // refreshToken: string; => 쿠키에 저장
    userId: number; // 우리 서비스의 고유 사용자 ID
    userRole: User;
    userNickname: string;
    userProfileImageUrl: string;
    userKakaoProfileImageUrl: string;
}

export type KakaoLoginResponseDto = CommonResponseDto<KakaoLoginResultType>;

// ✨ ===== 로그아웃 응답 DTO 추가 ===== ✨
/**
 * @description 서버 -> 클라이언트: 로그아웃 성공 시 응답
 */
export interface LogoutResultType {
    message: string;
}
export type LogoutResponseDto = CommonResponseDto<LogoutResultType>;

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

/**
 * @description 우리 서버 -> 카카오: 사용자 정보 요청의 응답 DTO
 */
export interface KakaoUserResponseDto {
    id: number; // 카카오가 발급하는 고유 사용자 ID
    connected_at: string; // ISO 8601 형식의 UTC 시간
    properties: {
        nickname: string;
        profile_image: string;
        thumbnail_image: string;
    };
    kakao_account: {
        profile_nickname_needs_agreement: false;
        profile_image_needs_agreement: false;
        profile: {
            nickname: string;
            thumbnail_image_url: string;
            profile_image_url: string;
            is_default_image: boolean;
            is_default_nickname: boolean;
        };
    };
}

export interface KakaoLogoutResponseDto {
    id: number; // 로그아웃된 사용자의 회원번호
}

export interface ReissueResultType {
    accessToken: string;
}

export type ReissueResponseDto = CommonResponseDto<ReissueResultType>;
