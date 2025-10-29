import { Router } from "express";
import multer from "multer";
// 수정된 컨트롤러 함수를 가져옵니다.
import { handleUploadImage } from "./images.controller";
import { authMiddleware } from "../auth/auth.middleware";

const imagesRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("이미지 파일 형식만 업로드 가능합니다."));
        }
    },
});

// 클래스 인스턴스 대신 직접 함수를 연결합니다.
imagesRouter.post(
    "/",
    authMiddleware,
    upload.single("image"),
    handleUploadImage
);

export default imagesRouter;
