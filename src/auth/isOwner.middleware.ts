import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { query } from "../db";

/**
 * isOwner 미들웨어 설정을 위한 타입
 * @param tableName - 소유권을 확인할 테이블 이름 (예: "posts", "comments")
 * @param paramName - URL 파라미터에서 리소스 ID를 가져올 때 사용할 이름 (예: "postId", "commentId")
 * @param ownerColumn - tableName 테이블에서 소유자 ID를 가리키는 컬럼 이름 (보통 "user_id")
 */
interface OwnerMiddlewareConfig {
    tableName: "posts" | "comments"; // 확장성을 위해 필요한 테이블 추가
    paramName: string;
    ownerColumn: string;
}

// 팩토리 함수: 설정을 받아 Express 미들웨어를 반환합니다.
export const isOwnerMiddleware = (config: OwnerMiddlewareConfig) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // 1. 로그인한 사용자 정보 확인 (authMiddleware 선행 필수)
            const loggedInUserId = req.user?.userId;
            if (!loggedInUserId) {
                return res.status(401).json({
                    isSuccess: false,
                    code: "AUTH_001",
                    message: "인증 정보가 없습니다. 로그인이 필요합니다.",
                });
            }

            // 2. URL 파라미터에서 리소스 ID 파싱 및 유효성 검사
            const paramSchema = z.coerce.number().int().positive();
            const parseResult = paramSchema.safeParse(
                req.params[config.paramName]
            );

            if (!parseResult.success) {
                return res.status(400).json({
                    isSuccess: false,
                    code: "COMMON_002",
                    message: `요청 파라미터 '${config.paramName}'가 유효하지 않습니다.`,
                });
            }
            const resourceId = parseResult.data;

            // 3. DB에서 리소스의 소유자(user_id)와 사용자 역할(role)을 동시에 조회
            const checkOwnerQuery = `
                SELECT
                    p.${config.ownerColumn},
                    u.role
                FROM "${config.tableName}" p
                JOIN "users" u ON u.id = $1
                WHERE p.id = $2
            `;
            const queryResult = await query(checkOwnerQuery, [
                loggedInUserId,
                resourceId,
            ]);

            // 리소스가 없거나, 로그인한 사용자의 user 테이블 정보가 없는 경우
            if (queryResult.rows.length === 0) {
                // 리소스가 실제로 존재하는지 먼저 확인
                const resourceExists = await query(
                    `SELECT id FROM "${config.tableName}" WHERE id = $1`,
                    [resourceId]
                );
                if (resourceExists.rows.length === 0) {
                    return res.status(404).json({
                        isSuccess: false,
                        code: "COMMON_001",
                        message: "요청한 리소스를 찾을 수 없습니다.",
                    });
                }
                // 리소스는 있지만 소유자가 다른 경우
                return res.status(403).json({
                    isSuccess: false,
                    code: "AUTH_003",
                    message: "이 리소스에 접근할 권한이 없습니다.",
                });
            }

            const resourceOwnerId = queryResult.rows[0][config.ownerColumn];
            const userRole = queryResult.rows[0].role;

            // 4. 소유권 확인: (로그인한 사용자 ID === 리소스 소유자 ID) 또는 (사용자 역할이 'admin')
            if (loggedInUserId === resourceOwnerId || userRole === "admin") {
                next(); // 권한이 있으면 다음 미들웨어로 진행
            } else {
                return res.status(403).json({
                    isSuccess: false,
                    code: "AUTH_003",
                    message: "이 리소스에 접근할 권한이 없습니다.",
                });
            }
        } catch (error) {
            next(error);
        }
    };
};

// 게시글 소유권 확인 미들웨어 인스턴스 생성
export const isPostOwner = isOwnerMiddleware({
    tableName: "posts",
    paramName: "postId",
    ownerColumn: "user_id",
});

// (향후 확장) 댓글 소유권 확인 미들웨어 인스턴스 생성
// export const isCommentOwner = isOwnerMiddleware({
//     tableName: "comments",
//     paramName: "commentId",
//     ownerColumn: "user_id",
// });
