import { CommonResponseDto } from "../types/common.types";

// 서비스 레이어로 전달될 데이터 타입
export interface ToggleLikeServiceDto {
    postId: number;
    userId: number;
}

// 클라이언트에 응답할 결과 데이터 타입
export interface ToggleLikeResultType {
    postId: number;
    liked: boolean;
    newLikesCount: number;
}

export type ToggleLikeResponseDto = CommonResponseDto<ToggleLikeResultType>;
