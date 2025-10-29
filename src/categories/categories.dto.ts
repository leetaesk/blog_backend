// src/categories/categories.dto.ts

import { CommonResponseDto } from "../types/common.types";

// 단일 카테고리의 타입 (게시글 수 포함)
export interface CategoryWithPostCount {
    id: number;
    name: string;
    postCount: number;
}

export interface createCategoryRequestDto {
    category: string;
}

export type createCategoryResponseDto = CommonResponseDto<boolean>;
