import pool, { query } from "../db";
import {
    CategoryWithPostCount,
    // createCategoryResponseDto, // DTO 대신 서비스 결과 타입을 가져옵니다.
    CreateCategoryServiceResult, // DTO 파일에 정의된 서비스 반환 타입을 가져옵니다.
} from "./categories.dto";

/**
 * 모든 카테고리와 각 카테고리에 속한 게시글 수를 조회합니다.
 * (성공: CategoryWithPostCount[] 반환 / 실패: throw error)
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

        return categories; // 순수 데이터 반환
    } catch (error) {
        console.error("🔥🔥🔥 ERROR in getCategories service:", error);
        throw error; // 에러를 컨트롤러로 전달
    }
};

/**
 * 카테고리를 생성하거나, 이미 존재하면 기존 카테고리 ID를 반환합니다.
 * (성공: CreateCategoryServiceResult 반환 / 실패: throw error)
 *
 * @param category - 생성할 카테고리 이름
 * @returns {Promise<CreateCategoryServiceResult>} 생성/조회된 ID와 신규 생성 여부
 */
export const createCategory = async (
    category: string
): Promise<CreateCategoryServiceResult> => {
    // ✨ 반환 타입을 DTO에 정의된 'CreateCategoryServiceResult'로 수정
    let client;
    try {
        client = await pool.connect();

        // 1. 동일한 이름의 카테고리가 이미 존재하는지 확인
        const checkQuery = "SELECT id FROM categories WHERE name = $1";
        const existingCategory = await client.query(checkQuery, [category]);

        // 2. 카테고리가 이미 존재할 경우, 해당 ID와 isNew: false 반환
        if (existingCategory.rows.length > 0) {
            return {
                categoryId: existingCategory.rows[0].id,
                isNew: false, // 새로 생성되지 않음
            };
        }

        // 3. 존재하지 않으면 새로운 카테고리 추가하고, 생성된 ID와 isNew: true 반환
        const insertQuery = `
          INSERT INTO categories (name)
          VALUES ($1)
          RETURNING id;
        `;
        const newCategory = await client.query(insertQuery, [category]);
        const newCategoryId = newCategory.rows[0].id;

        return {
            categoryId: newCategoryId,
            isNew: true, // 새로 생성됨
        };
    } catch (error) {
        console.error("🔥🔥🔥 ERROR in createCategory service:", error);
        // 4. 에러 발생 시 컨트롤러로 throw
        throw error;
    } finally {
        // 5. DB 커넥션 반환
        client?.release();
    }
};
