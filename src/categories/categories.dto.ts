// src/categories/categories.dto.ts

// 단일 카테고리의 타입 (게시글 수 포함)
export interface CategoryWithPostCount {
  id: number;
  name: string;
  postCount: number;
}
