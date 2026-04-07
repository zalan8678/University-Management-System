import express from "express";
import { validateSearch } from "../middleware/validateSearch";
import { searchController } from "../controllers/searchController";

const router = express.Router();

router.post("/api/v2/search", validateSearch, searchController);

export default router;

// 1. ROUTE
