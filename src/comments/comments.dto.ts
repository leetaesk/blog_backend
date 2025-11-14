import { Author } from "../posts/posts.dto";
import { CommonResponseDto } from "../types/common.types";

export interface getCommentsRequestDto {
    postId: number;
}

// 백엔드 내 사용 dto
export interface GetCommentsServiceDto {
    postId: number;
    userId?: number;
}

export interface Comment {
    id: number;
    content: string;
    userId: number;
    createdAt: string;
    updatedAt: string;
    likesCount: number;
    author: Author;
}

export type CommentByUser = Comment & {
    isOwner: boolean;
    isLiked: boolean;
    replies: CommentByUser[]; // (수정) replise -> replies
    repliesCount: number; // 답글 깊이는 1로 제한. 1차 답글의 개수 count
};

export interface getCommentsResultType {
    comments: CommentByUser[];
    commentCount: number; // 1차 댓글의 수
}

export type getCommentsResponseDto = CommonResponseDto<getCommentsResultType>;

export interface createCommentRequestDto {
    postId: number;
    content: string;
    parentCommentId?: number;
}
/*
 * createComment 서비스 레이어로 전달되는 DTO
 */
export interface CreateCommentServiceDto {
    postId: number;
    content: string;
    userId: number; // 인증 미들웨어에서 추가
    parentCommentId: number | null; // 컨트롤러에서 undefined -> null 처리
}

export interface createCommentResultType {
    id: number;
    content: string;
    userId: number;
    createdAt: string;
    parentCommentId: number | null;
}

export type createCommentResponseDto =
    CommonResponseDto<createCommentResultType>;

// --- ⬇️ Update / Delete DTOs ⬇️ ---

// req.params 타입 정의
export interface CommentParamsDto {
    commentId: number;
}

// (수정) req.body 타입 정의
export interface UpdateCommentBodyDto {
    content: string;
}

// (추가) Update 서비스 레이어로 전달되는 DTO
export interface UpdateCommentServiceDto {
    commentId: number;
    userId: number;
    content: string;
}

export interface updateCommentResultType {
    id: number;
    content: string;
    userId: number;
    createdAt: string;
    updatedAt: string;
    parentCommentId: number | null;
}

export type updateCommentResponseDto =
    CommonResponseDto<updateCommentResultType>;

// Delete는 req.body가 필요 없음.

// (추가) Delete 서비스 레이어로 전달되는 DTO
export interface DeleteCommentServiceDto {
    commentId: number;
    userId: number;
}

export interface deleteCommentResultType {
    id: number;
}

export type deleteCommentResponseDto =
    CommonResponseDto<deleteCommentResultType>;
