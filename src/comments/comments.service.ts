import { query } from "../db"; // (가정) DB 쿼리 함수
import {
    GetCommentsServiceDto,
    getCommentsResultType,
    CommentByUser,
} from "./comments.dto";
import { Author } from "../posts/posts.dto"; // (가정) Author DTO 위치

// (수정) DTO에 정의된 'replise', 'repliseCount' 오타를 감안하여 그대로 사용합니다.
// (삭제) createAt 관련 주석 삭제

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

        // (수정) parentCommentId를 optional로 변경 (delete 연산자 사용을 위해)
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
                createdAt: row.createdAt, // (수정) createAt -> createdAt
                updatedAt: row.updatedAt,
                likesCount: row.likesCount,
                author: {
                    id: row.authorId,
                    nickname: row.authorNickname,
                    profileImageUrl: row.authorProfileImageUrl,
                },
                isOwner: row.isOwner,
                isLiked: row.isLiked,
                replise: [], // (수정) replies -> replise (DTO 스펙 기준)
                repliseCount: 0, // 답글 수 (DTO 스펙 기준, 오타 감안)
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
                    parent.replise.push(comment); // (수정) replies -> replise
                }
            } else {
                // 이 댓글이 1차 댓글인 경우 (parentCommentId가 NULL)
                // 'topLevelComments' 배열에 추가 (임시 필드 제거)
                delete comment.parentCommentId;
                topLevelComments.push(comment);
            }
        }

        // 2-3. 3차 패스: 1차 댓글의 'repliseCount' 업데이트
        for (const comment of topLevelComments) {
            comment.repliseCount = comment.replise.length; // (수정) replies -> replise
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
