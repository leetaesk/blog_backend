// src/api/posts/posts.dto.ts

import { CommonResponseDto } from "../types/common.types";

// 나중에 별도 파일로 분리될 수 있는 공통 타입
export interface Category {
    id: number;
    name: string;
}

export interface GetArchiveRequestDto {
    page: number;
    limit: number; // 한 페이지에 보여줄 게시글 수
    category?: string; // 카테고리 이름
    search?: string; //검색어
}

interface ArchiveItem {
    id: number;
    title: string;
    summary: string;
    createdAt: string;
    category: Category;
    thumbnailUrl: string | null; // DB에 NULL이 있을 수 있으므로 null 타입 추가
    commentCount: number;
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

interface Author {
    id: number;
    nickname: string;
    profileImageUrl: string;
}

interface Tag {
    id: number;
    name: string;
}

export interface GetPostByIdRequestDto {
    postId: number;
}
export interface GetPostByIdResultType {
    id: number;
    title: string;
    content: string;
    thumbnailUrl: string | null;
    views: number;
    createdAt: string; // 'YYYY-MM-DD HH:MI:SS' 형식
    updatedAt: string; // 'YYYY-MM-DD HH:MI:SS' 형식
    author: Author;
    category: Category | null; // 카테고리가 없을 수 있음
    tags: Tag[]; // 태그는 여러 개일 수 있고, 없을 수도 있음
    commentCount: number;
}

export type GetPostByIdResponseDto = CommonResponseDto<GetPostByIdResultType>;

export interface PostPostRequestDto {
    title: string;
    content: string;
    categoryId?: number;
    summary?: string;
    thumbnailUrl?: string;
    tags?: string[];
}

export interface PostPostResultType {
    postId: number;
}

export type PostPostResponseDto = CommonResponseDto<PostPostResultType>;
