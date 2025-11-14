import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
    handleCommentToggleLikes,
    handleToggleLikes,
} from "./likes.controller";

const likesRouter = Router();

likesRouter.post("/post/:postId", authMiddleware, handleToggleLikes);
likesRouter.post(
    "/comment/:commentId",
    authMiddleware,
    handleCommentToggleLikes
);

export default likesRouter;
