// src/categories/categories.service.ts

import { query } from "../db";
import {
    CategoryWithPostCount,
    createCategoryResponseDto,
} from "./categories.dto";

/**
 * 모든 카테고리와 각 카테고리에 속한 게시글 수를 조회합니다.
 */
export const getCategories = async (): Promise<CategoryWithPostCount[]> => {
    try {
        const queryString = `
      SELECT 
        c.id, 
        c.name, 
        COUNT(p.id) AS "postCount"
      FROM 
        categories c
      LEFT JOIN 
        posts p ON c.id = p.category_id
      GROUP BY 
        c.id, c.name
      ORDER BY 
        c.name ASC
    `;

        const result = await query(queryString);

        // DB에서 COUNT 결과는 문자열일 수 있으므로 숫자로 변환합니다.
        const categories = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            postCount: parseInt(row.postCount, 10),
        }));

        return categories;
    } catch (error) {
        console.error("🔥🔥🔥 ERROR in getCategories service:", error);
        throw error; // 에러를 컨트롤러로 전달
    }
};

// export const createCategory = async() : Promise<createCategoryResponseDto> => {
//   try{

//   }catch{}
// }
