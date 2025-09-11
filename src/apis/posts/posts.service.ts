import { query } from "../../db";
import { GetArchiveRequestDto, GetArchiveResultType } from "./posts.dto";

const POSTS_PER_PAGE = 10;

export const getArchive = async (
  queryParams: GetArchiveRequestDto
): Promise<GetArchiveResultType> => {
  try {
    const { page, category } = queryParams;
    const limit = queryParams.limit || POSTS_PER_PAGE;
    const offset = (page - 1) * limit;

    // --- 1. 전체 게시글 수 조회 쿼리 ---
    let countQueryStr = "SELECT COUNT(*) FROM posts";
    const countParams: (string | number)[] = [];
    if (category) {
      countQueryStr +=
        " JOIN categories ON posts.category_id = categories.id WHERE categories.name = $1";
      countParams.push(category);
    }

    console.log("[DEBUG] Executing Count Query:", countQueryStr, countParams);
    const countResult = await query(countQueryStr, countParams);

    const totalPostCount =
      countResult.rows.length > 0 ? parseInt(countResult.rows[0].count, 10) : 0;
    const totalPage = Math.ceil(totalPostCount / limit);

    // --- ✨ 페이지 유효성 검사 로직 추가 ---
    // 요청된 페이지가 전체 페이지 수를 초과하고, 게시글이 하나 이상 존재하는 경우
    if (page > totalPage && totalPostCount > 0) {
      return {
        posts: [], // 빈 게시글 배열을 반환
        pagination: {
          totalPostCount,
          totalPage,
          currentPage: page,
          isFirstPage: false,
          isLastPage: true,
        },
      };
    }

    // --- 2. 게시글 목록 조회 쿼리 ---
    let postsQueryStr = `
      SELECT 
          p.id, 
          p.title, 
          p.summary, 
          to_char(p.created_at, 'YYYY-MM-DD') AS "createdAt",
          p.thumbnail_url AS "thumbnailUrl",
          c.id AS "categoryId",
          c.name AS "categoryName",
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS "commentCount"
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    const postsParams: (string | number)[] = [];
    let paramIndex = 1;

    if (category) {
      postsQueryStr += ` WHERE c.name = $${paramIndex++}`;
      postsParams.push(category);
    }

    postsQueryStr += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    postsParams.push(limit, offset);

    console.log("[DEBUG] Executing Posts Query:", postsQueryStr, postsParams);
    const postsResult = await query(postsQueryStr, postsParams);

    // --- 3. 결과 데이터 가공 ---
    const posts = postsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      createdAt: row.createdAt,
      thumbnailUrl: row.thumbnailUrl,
      commentCount: parseInt(row.commentCount, 10),
      category: {
        id: row.categoryId,
        name: row.categoryName,
      },
    }));

    return {
      posts,
      pagination: {
        totalPostCount,
        totalPage,
        currentPage: page,
        isFirstPage: page === 1,
        isLastPage: page === totalPage || totalPage === 0,
      },
    };
  } catch (error) {
    console.error("🔥🔥🔥 ERROR in getArchive service:", error);
    throw error;
  }
};
