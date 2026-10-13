import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/:id", getProductById);

// Vendor & Admin 
router.post("/", authenticate, authorize("vendor", "admin"), createProduct);
router.put("/:id", authenticate, authorize("vendor", "admin"), updateProduct);
router.delete("/:id", authenticate, authorize("vendor", "admin"), deleteProduct);

export default router;
