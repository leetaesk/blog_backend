import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { handleToggleLikes } from "./likes.controller";

const likesRouter = Router();

likesRouter.post("/:postId", authMiddleware, handleToggleLikes);

export default likesRouter;
