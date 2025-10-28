import { Request, Response, NextFunction } from "express";
import { uploadImage } from "./images.service";

/**
 * 이미지 업로드 요청을 처리하고 결과를 응답합니다.
 */
export const handleUploadImage = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ message: "업로드할 이미지 파일이 없습니다." });
        }

        const imageUrl = await uploadImage(req.file);

        return res.status(201).json({
            message: "이미지 업로드 성공",
            data: {
                imageUrl: imageUrl,
            },
        });
    } catch (error) {
        next(error);
    }
};
