import express from "express";
import {searchController} from "../controllers/searchController";

const router = express.Router();

router.post("/api/v2/search", searchController);

export default router;

// 1. ROUTE