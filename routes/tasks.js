import express from "express";
// ✅ FIX: Use the named export { protect }
import { protect } from "../middleware/auth.js"; 

import {
  getTasks,
  createTask,
  updateTask,
  deleteTask
} from "../controllers/taskController.js";

const router = express.Router();

// ✅ FIX: Use 'protect' instead of 'auth'
router.use(protect);

router.get("/", getTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;