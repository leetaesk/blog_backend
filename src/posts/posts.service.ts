// src/api/posts/posts.service.ts

import { marked } from "marked";
import { query } from "../db";
import {
  GetArchiveRequestDto,
  GetArchiveResultType,
  GetPostByIdRequestDto,
  GetPostByIdResultType,
} from "./posts.dto";

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

// ===== ✨ 게시글 상세 조회 서비스 수정 ===== //
export const getPostById = async ({
  postId,
}: GetPostByIdRequestDto): Promise<GetPostByIdResultType | null> => {
  try {
    // 1. 게시글 기본 정보 조회 (작성자, 카테고리 정보 포함)
    const postQueryStr = `
      SELECT
        p.id, p.title, p.content, p.thumbnail_url AS "thumbnailUrl", p.views,
        to_char(p.created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
        to_char(p.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt",
        u.id AS "authorId",
        u.nickname AS "authorNickname",
        c.id AS "categoryId",
        c.name AS "categoryName",
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS "commentCount"
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `;
    const postResult = await query(postQueryStr, [postId]);

    if (postResult.rows.length === 0) {
      return null;
    }
    const postRow = postResult.rows[0];

    // 2. 게시글 태그 목록 조회
    const tagsQueryStr = `
      SELECT t.id, t.name FROM tags t
      JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = $1
      ORDER BY t.name ASC
    `;
    const tagsResult = await query(tagsQueryStr, [postId]);

    // ✨ 3. 최종 데이터 조립 전, 마크다운을 HTML로 비동기 변환합니다.
    const htmlContent = await marked.parse(postRow.content || ""); // content가 null일 경우를 대비해 기본값 추가

    // 4. 최종 데이터 형태로 조립
    const result: GetPostByIdResultType = {
      id: postRow.id,
      title: postRow.title,
      content: htmlContent, // ✨ 변환된 HTML content를 할당
      thumbnailUrl: postRow.thumbnailUrl,
      views: postRow.views,
      createdAt: postRow.createdAt,
      updatedAt: postRow.updatedAt,
      author: {
        id: postRow.authorId,
        nickname: postRow.authorNickname,
      },
      category: postRow.categoryId
        ? { id: postRow.categoryId, name: postRow.categoryName }
        : null,
      tags: tagsResult.rows,
      commentCount: parseInt(postRow.commentCount, 10),
    };

    return result;
  } catch (error) {
    console.error(
      `🔥🔥🔥 ERROR in getPostById service for postId ${postId}:`,
      error
    );
    throw error;
  }
};
