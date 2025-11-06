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
    replise: CommentByUser[]; // (수정) replise -> replies
    repliseCount: number; // 답글 깊이는 1로 제한. 1차 답글의 개수 count
};

export interface getCommentsResultType {
    comments: CommentByUser[];
    commentCount: number; // 1차 댓글의 수
}

export type getCommentsResponseDto = CommonResponseDto<getCommentsResultType>;
