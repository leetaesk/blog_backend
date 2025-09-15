// src/api/posts/posts.dto.ts

import { CommonResponseDto } from "../types/common.types";

// 나중에 별도 파일로 분리될 수 있는 공통 타입
export interface Category {
  id: number;
  name: string;
}

/**
 * GET /api/posts - 요청 DTO (Query Parameters)
 * @description /archive 페이지 게시글 목록 조회 API의 요청 쿼리를 정의합니다.
 */
export interface GetArchiveRequestDto {
  page: number;
  limit: number; // 한 페이지에 보여줄 게시글 수
  category?: string; // 카테고리 이름
}

interface ArchiveItem {
  id: number; // 프론트엔드에서 string으로 받았지만, DB에서는 number입니다.
  title: string;
  summary: string;
  createdAt: string;
  category: Category;
  thumbnailUrl: string | null; // DB에 NULL이 있을 수 있으므로 null 타입 추가
  commentCount: number;
}

/**
 * GET /api/posts - 응답의 `result` 필드 DTO
 * @description /archive 페이지 게시글 목록 조회 API 응답의 실제 데이터 부분을 정의합니다.
 */
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

/**
 * GET /api/posts - 최종 응답 DTO
 * @description /archive 페이지 게시글 목록 조회 API의 최종 응답 형태를 정의합니다.
 */
export type GetArchiveResponseDto = CommonResponseDto<GetArchiveResultType>;
