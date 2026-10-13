import Order from "../models/order.js";
import Product from "../models/product.js";

// POST /api/orders 
export const createOrder = async (req, res) => {
  try {
    const { items } = req.body; 

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Cart cannot be empty." });
    }

    const orderItems = [];
    let subTotal = 0;
    let vendorId = null;

    // Validate items, authoritative price check, and stock check
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return res.status(400).json({ message: `Product not found or inactive: ${item.productId}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product: ${product.name}. Available: ${product.stock}`,
        });
      }

      if (!vendorId) {
        vendorId = product.vendor;
      }

      const itemTotal = product.price * item.quantity;
      subTotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: item.quantity,
        total: itemTotal,
      });

      product.stock -= item.quantity;
      await product.save();
    }

    const totalAmount = subTotal; 

    const order = await Order.create({
      customer: req.user.id,
      vendor: vendorId,
      items: orderItems,
      subTotal,
      totalAmount,
      status: "Pending",
    });

    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    res.status(500).json({ message: "Failed to place order", error: error.message });
  }
};

// GET /api/orders/my-orders 
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user.id })
      .sort({ createdAt: -1 })
      .populate("vendor", "email");
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
};

// GET /api/orders/vendor-orders
export const getVendorOrders = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { vendor: req.user.id };
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("customer", "email");
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch vendor orders", error: error.message });
  }
};

// PATCH /api/orders/:id/status 
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid order status." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Role check: Admin or assigned vendor
    if (req.user.role !== "admin" && order.vendor.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this order." });
    }

    // If cancelled, restore stock once
    if (status === "Cancelled" && order.status !== "Cancelled") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        });
      }
    }

    order.status = status;
    await order.save();

    res.status(200).json({ message: `Order status updated to ${status}`, order });
  } catch (error) {
    res.status(500).json({ message: "Failed to update order status", error: error.message });
  }
};
