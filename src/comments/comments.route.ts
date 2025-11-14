import { Router } from "express";
import { attachUserMiddleware, authMiddleware } from "../auth/auth.middleware";
import {
    handleCreateComments,
    handleDeleteComments,
    handleGetComments,
    handleUpdateComments,
} from "./comments.controller";
import { isCommentOwner } from "../auth/isOwner.middleware";

const commentsRouter = Router();

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
