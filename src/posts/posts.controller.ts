import { Request, Response, NextFunction } from "express"; // ✨ NextFunction 추가
import { getArchive, getPostById } from "./posts.service";
import { GetArchiveRequestDto, GetPostByIdRequestDto } from "./posts.dto";

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

    if (isNaN(postId)) {
      return res.status(400).json({
        isSuccess: false,
        code: "BAD_REQUEST",
        message: "Post ID must be a valid number.",
      });
    }

    const requestDto: GetPostByIdRequestDto = { postId };
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
