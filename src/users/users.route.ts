import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { updateMyProfileController } from "./users.controller";
import multer from "multer";

const usersRouter = Router();

// ⭐️ S3 업로드를 위한 multer 설정 (images.router.ts에서 가져옴)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("이미지 파일 형식만 업로드 가능합니다."));
        }
    },
});

// ⭐️ PATCH /me 라우트에 upload.single('image') 미들웨어 적용
usersRouter.patch(
    "/me",
    authMiddleware,
    upload.single("image"), // 'image'라는 필드명으로 파일을 받음
    updateMyProfileController
);

export default usersRouter;
