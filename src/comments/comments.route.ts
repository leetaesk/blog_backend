import { Router } from "express";
import { attachUserMiddleware, authMiddleware } from "../auth/auth.middleware";
import {
    handleCreateComments,
    handleDeleteComments,
    handleGetComments,
    handleGetCommentsCreatedByMe,
    handleUpdateComments,
} from "./comments.controller";
import { isCommentOwner } from "../auth/isOwner.middleware";

const commentsRouter = Router();

// 얘를 위에 둬야 me를 postId로 인식을 안한다... ㅈㄴ신기하네
commentsRouter.get("/me", authMiddleware, handleGetCommentsCreatedByMe);

commentsRouter.get("/:postId", attachUserMiddleware, handleGetComments);

commentsRouter.post("/", authMiddleware, handleCreateComments);

commentsRouter.patch(
    "/:commentId",
    authMiddleware,
    isCommentOwner,
    handleUpdateComments
);
commentsRouter.delete(
    "/:commentId",
    authMiddleware,
    isCommentOwner,
    handleDeleteComments
);

export default commentsRouter;
