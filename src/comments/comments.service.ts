import { query } from "../db"; // (가정) DB 쿼리 함수
import { notifyDiscord, SITE_URL } from "../utils/discordNotify";
import {
    GetCommentsServiceDto,
    getCommentsResultType,
    CommentByUser,
    CreateCommentServiceDto,
    createCommentResultType,
    UpdateCommentServiceDto,
    updateCommentResultType,
    DeleteCommentServiceDto,
    deleteCommentResultType,
    MyCommentResult,
    getCommentsCreatedByMeResultType,
} from "./comments.dto";

/**
 * 게시글 ID에 해당하는 모든 댓글을 계층 구조(1차 댓글 + 2차 답글)로 조회합니다.
 * - userId가 제공되면, 해당 유저의 '좋아요' 여부와 '소유자' 여부를 포함합니다.
 */
export const getComments = async (
    serviceDto: GetCommentsServiceDto
): Promise<getCommentsResultType> => {
    const { postId, userId } = serviceDto;

    try {
        const queryStr = `
            SELECT
                c.id,
                c.content,
                c.user_id,
                c.post_id,
                c.parent_comment_id AS "parentCommentId",
                c.likes_count AS "likesCount",
                to_char(c.created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
                to_char(c.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt",
                
                -- 댓글 작성자 정보
                u.id AS "authorId",
                u.nickname AS "authorNickname",
                u.profile_image_url AS "authorProfileImageUrl",
                
                -- 현재 유저의 '좋아요' 여부 (cl.user_id가 존재하면 true)
                (cl.user_id IS NOT NULL) AS "isLiked",

                -- 현재 유저의 '소유자' 여부 (c.user_id와 현재 userId가 같으면 true)
                (c.user_id = $2) AS "isOwner"

            FROM comments c
            
            -- 작성자 정보 JOIN
            JOIN users u ON c.user_id = u.id
            
            -- 현재 유저의 '좋아요' 기록 LEFT JOIN
            -- (postId에 해당하는 모든 댓글에 대해 현재 유저($2)의 좋아요 기록을 찾음)
            LEFT JOIN comments_likes cl ON cl.comment_id = c.id AND cl.user_id = $2
            
            WHERE c.post_id = $1 -- $1 = postId
            
            -- 계층 구조 조립을 위해 생성 시간 순으로 정렬
            ORDER BY c.created_at ASC;
        `;

        // 1. DB에서 모든 관련 댓글(1차, 2차)을 한 번에 조회
        const result = await query(queryStr, [postId, userId]);

        // 2. JS에서 계층 구조 조립
        // 댓글 ID를 키로 하는 Map을 생성하여 효율적으로 부모/자식 관계를 매칭

        type CommentInternal = CommentByUser & {
            parentCommentId?: number | null;
        };

        const commentsMap = new Map<number, CommentInternal>();
        const topLevelComments: CommentByUser[] = [];

        // 2-1. 1차 패스: 모든 댓글을 Map에 저장
        for (const row of result.rows) {
            const comment: CommentInternal = {
                id: row.id,
                content: row.content,
                userId: row.user_id, // DTO 스펙 기준
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                likesCount: row.likesCount,
                author: {
                    id: row.authorId,
                    nickname: row.authorNickname,
                    profileImageUrl: row.authorProfileImageUrl,
                },
                isOwner: row.isOwner,
                isLiked: row.isLiked,
                replies: [], // (수정) DTO 스펙에 맞게 'replies'로 수정
                repliesCount: 0, // (수정) DTO 스펙에 맞게 'repliesCount'로 수정
                parentCommentId: row.parentCommentId, // 조립을 위한 임시 필드
            };
            commentsMap.set(comment.id, comment);
        }

        // 2-2. 2차 패스: Map을 순회하며 부모-자식 관계 연결
        for (const comment of commentsMap.values()) {
            if (comment.parentCommentId) {
                // 이 댓글이 답글인 경우 (parentCommentId가 있음)
                const parent = commentsMap.get(comment.parentCommentId);
                if (parent) {
                    // 부모의 'replies' 배열에 추가 (임시 필드 제거)
                    delete comment.parentCommentId;
                    parent.replies.push(comment);
                }
            } else {
                // 이 댓글이 1차 댓글인 경우 (parentCommentId가 NULL)
                // 'topLevelComments' 배열에 추가 (임시 필드 제거)
                delete comment.parentCommentId;
                topLevelComments.push(comment);
            }
        }

        // 2-3. 3차 패스: 1차 댓글의 'repliesCount' 업데이트
        for (const comment of topLevelComments) {
            comment.repliesCount = comment.replies.length;
        }

        // 3. 최종 DTO 반환
        const response: getCommentsResultType = {
            comments: topLevelComments,
            commentCount: topLevelComments.length, // 1차 댓글의 수
        };

        return response;
    } catch (error) {
        console.error(
            `🔥🔥🔥 ERROR in getComments service for postId ${postId}:`,
            error
        );
        throw error;
    }
};

