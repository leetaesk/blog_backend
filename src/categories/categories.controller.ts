import { Request, Response, NextFunction } from "express"; // ✨ NextFunction 추가
import { getCategories } from "./categories.service";

export const handleGetCategories = async (
    req: Request,
    res: Response,
    next: NextFunction // ✨ next 추가
) => {
    try {
        const categories = await getCategories();

        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "카테고리 목록을 성공적으로 조회했습니다.",
            result: {
                categories,
            },
        });
    } catch (error) {
        // ✨ 에러를 중앙 핸들러로 전달
        next(error);
    }
};
