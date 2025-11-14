import pool from "../db";
// ❗️ 1. DTO import를 DTO 파일에 맞춰 'Post'와 'Comment'로 명확히 구분합니다.
import {
    TogglePostLikeServiceDto, // 이름 변경
    TogglePostLikeResultType, // 이름 변경
    ToggleCommentLikeServiceDto, // 신규 추가
    ToggleCommentLikeResultType, // 신규 추가
} from "./likes.dto";

/**
 * '게시글' 좋아요 상태를 토글합니다.
 * (기존 toggleLikes 함수 -> DTO 타입만 업데이트)
 */
export const toggleLikes = async (
    dto: TogglePostLikeServiceDto // ❗️ 타입 변경
): Promise<TogglePostLikeResultType> => {
    // ❗️ 타입 변경
    const { postId, userId } = dto;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 2. 'likes' 테이블 (게시글)
        const deleteQuery = `
            DELETE FROM "likes" 
            WHERE user_id = $1 AND post_id = $2
            RETURNING *
        `;
        const deleteResult = await client.query(deleteQuery, [userId, postId]);

        let liked: boolean;
        let newLikesCount: number;

        if (deleteResult.rowCount && deleteResult.rowCount > 0) {
            // 3-A. 'posts' 테이블 (게시글)
            const updateResult = await client.query(
                `
                UPDATE "posts"
                SET likes_count = GREATEST(0, likes_count - 1)
                WHERE id = $1
                RETURNING likes_count
                `,
                [postId]
            );

            if (updateResult.rows.length === 0) {
                throw new Error("Post not found during like count update.");
            }
            newLikesCount = updateResult.rows[0].likes_count;
            liked = false;
        } else {
            // 3-B. 'likes' 테이블 (게시글)
            await client.query(
                `
                INSERT INTO "likes" (user_id, post_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, post_id) DO NOTHING
                `,
                [userId, postId]
            );

            // 'posts' 테이블 (게시글)
            const updateResult = await client.query(
                `
                UPDATE "posts"
                SET likes_count = likes_count + 1
                WHERE id = $1
                RETURNING likes_count
                `,
                [postId]
            );

            if (updateResult.rows.length === 0) {
                throw new Error("Post not found during like count update.");
            }
            newLikesCount = updateResult.rows[0].likes_count;
            liked = true;
        }

        await client.query("COMMIT");

        // 5. 최종 결과 반환
        return {
            postId,
            liked,
            newLikesCount,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(
            `🔥🔥🔥 ERROR in toggleLike (post) service for postId ${postId} by userId ${userId}:`,
            error
        );
        throw error;
    } finally {
        client.release();
    }
};

// =======================================================
// ⬇️ 신규 함수 추가 ⬇️
// =======================================================

/**
 * '댓글' 좋아요 상태를 토글합니다.
 * (게시글 로직을 '댓글' 스키마에 맞게 적용)
 */
export const toggleCommentLikes = async (
    dto: ToggleCommentLikeServiceDto // ❗️ 댓글 DTO
): Promise<ToggleCommentLikeResultType> => {
    // ❗️ 댓글 DTO

    // ❗️ postId -> commentId
    const { commentId, userId } = dto;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 2. 'comments_likes' 테이블 (댓글)
        const deleteQuery = `
            DELETE FROM "comments_likes" 
            WHERE user_id = $1 AND comment_id = $2
            RETURNING *
        `;
        // ❗️ postId -> commentId
        const deleteResult = await client.query(deleteQuery, [
            userId,
            commentId,
        ]);

        let liked: boolean;
        let newLikesCount: number;

        if (deleteResult.rowCount && deleteResult.rowCount > 0) {
            // 3-A. 'comments' 테이블 (댓글)
            const updateResult = await client.query(
                `
                UPDATE "comments"
                SET likes_count = GREATEST(0, likes_count - 1)
                WHERE id = $1
                RETURNING likes_count
                `,
                [commentId] // ❗️ postId -> commentId
            );

            if (updateResult.rows.length === 0) {
                // ❗️ 에러 메시지 변경
                throw new Error("Comment not found during like count update.");
            }
            newLikesCount = updateResult.rows[0].likes_count;
            liked = false;
        } else {
            // 3-B. 'comments_likes' 테이블 (댓글)
            await client.query(
                `
                INSERT INTO "comments_likes" (user_id, comment_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, comment_id) DO NOTHING
                `,
                [userId, commentId] // ❗️ postId -> commentId
            );

            // 'comments' 테이블 (댓글)
            const updateResult = await client.query(
                `
                UPDATE "comments"
                SET likes_count = likes_count + 1
                WHERE id = $1
                RETURNING likes_count
                `,
                [commentId] // ❗️ postId -> commentId
            );

            if (updateResult.rows.length === 0) {
                // ❗️ 에러 메시지 변경
                throw new Error("Comment not found during like count update.");
            }
            newLikesCount = updateResult.rows[0].likes_count;
            liked = true;
        }

        await client.query("COMMIT");

        // 5. 최종 결과 반환
        return {
            commentId, // ❗️ postId -> commentId
            liked,
            newLikesCount,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(
            // ❗️ 로그 메시지 변경
            `🔥🔥🔥 ERROR in toggleCommentLikes service for commentId ${commentId} by userId ${userId}:`,
            error
        );
        throw error;
    } finally {
        client.release();
    }
};
