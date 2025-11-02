// src/api/posts/posts.dto.ts

import { CommonResponseDto } from "../types/common.types";

// 공통 타입
export interface Category {
    id: number;
    name: string;
}

export interface Tag {
    id: number;
    name: string;
}

export interface Author {
    id: number;
    nickname: string;
    profileImageUrl: string;
}

// =============================================
// 핵심 데이터 타입 (재사용을 위해 분리)
// =============================================
interface PostData {
    title: string;
    content: string;
    categoryId: number;
    summary: string;
    thumbnailUrl: string;
    tags?: string[];
}

// =============================================
// Archive (GET /posts)
// =============================================
export interface GetArchiveRequestDto {
    page: number;
    limit: number;
    category?: string;
    search?: string;
}

interface ArchiveItem {
    id: number;
    title: string;
    summary: string;
    createdAt: string;
    category: Category;
    thumbnailUrl: string | null;
    commentCount: number;
    likesCount: number; // ✨ (수정) 이 줄을 추가합니다.
}
export interface GetArchiveResultType {
    posts: ArchiveItem[];
    pagination: {
        totalPostCount: number;
        totalPage: number;
        currentPage: number;
        isFirstPage: boolean;
        isLastPage: boolean;
    };
}
export type GetArchiveResponseDto = CommonResponseDto<GetArchiveResultType>;

// =============================================
// Post Detail (GET /posts/:postId)
// =============================================
export interface GetPostByIdRequestDto {
    postId: number;
    currentUserId: number | undefined;
}

export interface GetPostByIdResultType {
    id: number;
    title: string;
    content: string;
    thumbnailUrl: string | null;
    views: number;
    createdAt: string;
    updatedAt: string;
    author: Author;
    category: Category | null;
    tags: Tag[];
    commentCount: number;
    likesCount: number; // ✨ (신규) likesCount 추가
    isLikedByUser: boolean; // ✨ (신규) isLikedByUser 추가
}
export type GetPostByIdResponseDto = CommonResponseDto<GetPostByIdResultType>;

// =============================================
// Create Post (POST /posts)
// =============================================
export type PostPostRequestDto = PostData;

export interface PostPostResultType {
    postId: number;
}
export type PostPostResponseDto = CommonResponseDto<PostPostResultType>;

// =============================================
// Update Post (PATCH /posts/:postId)
// =============================================
export type UpdatePostRequestDto = Partial<PostData> & {
    postId: number;
};

export interface UpdatePostResultType {
    postId: number;
}
export type UpdatePostResponseDto = CommonResponseDto<UpdatePostResultType>;

// =============================================
// Delete Post (DELETE /posts/:postId)
// =============================================
export interface DeletePostRequestDto {
    postId: number;
}

export interface DeletePostResultType {
    postId: number;
}
export type DeletePostResponseDto = CommonResponseDto<DeletePostResultType>;

export interface GetPostForEditRequestDto {
    postId: number;
}

export interface GetPostForEditResultType {
    title: string;
    content: string; // ❗️ 원본 Markdown
    summary: string | null;
    thumbnailUrl: string | null;
    categoryId: number | null;
    tags: string[]; // ❗️ Tag 이름을 string 배열로
}
export type GetPostForEditResponseDto =
    CommonResponseDto<GetPostForEditResultType>;
