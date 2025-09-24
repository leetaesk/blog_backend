import { Request, Response } from "express";
import { getArchive, getPostById } from "./posts.service";
import { GetArchiveRequestDto, GetPostByIdRequestDto } from "./posts.dto";

export const getArchiveController = async (req: Request, res: Response) => {
  try {
    // 1. 요청 쿼리 파라미터 파싱 및 타입 변환
    const query: GetArchiveRequestDto = {
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 10,
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
    }; // 2. 유효성 검사 (page는 1 이상이어야 함)

    if (query.page < 1) {
      return res.status(400).json({
        isSuccess: false,
        code: "BAD_REQUEST",
        message: "Page must be a positive integer.",
      });
    } // 3. 서비스 호출

    const result = await getArchive(query); // 4. 성공 응답

    return res.status(200).json({
      isSuccess: true,
      code: "SUCCESS",
      message: "Archive retrieved successfully.",
      result,
    });
  } catch (error) {
    console.error(error); // 5. 에러 응답
    return res.status(500).json({
      isSuccess: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
};

// ===== ✨ 게시글 상세 조회 컨트롤러 추가 ===== //
export const getPostByIdController = async (req: Request, res: Response) => {
  try {
    // 1. 요청 파라미터 파싱 및 타입 변환
    const postId = parseInt(req.params.postId, 10);

    // 2. 유효성 검사 (숫자인지 확인)
    if (isNaN(postId)) {
      return res.status(400).json({
        isSuccess: false,
        code: "BAD_REQUEST",
        message: "Post ID must be a valid number.",
      });
    }

    const requestDto: GetPostByIdRequestDto = { postId };

    // 3. 서비스 호출
    const result = await getPostById(requestDto);

    // 4. 게시글이 없는 경우 404 응답
    if (!result) {
      return res.status(404).json({
        isSuccess: false,
        code: "NOT_FOUND",
        message: "Post not found.",
      });
    }

    // 5. 성공 응답
    return res.status(200).json({
      isSuccess: true,
      code: "SUCCESS",
      message: "Post retrieved successfully.",
      result,
    });
  } catch (error) {
    console.error(error);
    // 6. 에러 응답
    return res.status(500).json({
      isSuccess: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
};
