// src/api/posts/posts.service.ts

import { query } from "../db";
import { GetArchiveRequestDto, GetArchiveResultType } from "./posts.dto";

//기본값 12
const POSTS_PER_PAGE = 12;

export const getArchive = async (
  queryParams: GetArchiveRequestDto
): Promise<GetArchiveResultType> => {
  try {
    const { page, category, search } = queryParams;
    const limit = queryParams.limit || POSTS_PER_PAGE;
    const offset = (page - 1) * limit;

    const filterConditions: string[] = [];
    const filterParams: (string | number)[] = [];

    if (category) {
      filterConditions.push(`c.name = $${filterParams.length + 1}`);
      filterParams.push(category);
    }

    if (search) {
      const searchTerm = `%${search}%`;
      filterConditions.push(`p.title ILIKE $${filterParams.length + 1}`);
      filterParams.push(searchTerm);
    }

    const whereClause =
      filterConditions.length > 0
        ? `WHERE ${filterConditions.join(" AND ")}`
        : "";

    const joinClause = category
      ? "JOIN categories c ON p.category_id = c.id"
      : "";
    const countQueryStr = `SELECT COUNT(*) FROM posts p ${joinClause} ${whereClause}`;

    console.log("[DEBUG] Executing Count Query:", countQueryStr, filterParams);
    const countResult = await query(countQueryStr, filterParams);

    const totalPostCount =
      countResult.rows.length > 0 ? parseInt(countResult.rows[0].count, 10) : 0;
    const totalPage = Math.ceil(totalPostCount / limit);

    if (page > totalPage && totalPostCount > 0) {
      return {
        posts: [],
        pagination: {
          totalPostCount,
          totalPage,
          currentPage: page,
          isFirstPage: false,
          isLastPage: true,
        },
      };
    }

    const postsQueryStr = `
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
      ${whereClause}
      ORDER BY p.created_at DESC 
      LIMIT $${filterParams.length + 1} 
      OFFSET $${filterParams.length + 2}
    `;

    const postsParams = [...filterParams, limit, offset];

    console.log("[DEBUG] Executing Posts Query:", postsQueryStr, postsParams);
    const postsResult = await query(postsQueryStr, postsParams);

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
