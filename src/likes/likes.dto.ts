import { CommonResponseDto } from "../types/common.types";

// 서비스 레이어로 전달될 데이터 타입
export interface TogglePostLikeServiceDto {
    postId: number;
    userId: number;
}

// 클라이언트에 응답할 결과 데이터 타입
export interface TogglePostLikeResultType {
    postId: number;
    liked: boolean;
    newLikesCount: number;
}

export type TogglePostLikeResponseDto =
    CommonResponseDto<TogglePostLikeResultType>;

// 서비스 레이어로 전달될 데이터 타입
export interface ToggleCommentLikeServiceDto {
    commentId: number;
    userId: number;
}

// 클라이언트에 응답할 결과 데이터 타입
export interface ToggleCommentLikeResultType {
    commentId: number;
    liked: boolean;
    newLikesCount: number;
}

export type ToggleCommentLikeResponseDto =
    CommonResponseDto<ToggleCommentLikeResultType>;
