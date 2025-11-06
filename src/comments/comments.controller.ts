import { Request, Response, NextFunction } from "express";
import { GetCommentsServiceDto } from "./comments.dto";
import { getComments } from "./comments.service";

export const handleGetComments = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const postId = parseInt(req.params.postId, 10);

        // attachUserMiddleware가 설정한 선택적 userId
        const currentUserId = req.user?.userId;

        if (isNaN(postId)) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "유효하지 않은 Post ID입니다.",
            });
        }

        // 서비스 DTO 생성
        const serviceDto: GetCommentsServiceDto = {
            postId,
            userId: currentUserId,
        };

        // 서비스 호출
        const result = await getComments(serviceDto);

        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "댓글이 성공적으로 조회되었습니다.",
            result: result, // { comments: CommentByUser[], commentCount: number }
        });
    } catch (error) {
        next(error); // 중앙 에러 핸들러로 전달
    }
};
