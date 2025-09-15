// src/categories/categories.controller.ts

import { Request, Response } from "express";
import { getCategories } from "./categories.service";

/**
 * GET /api/categories 요청을 처리하는 컨트롤러
 */
export const handleGetCategories = async (req: Request, res: Response) => {
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
    return res.status(500).json({
      isSuccess: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 에러가 발생했습니다.",
    });
  }
};
