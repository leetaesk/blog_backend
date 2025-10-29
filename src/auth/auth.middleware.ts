import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

const { JWT_SECRET } = process.env;

// TypeScript에서 req.user를 사용하기 위해 Express의 Request 타입을 확장합니다.
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number;
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
