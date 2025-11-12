import { CommonResponseDto } from "../types/common.types";

/**
 * ⭐️ (변경)
 * 컨트롤러가 서비스 레이어로 전달할 때 사용하는 내부 DTO입니다.
 * 클라이언트 요청(multipart)을 컨트롤러가 파싱하여 이 객체를 만듭니다.
 */
export interface UpdateProfileServiceDto {
    nickname?: string;
    profileImageUrl?: string | null; // S3 URL 또는 null
    useKakaoProfile?: boolean; // 카카오 프로필 사용 여부
}

// ----------------------------------------------------
// (기존) UpdateProfileRequestDto는 이제 사용되지 않거나
// 컨트롤러에서 req.body의 타입을 지정하는 용도로만 사용됩니다.
// ----------------------------------------------------
export interface UpdateProfileRequestDto {
    nickname?: string;
    profileAction?: "delete" | "use_kakao"; // ⭐️ 클라이언트가 보낼 텍스트 필드
}

// ----------------------------------------------------
// (기존과 동일) 서비스 응답 타입
// ----------------------------------------------------
export interface UpdateProfileResulType {
    id: number;
    nickname: string;
    profileImageUrl: string | null;
    role: string;
}

export type UpdateProfileResponseDto =
    CommonResponseDto<UpdateProfileResulType>;
