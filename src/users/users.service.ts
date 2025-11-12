import { query } from "../db";
import { UpdateProfileServiceDto, UpdateProfileResulType } from "./users.dto";

/**
 * @desc    (서비스) 내 프로필 정보(닉네임, 이미지)를 DB에 업데이트합니다.
 * @param   {number} userId - 인증된 사용자의 ID
 * @param   {UpdateProfileServiceDto} dto - ⭐️ (변경) 서비스 DTO
 * @returns {Promise<UpdateProfileResulType>} - DB에서 업데이트된 최신 사용자 정보
 */
export const updateMyProfile = async (
    userId: number,
    dto: UpdateProfileServiceDto
): Promise<UpdateProfileResulType> => {
    const { nickname, profileImageUrl, useKakaoProfile } = dto;

    // 1. 동적 쿼리 생성을 위한 준비
    const values: any[] = [userId]; // $1은 항상 userId
    const setClauses: string[] = [];
    let paramIndex = 2; // $2부터 시작

    // 2. 닉네임이 있으면 쿼리에 추가
    if (nickname) {
        setClauses.push(`nickname = $${paramIndex}`);
        values.push(nickname);
        paramIndex++;
    }

    // 3. ⭐️ 프로필 이미지 로직 분기
    if (useKakaoProfile) {
        // 3-1. "카카오 프로필 사용"
        // ⭐️ 서브쿼리를 사용해 kakao_profile_url 값을 가져와서 업데이트
        setClauses.push(
            `profile_image_url = (SELECT kakao_profile_url FROM "users" WHERE id = $1)`
        );
        // (values 배열에 추가할 값은 없음, $1의 userId를 재사용)
    } else if (profileImageUrl !== undefined) {
        // 3-2. "사진 변경" 또는 "삭제" (profileImageUrl이 string 또는 null)
        setClauses.push(`profile_image_url = $${paramIndex}`);
        values.push(profileImageUrl);
        paramIndex++;
    }

    // 4. 쿼리 문자열 조합
    if (setClauses.length === 0) {
        // (컨트롤러에서 이미 검사했지만, 이중 방어)
        const err = new Error("변경할 데이터가 없습니다.");
        (err as any).status = 400;
        throw err;
    }

    const setClause = setClauses.join(", ");

    // 5. DB 업데이트 실행 (RETURNING 절은 동일)
    const sql = `
    UPDATE "users"
    SET ${setClause}
    WHERE id = $1
    RETURNING id, nickname, profile_image_url AS "profileImageUrl", role
  `;

    try {
        const result = await query(sql, values);

        if (result.rows.length === 0) {
            const err = new Error("사용자를 찾을 수 없습니다.");
            (err as any).status = 404;
            throw err;
        }

        // 7. 성공 시, 업데이트된 사용자 정보 반환
        return result.rows[0];
    } catch (error) {
        console.error("🔥🔥🔥 ERROR in updateMyProfile service:", error);
        throw error;
    }
};
