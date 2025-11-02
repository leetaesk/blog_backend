import { Request, Response, NextFunction } from "express";
import { toggleLikes } from "./likes.service";
import { ToggleLikeServiceDto, ToggleLikeResultType } from "./likes.dto";

export const handleToggleLikes = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        if (isNaN(postId)) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "유효하지 않은 Post ID입니다.",
            });
        }

        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                isSuccess: false,
                code: "UNAUTHORIZED",
                message: "인증 정보가 없습니다.",
            });
        }

        // 3. 서비스에 전달할 DTO를 구성합니다.
        const dto: ToggleLikeServiceDto = { postId, userId };

        // 🚨 4. 서비스를 호출합니다. (req.file 대신 dto 전달)
        // 서비스는 { postId, liked, newLikesCount } 형태의 객체를 반환해야 합니다.
        const result: ToggleLikeResultType = await toggleLikes(dto);

        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: result.liked
                ? "좋아요가 추가되었습니다."
                : "좋아요가 취소되었습니다.",
            result: result, // { postId, liked, newLikesCount }
        });
    } catch (error) {
        next(error);
    }
};
