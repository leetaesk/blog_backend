import { CommonResponseDto } from "../types/common.types";

// 반환타입
export interface CategoryWithPostCount {
    id: number;
    name: string;
    postCount: number;
}

export interface CreateCategoryServiceResult {
    categoryId: number;
    isNew: boolean; // 새로 생성되었는지, 아니면 기존 것을 반환했는지 여부
}

export type GetCategoriesResponseDto = CommonResponseDto<{
    categories: CategoryWithPostCount[];
}>;

export interface createCategoryRequestDto {
    category: string;
}

export type createCategoryResponseDto = CommonResponseDto<{
    categoryId: number;
}>;
