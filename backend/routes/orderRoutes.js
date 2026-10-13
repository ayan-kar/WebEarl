import express from "express";
import {
  createOrder,
  getMyOrders,
  getVendorOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Customer creates and views own orders
router.post("/", authenticate, authorize("customer"), createOrder);
router.get("/my-orders", authenticate, authorize("customer"), getMyOrders);

// Vendor & Admin view and manage incoming orders
router.get("/vendor-orders", authenticate, authorize("vendor", "admin"), getVendorOrders);
router.patch("/:id/status", authenticate, authorize("vendor", "admin"), updateOrderStatus);

export default router;
