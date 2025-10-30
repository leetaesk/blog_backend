import { Request, Response, NextFunction } from "express";
import { createCategory, getCategories } from "./categories.service";
import {
    createCategoryRequestDto,
    createCategoryResponseDto,
    GetCategoriesResponseDto,
} from "./categories.dto"; // ✨ 필요한 DTO 타입들을 import 합니다.

/**
 * 모든 카테고리 조회 컨트롤러
 */
export const handleGetCategories = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. 서비스가 순수 데이터(CategoryWithPostCount[])를 반환
        const categories = await getCategories();

        // 2. 컨트롤러가 DTO를 조립하여 응답
        // ✨ GetCategoriesResponseDto 타입을 명시합니다.
        const responseDto: GetCategoriesResponseDto = {
            isSuccess: true,
            code: "200", // "SUCCESS"도 가능합니다.
            message: "카테고리 목록을 성공적으로 조회했습니다.",
            result: {
                categories, // 서비스에서 받은 데이터
            },
        };
        return res.status(200).json(responseDto);
    } catch (error) {
        // 3. 서비스에서 throw된 에러를 중앙 핸들러로 전달
        next(error);
    }
};

/**
 * ✨ 새 카테고리 생성 컨트롤러 (신규 추가)
 */
export const handleCreateCategory = async (
    // ✨ Request Body의 타입을 DTO로 지정합니다.
    req: Request<any, any, createCategoryRequestDto>,
    res: Response,
    next: NextFunction
) => {
    try {
        const { category } = req.body;

        // 1. 컨트롤러 레벨에서 간단한 유효성 검사
        if (
            !category ||
            typeof category !== "string" ||
            category.trim() === ""
        ) {
            const err = new Error("카테고리 이름이 올바르지 않습니다.");
            (err as any).status = 400; // Bad Request
            throw err; // 중앙 에러 핸들러로 전달
        }

        // 2. 서비스가 순수 데이터(CreateCategoryServiceResult)를 반환
        // ✨ { categoryId, isNew } 객체를 구조분해 할당으로 받습니다.
        const { categoryId, isNew } = await createCategory(category.trim());

        // 3. 컨트롤러가 DTO를 조립
        // ✨ createCategoryResponseDto 타입을 명시합니다.
        const responseDto: createCategoryResponseDto = {
            isSuccess: true,
            // ✨ isNew 값에 따라 코드와 메시지를 다르게 설정
            code: isNew ? "201" : "200",
            message: isNew
                ? "새로운 카테고리를 생성했습니다."
                : "이미 존재하는 카테고리입니다.",
            result: { categoryId },
        };

        // 4. ✨ isNew 값에 따라 HTTP 상태 코드를 결정 (201 Created / 200 OK)
        return res.status(isNew ? 201 : 200).json(responseDto);
    } catch (error) {
        // 5. 유효성 검사 에러 또는 서비스 에러를 중앙 핸들러로 전달
        next(error);
    }
};