export const getCommentsCreatedByMe = async (
    userId: number
): Promise<getCommentsCreatedByMeResultType> => {
    try {
        const queryStr = `
            SELECT
                c.id,
                c.content,
                to_char(c.created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
                to_char(c.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt",
                c.likes_count AS "likesCount",
                c.parent_comment_id AS "parentCommentId",
                
                -- 원본 게시글 정보
                p.id AS "postId",
                p.title AS "postTitle",
                p.thumbnail_url AS "postThumbnailUrl",
                
                -- '좋아요' 여부 (내가 내 댓글을)
                (cl.user_id IS NOT NULL) AS "isLiked"

            FROM comments c
            
            -- 댓글이 속한 게시글 정보 JOIN
            JOIN posts p ON c.post_id = p.id
            
            -- '좋아요' 정보 LEFT JOIN (로그인한 유저 ID($1) 기준)
            LEFT JOIN comments_likes cl ON cl.comment_id = c.id AND cl.user_id = $1
            
            WHERE c.user_id = $1 -- $1 = userId
            
            -- 최신순 정렬
            ORDER BY c.created_at DESC;
            
            -- (추후) LIMIT $2 OFFSET $3 (페이지네이션)
        `;

        const result = await query(queryStr, [userId]);

        // DTO 스펙에 맞게 매핑
        const comments: MyCommentResult[] = result.rows.map(
            (row): MyCommentResult => ({
                id: row.id,
                content: row.content,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                likesCount: row.likesCount,
                isLiked: row.isLiked,
                parentCommentId: row.parentCommentId,
                post: {
                    id: row.postId,
                    title: row.postTitle,
                    thumbnailUrl: row.postThumbnailUrl,
                },
            })
        );

        return {
            comments: comments,
            commentCount: comments.length,
        };
    } catch (error) {
        console.error(
            `🔥🔥🔥 ERROR in getCommentsCreatedByMe service (userId: ${userId}):`,
            error
        );
        throw error;
    }
};
/**
 * (신규) 댓글 또는 답글을 생성합니다.
 * - 2레벨 계층(1차 댓글, 2차 답글)을 강제합니다.
 */
export const createComment = async (
    serviceDto: CreateCommentServiceDto
): Promise<createCommentResultType> => {
    const { postId, content, userId, parentCommentId } = serviceDto;

    try {
        // (권장) 실제 게시글이 존재하는지 확인 (FK 제약조건으로도 가능하지만, 명시적 확인)
        const postCheck = await query("SELECT id FROM posts WHERE id = $1", [
            postId,
        ]);
        if (postCheck.rows.length === 0) {
            throw new Error("POST_NOT_FOUND");
        }

        // 1. (Validation) 답글인 경우 (parentCommentId가 있는 경우)
        if (parentCommentId) {
            const parentCommentQuery = `
                SELECT post_id, parent_comment_id
                FROM comments
                WHERE id = $1;
            `;
            const parentResult = await query(parentCommentQuery, [
                parentCommentId,
            ]);

            // 1-1. 부모 댓글 존재 여부
            if (parentResult.rows.length === 0) {
                throw new Error("PARENT_COMMENT_NOT_FOUND");
            }

            const parentComment = parentResult.rows[0];

            // 1-2. 부모 댓글이 같은 게시글에 속해있는지
            if (parentComment.post_id !== postId) {
                throw new Error("PARENT_COMMENT_WRONG_POST");
            }

            // 1-3. 부모 댓글이 1차 댓글인지 (2레벨 계층 강제)
            if (parentComment.parent_comment_id !== null) {
                throw new Error("CANNOT_REPLY_TO_A_REPLY");
            }
        }

        // 2. 댓글 INSERT
        const insertQuery = `
            INSERT INTO comments (content, user_id, post_id, parent_comment_id)
            VALUES ($1, $2, $3, $4)
            RETURNING
                id,
                content,
                user_id AS "userId",
                to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
                parent_comment_id AS "parentCommentId"; 
                -- DTO 스펙에 맞게 number | null 반환
        `;

        const params = [content, userId, postId, parentCommentId]; // parentCommentId는 null일 수 있음

        const result = await query(insertQuery, params);

        const newComment: createCommentResultType = result.rows[0];

        // 디스코드 알림 (fire-and-forget: 실패해도 댓글 작성에는 영향 없음)
        void (async () => {
            try {
                const infoResult = await query(
                    `SELECT u.nickname AS nickname,
                            u.profile_image_url AS "profileImageUrl",
                            p.title AS title
                     FROM users u, posts p
                     WHERE u.id = $1 AND p.id = $2`,
                    [userId, postId]
                );
                const info = infoResult.rows[0];
                notifyDiscord({
                    author: {
                        name: info?.nickname ?? `user#${userId}`,
                        iconUrl: info?.profileImageUrl,
                    },
                    title: parentCommentId ? "💬 새 답글" : "🗨️ 새 댓글",
                    description:
                        content.length > 200
                            ? content.slice(0, 200) + "…"
                            : content,
                    fields: [
                        {
                            name: "게시글",
                            value: info?.title ?? `#${postId}`,
                        },
                    ],
                    color: parentCommentId ? 0x9b59b6 : 0x5865f2,
                    url: `${SITE_URL}/posts/${postId}`,
                });
            } catch (notifyError) {
                console.error(
                    "⚠️ 댓글 디스코드 알림 준비 중 오류:",
                    notifyError
                );
            }
        })();

        return newComment;
    } catch (error) {
        console.error(
            `🔥🔥🔥 ERROR in createComment service (userId: ${userId}, postId: ${postId}):`,
            error
        );
        // 컨트롤러에서 처리할 수 있도록 커스텀 에러는 그대로 throw
        if (
            error instanceof Error &&
            [
                "POST_NOT_FOUND",
                "PARENT_COMMENT_NOT_FOUND",
                "PARENT_COMMENT_WRONG_POST",
                "CANNOT_REPLY_TO_A_REPLY",
            ].includes(error.message)
        ) {
            throw error;
        }
        // 그 외 DB 오류 등
        throw new Error("Failed to create comment in service");
    }
};

