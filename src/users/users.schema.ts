import { z } from "zod";

/**
 * ⭐️ (변경)
 * 프로필 업데이트 요청(multipart/form-data)의 'body' 부분 유효성 검사 스키마입니다.
 */
export const updateProfileSchema = z
    .object({
        /**
         * 닉네임: 2자 이상 50자 이하 (선택 사항)
         */
        nickname: z
            .string()
            .min(2, "닉네임은 2자 이상이어야 합니다.")
            .max(20, "닉네임은 20자 이하이어야 합니다.")
            .optional(),

        /**
         * ⭐️ (추가)
         * 프로필 이미지에 대한 액션 (선택 사항)
         * 'delete': 이미지 삭제 (null로 설정)
         * 'use_kakao': 카카오 프로필 이미지로 설정
         */
        profileAction: z.enum(["delete", "use_kakao"]).optional(),
    })
    .strict(); // ⭐️ strict()를 사용하여 nickname, profileAction 외의 필드는 거부
