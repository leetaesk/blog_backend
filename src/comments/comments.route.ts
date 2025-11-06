import { Router } from "express";
import { attachUserMiddleware, authMiddleware } from "../auth/auth.middleware";
import { handleGetComments } from "./comments.controller";

const commentsRouter = Router();

commentsRouter.get("/:postId", attachUserMiddleware, handleGetComments);

export default commentsRouter;
