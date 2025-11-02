import pool from "../db";
import { ToggleLikeServiceDto, ToggleLikeResultType } from "./likes.dto";

/**
 * '좋아요' 상태를 토글합니다.
 * 1. 'likes' 테이블에서 (userId, postId) 조합을 삭제 시도합니다.
 * 2. 삭제 성공 시 (rowCount > 0): '좋아요 취소'로 간주하고, 'posts' 테이블의 likes_count를 1 감소시킵니다.
 * 3. 삭제 실패 시 (rowCount = 0): '좋아요 추가'로 간주하고, 'likes' 테이블에 삽입 후 'posts' 테이블의 likes_count를 1 증가시킵니다.
 * 이 모든 과정은 트랜잭션으로 처리됩니다.
 */
export const toggleLikes = async (
    dto: ToggleLikeServiceDto
): Promise<ToggleLikeResultType> => {
    const { postId, userId } = dto;
    // 🚨 DB 커넥션 풀에서 클라이언트를 하나 가져옵니다.
    const client = await pool.connect();

    try {
        // =======================================================
        // 1. 트랜잭션 시작
        // =======================================================
        await client.query("BEGIN");

        // 2. 'likes' 테이블에서 기존 좋아요 기록 삭제 시도
        const deleteQuery = `
            DELETE FROM "likes"
            WHERE user_id = $1 AND post_id = $2
            RETURNING *
        `;
        const deleteResult = await client.query(deleteQuery, [userId, postId]);

        let liked: boolean;
        let newLikesCount: number;

        // ✨ [수정] rowCount가 null일 수 있는 가능성을 TypeScript가 제기하므로,
        // null 또는 0이 아닌 경우(즉, 0보다 큰 경우)를 확인하도록 변경합니다.
        if (deleteResult.rowCount && deleteResult.rowCount > 0) {
            // 3-A. 삭제 성공 (rowCount > 0) -> '좋아요' 취소
            // 'posts' 테이블의 likes_count 1 감소
            const updateResult = await client.query(
                `
                UPDATE "posts"
                SET likes_count = GREATEST(0, likes_count - 1) -- 0 미만으로 내려가지 않도록 보장
                WHERE id = $1
                RETURNING likes_count
                `,
                [postId]
            );

            if (updateResult.rows.length === 0) {
                // 이 에러는 게시글이 존재하지 않을 때 발생할 수 있습니다.
                throw new Error("Post not found during like count update.");
            }

            newLikesCount = updateResult.rows[0].likes_count;
            liked = false;
        } else {
            // 3-B. 삭제 실패 (rowCount === 0 또는 null) -> '좋아요' 추가
            // 'likes' 테이블에 새로운 '좋아요' 기록 삽입
            // ON CONFLICT는 혹시 모를 동시성 문제를 방지합니다.
            await client.query(
                `
                INSERT INTO "likes" (user_id, post_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, post_id) DO NOTHING
                `,
                [userId, postId]
            );

            // 'posts' 테이블의 likes_count 1 증가
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

        // =======================================================
        // 4. 트랜잭션 커밋
        // =======================================================
        await client.query("COMMIT");

        // 5. 최종 결과 반환
        return {
            postId,
            liked,
            newLikesCount,
        };
    } catch (error) {
        // =======================================================
        // ❗️ 6. 에러 발생 시 롤백
        // =======================================================
        await client.query("ROLLBACK");
        console.error(
            `🔥🔥🔥 ERROR in toggleLike service for postId ${postId} by userId ${userId}:`,
            error
        );
        throw error; // 에러를 컨트롤러로 전파
    } finally {
        // =======================================================
        // ✅ 7. DB 클라이언트 반환
        // =======================================================
        client.release();
    }
};
