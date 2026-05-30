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
// Posts Liked By Me (GET /posts/liked-by/me)
// =============================================

export interface GetArchiveLikedByMeRequestDto {
    page: number;
    limit: number;
    userId: number; // ⭐️ 필수
    category?: string; // ⭐️ 선택
    search?: string; // ⭐️ 선택
}
export interface GetArchiveLikedByMeResultType {
    posts: ArchiveItem[];
    pagination: {
        totalPostCount: number;
        totalPage: number;
        currentPage: number;
        isFirstPage: boolean;
        isLastPage: boolean;
    };
}
export type GetArchiveLikedByMeResponseDto =
    CommonResponseDto<GetArchiveLikedByMeResultType>;

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

// =============================================
// Draft (임시저장)
//   GET    /api/posts/drafts        → DraftDetail[]
//   POST   /api/posts/drafts        → { id, updatedAt }
//   PUT    /api/posts/drafts/:id    → { updatedAt }
//   DELETE /api/posts/drafts/:id    → 성공 여부
// =============================================

// 임시글 저장 요청 본문(작성 도중이라 미완성 가능). categoryId는 null 허용.
export interface DraftPayload {
    title: string;
    content: string; // 본문 HTML
    categoryId: number | null;
    summary: string;
    thumbnailUrl: string;
    tags: string[];
}

// 임시글 1건(목록/선택 시). 본문 포함.
export interface DraftDetail extends DraftPayload {
    id: number;
    updatedAt: string; // 'YYYY-MM-DD HH24:MI:SS'
}

export type GetDraftsResultType = DraftDetail[];
export type GetDraftsResponseDto = CommonResponseDto<GetDraftsResultType>;

export interface CreateDraftResultType {
    id: number;
    updatedAt: string;
}
export type CreateDraftResponseDto = CommonResponseDto<CreateDraftResultType>;

export interface UpdateDraftResultType {
    updatedAt: string;
}
export type UpdateDraftResponseDto = CommonResponseDto<UpdateDraftResultType>;

export interface GetPostForEditRequestDto {
    postId: number;
}

export interface GetPostForEditResultType {
    title: string;
    content: string; // ❗️ 저장된 HTML 원본 (BlockNote 직렬화 결과)
    summary: string | null;
    thumbnailUrl: string | null;
    categoryId: number | null;
    tags: string[]; // ❗️ Tag 이름을 string 배열로
}
export type GetPostForEditResponseDto =
    CommonResponseDto<GetPostForEditResultType>;
