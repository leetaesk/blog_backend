import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { query } from "../db";

const { JWT_SECRET } = process.env;

// TypeScript에서 req.user를 사용하기 위해 Express의 Request 타입을 확장합니다.
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number;
                role?: string;
            };
        }
    }
}

export const authMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "인증 토큰이 필요합니다." });
    }

    const token = authHeader.split(" ")[1];
    if (!JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        // 해독된 사용자 정보를 req.user에 저장하여 다음 미들웨어/컨트롤러에서 사용할 수 있게 합니다.
        req.user = { userId: decoded.userId };
        next(); // 다음 로직으로 제어를 넘깁니다.
    } catch (error) {
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
};

export const isAdminMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // 1. 헤더에서 토큰 꺼내기
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
            .status(401)
            .json({ message: "인증 헤더가 올바르지 않습니다." });
    }
    const token = authHeader.split(" ")[1];

    if (!JWT_SECRET) {
        return res
            .status(500)
            .json({ message: "서버에 JWT SECRET이 설정되지 않았습니다." });
    }

    try {
        // 2. 토큰에서 userId 해독하기
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        const { userId } = decoded;

        // 3. ⭐️ DB에서 사용자 role 조회하기 (제공해주신 방식 그대로) ⭐️
        const findUserQuery = 'SELECT id, role FROM "users" WHERE id = $1';
        const findUserResult = await query(findUserQuery, [userId]);

        // 4. DB 조회 결과로 권한 검사하기
        if (findUserResult.rows.length === 0) {
            // 토큰은 유효하지만, 해당 유저가 DB에 없는 경우
            return res
                .status(401)
                .json({ message: "존재하지 않는 사용자입니다." });
        }

        const user = findUserResult.rows[0]; // 조회된 유저 정보 (예: { id: 2, role: 'admin' })

        if (user.role !== "admin") {
            // 유저는 있지만, 관리자가 아닌 경우
            return res.status(403).json({ message: "접근 권한이 없습니다." });
        }

        // 5. 모든 검증 통과!
        req.user = user;
        next(); // 다음 로직으로 이동
    } catch (error) {
        // 토큰이 만료되었거나, 변조된 경우
        return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
};
