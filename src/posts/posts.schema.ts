import { z } from "zod";

export const createPostSchema = z.object({
    title: z
        .string({
            error: (issue) => {
                if (issue.input === undefined || issue.input === null) {
                    return {
                        message: "제목은 필수 입력 항목입니다.",
                    };
                }
                return { message: issue.message || "잘못된 입력입니다." };
            },
        })
        .min(1, { message: "제목을 한 글자 이상 입력해주세요." }),

    // content: 문자열 타입이어야 하며, 1자 이상이어야 합니다.
    content: z
        .string({
            error: (issue) => {
                if (issue.input === undefined || issue.input === null) {
                    return { message: "내용은 필수 입력 항목입니다." };
                }
                return { message: issue.message || "잘못된 입력입니다." };
            },
        })
        .min(1, { message: "내용을 한 글자 이상 입력해주세요." }),

    // categoryId: 숫자 타입이어야 합니다.
    categoryId: z.number({
        error: (issue) => {
            if (issue.input === undefined || issue.input === null) {
                return { message: "카테고리 ID는 필수 입력 항목입니다." };
            }
            if (issue.code === "invalid_type") {
                return { message: "카테고리 ID는 숫자 형태여야 합니다." };
            }
            return { message: issue.message || "잘못된 입력입니다." };
        },
    }),

    summary: z
        .string({
            error: (issue) => {
                if (issue.input === undefined || issue.input === null) {
                    return { message: "요약은 필수 입력 항목입니다." };
                }
                return { message: issue.message || "잘못된 입력입니다." };
            },
        })
        .min(1, { message: "요약을 한 글자 이상 입력해주세요." }),

    thumbnailUrl: z
        .string({
            error: (issue) => {
                if (issue.input === undefined || issue.input === null) {
                    return { message: "썸네일 URL은 필수 입력 항목입니다." };
                }
                return { message: issue.message || "잘못된 입력입니다." };
            },
        })
        .url({ message: "유효한 URL 형식이 아닙니다." }),

    // tags: 문자열 배열 타입이며, 선택적(optional) 항목입니다. (없어도 통과)
    tags: z.array(z.string()).optional(),
});

export type PostPostRequestDto = z.infer<typeof createPostSchema>;
