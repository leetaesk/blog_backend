// src/api/posts/posts.service.ts

import { marked } from "marked";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import pool, { query } from "../db";
import {
    DeletePostRequestDto,
    DeletePostResultType,
    GetArchiveLikedByMeRequestDto,
    GetArchiveLikedByMeResultType,
    GetArchiveRequestDto,
    GetArchiveResultType,
    GetPostByIdRequestDto,
    GetPostByIdResultType,
    GetPostForEditRequestDto,
    GetPostForEditResultType,
    PostPostRequestDto,
    PostPostResponseDto,
    PostPostResultType,
    UpdatePostRequestDto,
    UpdatePostResultType,
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
          p.likes_count AS "likesCount", -- ✨ 1. likes_count 조회 추가
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
            likesCount: parseInt(row.likesCount, 10), // ✨ 2. likesCount 매핑 추가
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

// ⭐️ =======================================================
// ⭐️ "내가 좋아요한 글" 아카이브 조회 서비스 (수정)
// ⭐️ =======================================================
export const getArchiveLikedByMe = async (
    queryParams: GetArchiveLikedByMeRequestDto
): Promise<GetArchiveLikedByMeResultType> => {
    try {
        // 1. 파라미터 분해 (userId 포함)
        const { page, category, search, userId } = queryParams;
        const limit = queryParams.limit || POSTS_PER_PAGE;
        const offset = (page - 1) * limit;

        // 2. 필터 조건 및 파라미터 배열 생성
        const filterConditions: string[] = [];
        const filterParams: (string | number)[] = [];

        // ⭐️ 2-1. (핵심) userId로 필터링
        filterConditions.push(`l.user_id = $${filterParams.length + 1}`);
        filterParams.push(userId);

        // 2-2. (선택) 카테고리 필터링
        if (category) {
            filterConditions.push(`c.name = $${filterParams.length + 1}`);
            filterParams.push(category);
        }

        // 2-3. (선택) 검색어 필터링
        if (search) {
            const searchTerm = `%${search}%`;
            filterConditions.push(`p.title ILIKE $${filterParams.length + 1}`);
            filterParams.push(searchTerm);
        }

        // 3. WHERE 절 생성
        const whereClause = ` WHERE ${filterConditions.join(" AND ")}`;

        // 4. JOIN 절 생성
        const likesJoin = ' JOIN "likes" l ON p.id = l.post_id';
        // ⭐️ (선택) 카테고리 필터가 있을 때만 categories JOIN
        const categoryJoin = category
            ? ' JOIN "categories" c ON p.category_id = c.id'
            : "";

        // 5. 총 개수 (Count) 쿼리 실행
        // ❗️[수정] 템플릿 리터럴 내부의 보이지 않는 비표준 공백(U+00A0)을
        // ❗️        표준 공백(U+0020)으로 모두 수정했습니다.
        const countQueryStr = `
            SELECT COUNT(*) 
            FROM "posts" p 
            ${likesJoin} 
            ${categoryJoin} 
            ${whereClause}
        `;

        console.log(
            "[DEBUG] Executing Liked Count Query:",
            countQueryStr,
            filterParams
        );
        const countResult = await query(countQueryStr, filterParams);
        const totalPostCount =
            countResult.rows.length > 0
                ? parseInt(countResult.rows[0].count, 10)
                : 0;
        const totalPage = Math.ceil(totalPostCount / limit);

        // 6. (예외 처리) 요청된 페이지가 총 페이지 수보다 크면 빈 배열 반환
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

        // 7. 본문 (Posts) 쿼리 실행
        // ❗️[수정] 여기도 마찬가지로 비표준 공백을 모두 수정했습니다.
        const postsQueryStr = `
            SELECT 
                p.id, 
                p.title, 
                p.summary, 
                to_char(p.created_at, 'YYYY-MM-DD') AS "createdAt",
                p.thumbnail_url AS "thumbnailUrl",
                p.likes_count AS "likesCount",
                c.id AS "categoryId",
                c.name AS "categoryName",
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS "commentCount"
            FROM "posts" p
            ${likesJoin} 
            LEFT JOIN "categories" c ON p.category_id = c.id
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT $${filterParams.length + 1} 
            OFFSET $${filterParams.length + 2}
        `;

        const postsParams = [...filterParams, limit, offset];

        console.log(
            "[DEBUG] Executing Liked Posts Query:",
            postsQueryStr,
            postsParams
        );
        const postsResult = await query(postsQueryStr, postsParams);

        // 8. 결과 데이터 매핑
        const posts = postsResult.rows.map((row) => ({
            id: row.id,
            title: row.title,
            summary: row.summary,
            createdAt: row.createdAt,
            thumbnailUrl: row.thumbnailUrl,
            commentCount: parseInt(row.commentCount, 10),
            likesCount: parseInt(row.likesCount, 10),
            category: {
                id: row.categoryId,
                name: row.categoryName,
            },
        }));

        // 9. 최종 결과 반환
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
        console.error("🔥🔥🔥 ERROR in getArchiveLikedByMe service:", error);
        throw error;
    }
};

// ===== ✨ 게시글 상세 조회 서비스 수정 (LEFT JOIN 사용) ===== //
export const getPostById = async ({
    postId,
    currentUserId,
}: GetPostByIdRequestDto): Promise<GetPostByIdResultType | null> => {
    try {
        const postQueryStr = `
      SELECT
        p.id, p.title, p.content, p.thumbnail_url AS "thumbnailUrl", p.views,
        p.likes_count AS "likesCount",
        to_char(p.created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
        to_char(p.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt",
        u.id AS "authorId",
        u.nickname AS "authorNickname",
        u.profile_image_url AS "authorProfileImageUrl",
        c.id AS "categoryId",
        c.name AS "categoryName",
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS "commentCount",
        
        -- ✨ 1. (수정) l.user_id가 NULL이 아니면 true, NULL이면 false
        l.user_id IS NOT NULL AS "isLikedByUser"
        
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      
      -- ✨ 2. (추가) 현재 사용자의 좋아요 기록만 LEFT JOIN
      -- ON 절에 user_id 조건을 넣는 것이 핵심입니다.
      LEFT JOIN likes l ON l.post_id = p.id AND l.user_id = $2
      
      WHERE p.id = $1
    `;

        // ✨ 3. 파라미터는 동일하게 [postId, currentUserId] 전달
        const postResult = await query(postQueryStr, [postId, currentUserId]);

        if (postResult.rows.length === 0) {
            return null;
        }
        const postRow = postResult.rows[0];

        // --- 이하 로직은 동일 ---

        // 태그 목록 조회
        const tagsQueryStr = `
          SELECT t.id, t.name FROM tags t
          JOIN post_tags pt ON t.id = pt.tag_id
          WHERE pt.post_id = $1
          ORDER BY t.name ASC
        `;
        const tagsResult = await query(tagsQueryStr, [postId]);

        // 마크다운 변환
        const rawHtml = await marked.parse(postRow.content || "");
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);

        // 최종 데이터 조립
        const result: GetPostByIdResultType = {
            id: postRow.id,
            title: postRow.title,
            content: sanitizedHtml,
            thumbnailUrl: postRow.thumbnailUrl,
            views: postRow.views,
            createdAt: postRow.createdAt,
            updatedAt: postRow.updatedAt,
            author: {
                id: postRow.authorId,
                nickname: postRow.authorNickname,
                profileImageUrl: postRow.authorProfileImageUrl,
            },
            category: postRow.categoryId
                ? { id: postRow.categoryId, name: postRow.categoryName }
                : null,
            tags: tagsResult.rows,
            commentCount: parseInt(postRow.commentCount, 10),
            likesCount: parseInt(postRow.likesCount, 10),
            isLikedByUser: postRow.isLikedByUser, // boolean 타입으로 바로 들어옵니다.
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

export const updatePost = async (
    dto: UpdatePostRequestDto
): Promise<UpdatePostResultType> => {
    const { postId, ...updateData } = dto;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. 업데이트할 필드와 값을 동적으로 구성
        // 👇👇👇 여기를 수정했습니다! .filter()를 추가해서 'tags'를 제외합니다.
        const updateFields = (
            Object.keys(updateData) as (keyof typeof updateData)[]
        ).filter((key) => key !== "tags");

        // 만약 tags를 제외하고 업데이트할 필드가 없다면, 태그 처리 로직으로 바로 넘어갑니다.
        if (updateFields.length > 0) {
            const columnMapping: Record<string, string> = {
                categoryId: "category_id",
                thumbnailUrl: "thumbnail_url",
            };

            const setClauses = updateFields
                .map((key, index) => {
                    const dbColumn = columnMapping[key] || key;
                    return `"${dbColumn}" = $${index + 1}`;
                })
                .join(", ");

            // updateValues도 필터링된 updateFields 기준으로 생성해야 합니다.
            const updateValues = updateFields.map((key) => updateData[key]);

            // 2. posts 테이블 업데이트
            const updatePostQuery = `
                UPDATE "posts"
                SET ${setClauses}, "updated_at" = CURRENT_TIMESTAMP
                WHERE id = $${updateValues.length + 1}
            `;
            await client.query(updatePostQuery, [...updateValues, postId]);
        }

        // 3. 태그 처리 (요청에 tags 필드가 있는 경우에만 실행)
        // 이 부분은 기존 로직 그대로 유지됩니다.
        if (dto.tags !== undefined) {
            // 3-1. 기존 태그 연결 모두 삭제
            await client.query('DELETE FROM "post_tags" WHERE post_id = $1', [
                postId,
            ]);

            // 3-2. 새로운 태그 추가
            if (dto.tags.length > 0) {
                for (const tagName of dto.tags) {
                    const findOrInsertTagQuery = `
                        WITH new_tag AS (
                            INSERT INTO "tags" (name) VALUES ($1)
                            ON CONFLICT (name) DO NOTHING RETURNING id
                        )
                        SELECT id FROM new_tag
                        UNION ALL
                        SELECT id FROM "tags" WHERE name = $1 AND NOT EXISTS (SELECT 1 FROM new_tag);
                    `;
                    const tagResult = await client.query(findOrInsertTagQuery, [
                        tagName,
                    ]);
                    const tagId = tagResult.rows[0].id;

                    const insertPostTagQuery = `
                        INSERT INTO "post_tags" (post_id, tag_id) VALUES ($1, $2)
                        ON CONFLICT (post_id, tag_id) DO NOTHING;
                    `;
                    await client.query(insertPostTagQuery, [postId, tagId]);
                }
            }
        }

        await client.query("COMMIT");
        return { postId };
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(
            `🔥🔥🔥 ERROR in updatePost service for postId ${postId}:`,
            error
        );
        throw error;
    } finally {
        client.release();
    }
};

export const deletePost = async (
    dto: DeletePostRequestDto
): Promise<DeletePostResultType> => {
    const { postId } = dto;
    try {
        // ON DELETE CASCADE 제약 조건 덕분에 post_tags, comments도 함께 삭제됩니다.
        const deleteQuery = 'DELETE FROM "posts" WHERE id = $1 RETURNING id';
        const result = await query(deleteQuery, [postId]);

        if (result.rowCount === 0) {
            const err = new Error("Post not found.");
            (err as any).status = 404;
            throw err;
        }

        return { postId: result.rows[0].id };
    } catch (error) {
        console.error(
            `🔥🔥🔥 ERROR in deletePost service for postId ${postId}:`,
            error
        );
        throw error;
    }
};

export const getPostForEdit = async ({
    postId,
}: GetPostForEditRequestDto): Promise<GetPostForEditResultType | null> => {
    try {
        // 1. posts 테이블에서 원본 데이터를 조회합니다.
        const postQueryStr = `
      SELECT title, content, summary, thumbnail_url AS "thumbnailUrl", category_id AS "categoryId"
      FROM posts
      WHERE id = $1
    `;
        const postResult = await query(postQueryStr, [postId]);

        if (postResult.rows.length === 0) {
            return null;
        }
        const postRow = postResult.rows[0];

        // 2. 해당 게시글의 태그 '이름' 목록을 조회합니다.
        const tagsQueryStr = `
      SELECT t.name FROM tags t
      JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = $1
      ORDER BY t.name ASC
    `;
        const tagsResult = await query(tagsQueryStr, [postId]);
        // ❗️ [{ name: 'react' }, { name: 'ts' }] -> ['react', 'ts']
        const tags = tagsResult.rows.map((row) => row.name);

        // 3. 원본 데이터와 태그 이름을 조합하여 반환합니다.
        return {
            title: postRow.title,
            content: postRow.content, // ❗️ HTML 변환 없음
            summary: postRow.summary,
            thumbnailUrl: postRow.thumbnailUrl,
            categoryId: postRow.categoryId,
            tags: tags, // ❗️ string[]
        };
    } catch (error) {
        console.error(
            `🔥🔥🔥 ERROR in getPostForEdit service for postId ${postId}:`,
            error
        );
        throw error;
    }
};
