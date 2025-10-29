// src/api/posts/posts.service.ts

import { marked } from "marked";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import pool, { query } from "../db";
import {
    GetArchiveRequestDto,
    GetArchiveResultType,
    GetPostByIdRequestDto,
    GetPostByIdResultType,
    PostPostRequestDto,
    PostPostResponseDto,
    PostPostResultType,
} from "./posts.dto";

// DOMPurify는 브라우저 환경의 DOM API가 필요하므로, Node.js 환경에서는 jsdom으로 가상 DOM을 만들어줍니다.
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window as any);

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

        console.log(
            "[DEBUG] Executing Count Query:",
            countQueryStr,
            filterParams
        );
        const countResult = await query(countQueryStr, filterParams);

        const totalPostCount =
            countResult.rows.length > 0
                ? parseInt(countResult.rows[0].count, 10)
                : 0;
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

        console.log(
            "[DEBUG] Executing Posts Query:",
            postsQueryStr,
            postsParams
        );
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
         u.profile_image_url AS "authorProfileImageUrl", -- ✨ 1. 작성자 프로필 이미지 URL 조회 추가
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
        const rawHtml = await marked.parse(postRow.content || ""); // content가 null일 경우를 대비해 기본값 추가

        // 2단계 (★★★ 중요 ★★★): XSS 공격 방지를 위해 HTML 소독(Sanitize)
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);

        // 4. 최종 데이터 형태로 조립
        const result: GetPostByIdResultType = {
            id: postRow.id,
            title: postRow.title,
            content: sanitizedHtml, // ✨ 소독된 안전한 HTML을 할당
            thumbnailUrl: postRow.thumbnailUrl,
            views: postRow.views,
            createdAt: postRow.createdAt,
            updatedAt: postRow.updatedAt,
            author: {
                id: postRow.authorId,
                nickname: postRow.authorNickname,
                profileImageUrl: postRow.authorProfileImageUrl, // ✨ 2. author 객체에 프로필 이미지 URL 추가
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

export const postPost = async (
    userId: number,
    dto: PostPostRequestDto
): Promise<PostPostResponseDto> => {
    // DB 커넥션 풀에서 클라이언트를 하나 가져옵니다.
    const client = await pool.connect();

    try {
        // =======================================================
        // 1. 트랜잭션 시작
        // =======================================================
        await client.query("BEGIN");

        // =======================================================
        // 2. 'posts' 테이블에 새 게시글 삽입
        // =======================================================
        const insertPostQuery = `
            INSERT INTO "posts" (user_id, title, content, summary, category_id, thumbnail_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id; -- ⭐️ 생성된 게시글의 id를 바로 반환받습니다.
        `;
        const postValues = [
            userId,
            dto.title,
            dto.content,
            dto.summary,
            dto.categoryId,
            dto.thumbnailUrl,
        ];
        const postResult = await client.query(insertPostQuery, postValues);
        const postId = postResult.rows[0].id; // 새로 생성된 게시글의 ID

        // =======================================================
        // 3. 태그 처리 (요청에 tags가 있을 경우에만 실행)
        // =======================================================
        if (dto.tags && dto.tags.length > 0) {
            for (const tagName of dto.tags) {
                // 3-1. 'tags' 테이블에서 태그를 찾거나, 없으면 새로 삽입 (UPSERT)
                const findOrInsertTagQuery = `
                    WITH new_tag AS (
                        INSERT INTO "tags" (name)
                        VALUES ($1)
                        ON CONFLICT (name) DO NOTHING
                        RETURNING id
                    )
                    SELECT id FROM new_tag
                    UNION ALL
                    SELECT id FROM "tags" WHERE name = $1 AND NOT EXISTS (SELECT 1 FROM new_tag);
                `;

                const tagResult = await client.query(findOrInsertTagQuery, [
                    tagName,
                ]);
                const tagId = tagResult.rows[0].id;

                // 3-2. 'post_tags' 테이블에 게시글과 태그의 관계를 추가
                const insertPostTagQuery = `
                    INSERT INTO "post_tags" (post_id, tag_id)
                    VALUES ($1, $2);
                `;
                await client.query(insertPostTagQuery, [postId, tagId]);
            }
        }

        // =======================================================
        // 4. 모든 쿼리가 성공하면 트랜잭션을 커밋
        // =======================================================
        await client.query("COMMIT");

        // =======================================================
        // 5. 클라이언트에 반환할 최종 응답 DTO 구성
        // =======================================================
        const result: PostPostResultType = {
            postId,
        };
        const response: PostPostResponseDto = {
            isSuccess: true,
            code: "POSTS_001",
            message: "게시글이 성공적으로 작성되었습니다.",
            result,
        };
        return response;
    } catch (error) {
        // =======================================================
        // ❗️에러 발생 시 모든 변경사항을 롤백
        // =======================================================
        await client.query("ROLLBACK");
        console.error("🔥🔥🔥 ERROR in createPost service:", error);
        // 에러를 상위로 전파하여 중앙 에러 핸들러에서 처리하도록 합니다.
        throw error;
    } finally {
        // =======================================================
        // ✅ 사용한 DB 클라이언트를 커넥션 풀에 반환
        // =======================================================
        client.release();
    }
};