/**
 * (신규) 특정 댓글의 내용을 수정합니다.
 * - `isOwnerMiddleware`를 통과했다고 가정합니다.
 */
export const updateComment = async (
    serviceDto: UpdateCommentServiceDto
): Promise<updateCommentResultType> => {
    const { commentId, userId, content } = serviceDto;

    try {
        const updateQuery = `
            UPDATE comments
            SET 
                content = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                id = $2 
                AND user_id = $3 -- (안전장치) 소유권 재확인
            RETURNING
                id,
                content,
                user_id AS "userId",
                to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt",
                to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "updatedAt",
                parent_comment_id AS "parentCommentId";
        `;

        const params = [content, commentId, userId];
        const result = await query(updateQuery, params);

        // isOwnerMiddleware가 이미 검증했지만, 쿼리 결과가 0이라면
        // (예: 어드민이 삭제했거나, DB 상태가 이상한 경우) 방어
        if (result.rows.length === 0) {
            // 미들웨어에서 이미 404/403을 처리했어야 하므로, 이 상황은 서버 에러에 가까움
            console.warn(
                `⚠️ WARNING: updateComment service (commentId: ${commentId}, userId: ${userId}) did not find a row to update, even after middleware.`
            );
            // 컨트롤러가 404를 반환할 수 있도록 리소스 없음 에러를 발생시킬 수 있으나,
            // 미들웨어를 통과했다면 500으로 처리하는 것이 맞을 수 있음
            throw new Error("COMMENT_NOT_FOUND_OR_NO_PERMISSION");
        }

        const updatedComment: updateCommentResultType = result.rows[0];
        return updatedComment;
    } catch (error) {
        console.error(
            `🔥🔥🔥 ERROR in updateComment service (commentId: ${commentId}, userId: ${userId}):`,
            error
        );
        throw error;
    }
};

/**
 * (신규) 특정 댓글을 삭제합니다.
 * - `isOwnerMiddleware`를 통과했다고 가정합니다.
 * - DB 스키마의 ON DELETE CASCADE에 의해 답글과 좋아요가 함께 삭제됩니다.
 */
export const deleteComment = async (
    serviceDto: DeleteCommentServiceDto
): Promise<deleteCommentResultType> => {
    const { commentId, userId } = serviceDto;

    try {
        const deleteQuery = `
            DELETE FROM comments
            WHERE 
                id = $1 
                AND user_id = $2 -- (안전장치) 소유권 재확인
            RETURNING
                id;
        `;

        const params = [commentId, userId];
        const result = await query(deleteQuery, params);

        if (result.rows.length === 0) {
            // update와 동일한 케이스
            console.warn(
                `⚠️ WARNING: deleteComment service (commentId: ${commentId}, userId: ${userId}) did not find a row to delete, even after middleware.`
            );
            throw new Error("COMMENT_NOT_FOUND_OR_NO_PERMISSION");
        }

        const deletedComment: deleteCommentResultType = result.rows[0];
        return deletedComment;
    } catch (error) {
        console.error(
            `🔥🔥🔥 ERROR in deleteComment service (commentId: ${commentId}, userId: ${userId}):`,
            error
        );
        throw error;
    }
};
