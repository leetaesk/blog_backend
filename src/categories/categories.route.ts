// src/categories/categories.route.ts

import { Router } from "express";
import {
    handleCreateCategory,
    handleGetCategories,
} from "./categories.controller";
import { authMiddleware, isAdminMiddleware } from "../auth/auth.middleware";

const categoriesRouter = Router();

categoriesRouter.get("/", handleGetCategories);
categoriesRouter.post(
    "/",
    authMiddleware,
    isAdminMiddleware,
    handleCreateCategory
);

export default categoriesRouter;
