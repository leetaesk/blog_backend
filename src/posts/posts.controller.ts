import { Request, Response, NextFunction } from "express"; // ✨ NextFunction 추가
import {
    deletePost,
    getArchive,
    getPostById,
    getPostForEdit,
    postPost,
    updatePost,
} from "./posts.service";
import {
    DeletePostRequestDto,
    GetArchiveRequestDto,
    GetPostByIdRequestDto,
    GetPostForEditRequestDto,
    PostPostRequestDto,
    UpdatePostRequestDto,
} from "./posts.dto";
import { createPostSchema, updatePostSchema } from "./posts.schema";
import { ZodError } from "zod";

export const getArchiveController = async (
    req: Request,
    res: Response,
    next: NextFunction // ✨ next 추가
) => {
    try {
        // 1. 요청 쿼리 파라미터 파싱 및 타입 변환
        const query: GetArchiveRequestDto = {
            page: parseInt(req.query.page as string, 10) || 1,
            limit: parseInt(req.query.limit as string, 10) || 10,
            category: req.query.category as string | undefined,
            search: req.query.search as string | undefined,
        };

        // 2. 유효성 검사 (page는 1 이상이어야 함)
        if (query.page < 1) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "Page must be a positive integer.",
            });
        }

        // 3. 서비스 호출
        const result = await getArchive(query);

        // 4. 성공 응답
        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "Archive retrieved successfully.",
            result,
        });
    } catch (error) {
        // ✨ 5. 에러를 중앙 핸들러로 전달
        next(error);
    }
};

export const getPostByIdController = async (
    req: Request,
    res: Response,
    next: NextFunction // ✨ next 추가
) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        // ✨ 1. (수정) attachUserMiddleware가 넣어준 userId를 선택적으로 가져옴
        const currentUserId = req.user?.userId;
        console.log(currentUserId);

        if (isNaN(postId)) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "Post ID must be a valid number.",
            });
        }

        // ✨ 2. (수정) DTO에 currentUserId 포함
        const requestDto: GetPostByIdRequestDto = { postId, currentUserId };
        // ✨ 3. (수정) 서비스로 DTO 전달
        const result = await getPostById(requestDto);

        if (!result) {
            return res.status(404).json({
                isSuccess: false,
                code: "NOT_FOUND",
                message: "Post not found.",
            });
        }

        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "Post retrieved successfully.",
            result,
        });
    } catch (error) {
        // ✨ 6. 에러를 중앙 핸들러로 전달
        next(error);
    }
};

export const postPostController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const postDto: PostPostRequestDto = createPostSchema.parse(req.body);

        const userId = req.user?.userId;

        // authMiddleware를 통과했다면 user.id는 항상 존재하지만, 타입스크립트를 위한 안전장치
        if (!userId) {
            const err = new Error("인증 정보가 없습니다.");
            (err as any).status = 401;
            throw err;
        }

        const responseDto = await postPost(userId, postDto);

        // 💡 200 OK도 괜찮지만, 새로운 리소스가 성공적으로 생성되었을 때는
        // '201 Created' 상태 코드를 사용하는 것이 RESTful API 디자인 원칙에 더 부합합니다.
        res.status(201).json(responseDto);
    } catch (error) {
        // 4. 에러 처리
        // Zod 유효성 검사 실패 시
        if (error instanceof ZodError) {
            // 400 Bad Request 상태 코드와 함께 구체적인 에러 메시지를 클라이언트에 전달
            return res.status(400).json({
                message: "입력값이 유효하지 않습니다.",
                // error.flatten().fieldErrors는 각 필드별 에러 메시지를 객체로 반환합니다.
                // 예: { title: ["제목을 한 글자 이상 입력해주세요."] }
                errors: error.flatten().fieldErrors,
            });
        }
        console.error("🔥🔥🔥 ERROR in handleCreatePost controller:", error);
        next(error);
    }
};

export const updatePostController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. 요청 파라미터와 바디 데이터 파싱
        const postId = parseInt(req.params.postId, 10);
        const updateData = updatePostSchema.parse(req.body);

        // 2. DTO 구성
        const dto: UpdatePostRequestDto = { postId, ...updateData };

        // 3. 서비스 호출
        const result = await updatePost(dto);

        // 4. 성공 응답
        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "Post updated successfully.",
            result,
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "Invalid input.",
                errors: error.flatten().fieldErrors,
            });
        }
        next(error);
    }
};

export const deletePostController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. 요청 파라미터 파싱
        const postId = parseInt(req.params.postId, 10);

        // 2. DTO 구성
        const dto: DeletePostRequestDto = { postId };

        // 3. 서비스 호출
        const result = await deletePost(dto);

        // 4. 성공 응답
        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "Post deleted successfully.",
            result,
        });
    } catch (error) {
        next(error);
    }
};

export const getPostForEditController = async (
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
                message: "Post ID must be a valid number.",
            });
        }

        const requestDto: GetPostForEditRequestDto = { postId };
        const result = await getPostForEdit(requestDto);

        if (!result) {
            return res.status(404).json({
                isSuccess: false,
                code: "NOT_FOUND",
                message: "Post not found.",
            });
        }

        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "Post data for edit retrieved successfully.",
            result,
        });
    } catch (error) {
        next(error);
    }
};
