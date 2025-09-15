// src/categories/categories.route.ts

import { Router } from "express";
import { handleGetCategories } from "./categories.controller";

const categoriesRouter = Router();

// GET /api/categories
categoriesRouter.get("/", handleGetCategories);

export default categoriesRouter;
