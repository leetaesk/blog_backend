import { Request, Response, NextFunction } from "express";
// ❗️ 1. 호출할 서비스 함수들을 import 합니다. (toggleCommentLikes 추가)
import { toggleLikes, toggleCommentLikes } from "./likes.service";

// ❗️ 2. 게시글, 댓글 DTO를 모두 import 합니다.
import {
    TogglePostLikeResultType,
    TogglePostLikeServiceDto,
    ToggleCommentLikeServiceDto,
    ToggleCommentLikeResultType,
} from "./likes.dto";

//
// 1. 게시글 좋아요 컨트롤러 (기존)
//
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

        const dto: TogglePostLikeServiceDto = { postId, userId };

        // 🚨 'toggleLikes' (게시글) 서비스 호출
        const result: TogglePostLikeResultType = await toggleLikes(dto);

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

//
// 2. 댓글 좋아요 컨트롤러 (신규)
//
export const handleCommentToggleLikes = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // ❗️ 'commentId' 파라미터를 받습니다.
        const commentId = parseInt(req.params.commentId, 10);
        if (isNaN(commentId)) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                // ❗️ 에러 메시지 변경
                message: "유효하지 않은 Comment ID입니다.",
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

        // ❗️ '댓글' DTO를 사용합니다.
        const dto: ToggleCommentLikeServiceDto = { commentId, userId };

        // 🚨 'toggleCommentLikes' (댓글) 서비스 호출
        const result: ToggleCommentLikeResultType = await toggleCommentLikes(
            dto
        );

        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: result.liked
                ? "좋아요가 추가되었습니다."
                : "좋아요가 취소되었습니다.",
            result: result, // { commentId, liked, newLikesCount }
        });
    } catch (error) {
        next(error);
    }
};
