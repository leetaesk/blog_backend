import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { UpdateProfileRequestDto, UpdateProfileServiceDto } from "./users.dto";
import { updateProfileSchema } from "./users.schema";
import { updateMyProfile } from "./users.service";
// ⭐️ (추가) 이미지 업로드 서비스 import
import { uploadImage } from "../images/images.service";

/**
 * @desc    내 프로필 정보(닉네임, 이미지) 수정 컨트롤러
 * @route   PATCH /api/users/me
 * @access  Private (authMiddleware 필요)
 * ⭐️ (변경) multipart/form-data를 처리합니다.
 */
export const updateMyProfileController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1. 인증된 사용자 ID 확인
        const userId = req.user?.userId;
        if (!userId) {
            const err = new Error("인증 정보가 없습니다.");
            (err as any).status = 401;
            throw err;
        }

        // 2. 요청 바디(body) 유효성 검사 (Zod)
        // ⭐️ req.body는 이제 multipart의 텍스트 필드입니다.
        const body = updateProfileSchema.parse(
            req.body
        ) as UpdateProfileRequestDto;

        // 3. ⭐️ 서비스에 전달할 DTO 생성
        const serviceDto: UpdateProfileServiceDto = {
            nickname: body.nickname,
        };

        // 4. ⭐️ 분기 처리: req.file 또는 req.body.profileAction
        const file = req.file;
        const profileAction = body.profileAction;

        if (file) {
            // 4-1. "사진 변경": 파일이 있으면 S3에 업로드 후 URL을 DTO에 추가
            const imageUrl = await uploadImage(file);
            serviceDto.profileImageUrl = imageUrl;
        } else if (profileAction === "delete") {
            // 4-2. "삭제": profileAction이 'delete'이면 DTO에 null 추가
            serviceDto.profileImageUrl = null;
        } else if (profileAction === "use_kakao") {
            // 4-3. "카카오 프로필 사용": DTO에 useKakaoProfile 플래그 설정
            serviceDto.useKakaoProfile = true;
        }

        // 5. (선택적) 변경 사항이 있는지 확인
        if (
            !serviceDto.nickname &&
            !serviceDto.profileImageUrl &&
            !serviceDto.useKakaoProfile &&
            !file
        ) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "변경할 데이터가 없습니다.",
            });
        }

        // 6. 서비스 레이어 호출
        const updatedUser = await updateMyProfile(userId, serviceDto);

        // 7. 성공 응답 반환
        return res.status(200).json({
            isSuccess: true,
            code: "SUCCESS",
            message: "프로필이 성공적으로 업데이트되었습니다.",
            result: updatedUser,
        });
    } catch (error) {
        // 8. 에러 핸들링 (기존과 동일)
        if (error instanceof ZodError) {
            return res.status(400).json({
                isSuccess: false,
                code: "BAD_REQUEST",
                message: "입력값이 유효하지 않습니다.",
                errors: error.flatten().fieldErrors,
            });
        }
        next(error);
    }
};
