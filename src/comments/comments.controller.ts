import { Request, Response, NextFunction } from "express";
import {
    createCommentRequestDto,
    CreateCommentServiceDto,
    DeleteCommentServiceDto,
    GetCommentsServiceDto,
    UpdateCommentBodyDto,
    UpdateCommentServiceDto,
} from "./comments.dto";
import {
    createComment,
    deleteComment,
    getComments,
    updateComment,
} from "./comments.service";

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

export const handleCreateComments = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. 유저 ID (authMiddleware 보장)
        const userId = req.user!.userId;

        // 2. Body DTO (라우터를 POST / 로 변경)
        const { postId, content, parentCommentId } =
            req.body as createCommentRequestDto;

        // 3. 기본 유효성 검사
        if (!postId || isNaN(postId) || postId <= 0) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "유효하지 않은 postId입니다.",
            });
        }

        if (!content || content.trim() === "") {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "댓글 내용이 비어있습니다.",
            });
        }

        if (
            parentCommentId !== undefined &&
            (isNaN(parentCommentId) || parentCommentId <= 0)
        ) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "유효하지 않은 parentCommentId입니다.",
            });
        }

        // 4. 서비스 DTO 생성
        const serviceDto: CreateCommentServiceDto = {
            postId,
            content,
            userId,
            parentCommentId: parentCommentId || null, // undefined -> null
        };

        // 5. 서비스 호출
        const result = await createComment(serviceDto);

        // 6. 응답 반환 (201 Created)
        return res.status(201).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "댓글이 성공적으로 작성되었습니다.",
            result: result,
        });
    } catch (error) {
        // 7. 서비스 레이어에서 발생한 커스텀 에러 처리
        if (error instanceof Error) {
            let statusCode = 500;
            let errorCode = "INTERNAL_SERVER_ERROR";
            let message = "서버 내부 오류";

            switch (error.message) {
                case "POST_NOT_FOUND": // (서비스에서 추가될 수 있는 에러)
                    statusCode = 404;
                    errorCode = "NOT_FOUND";
                    message = "댓글을 작성할 게시글을 찾을 수 없습니다.";
                    break;
                case "PARENT_COMMENT_NOT_FOUND":
                    statusCode = 404;
                    errorCode = "NOT_FOUND";
                    message = "답글을 작성할 상위 댓글을 찾을 수 없습니다.";
                    break;
                case "PARENT_COMMENT_WRONG_POST":
                    statusCode = 400;
                    errorCode = "BAD_REQUEST";
                    message = "상위 댓글이 현재 게시글에 속해있지 않습니다.";
                    break;
                case "CANNOT_REPLY_TO_A_REPLY":
                    statusCode = 400;
                    errorCode = "BAD_REQUEST";
                    message: "답글의 답글을 작성할 수 없습니다 (2레벨 계층만 지원).";
                    break;
            }

            if (statusCode !== 500) {
                return res.status(statusCode).json({
                    isSuccess: false,
                    code: errorCode,
                    message: message,
                });
            }
        }
        // 그 외 에러는 중앙 에러 핸들러로
        next(error);
    }
};

export const handleUpdateComments = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. 유저 ID (authMiddleware가 보장)
        const userId = req.user!.userId;

        // 2. 댓글 ID (isOwnerMiddleware가 파싱 및 검증 완료)
        const commentId = parseInt(req.params.commentId, 10);

        // 3. Body DTO 및 유효성 검사
        const { content } = req.body as UpdateCommentBodyDto;
        if (!content || content.trim() === "") {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "댓글 내용이 비어있습니다.",
            });
        }

        // 4. 서비스 DTO 생성
        // isOwnerMiddleware가 소유권을 검증했지만,
        // 서비스 레이어에서 update 쿼리를 날릴 때 "AND user_id = $3"을 거는 것이
        // 더 안전하므로 userId를 함께 넘깁니다.
        const serviceDto: UpdateCommentServiceDto = {
            commentId,
            content,
            userId,
        };

        // 5. 서비스 호출
        const result = await updateComment(serviceDto);

        // 6. 응답 반환 (200 OK)
        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "댓글이 성공적으로 수정되었습니다.",
            result: result,
        });
    } catch (error) {
        // 7. isOwnerMiddleware가 404/403을 처리했으므로,
        // 여기서 발생하는 에러는 대부분 500번대 에러입니다.
        // (혹은 서비스 레이어의 커스텀 400 에러)
        next(error);
    }
};

export const handleDeleteComments = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. 유저 ID (authMiddleware가 보장)
        const userId = req.user!.userId;

        // 2. 댓글 ID (isOwnerMiddleware가 파싱 및 검증 완료)
        const commentId = parseInt(req.params.commentId, 10);

        // 3. Body는 필요 없음.

        // 4. 서비스 DTO 생성
        const serviceDto: DeleteCommentServiceDto = {
            commentId,
            userId,
        };

        // 5. 서비스 호출
        const result = await deleteComment(serviceDto); // result: { id: number }

        // 6. 응답 반환 (200 OK)
        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "댓글이 성공적으로 삭제되었습니다.",
            result: result,
        });
    } catch (error) {
        // 7. 중앙 에러 핸들러로 전달
        next(error);
    }
};
