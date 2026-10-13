import Product from "../models/product.js";

// GET /api/products (Public: Browse, search, filter, sort)
export const getProducts = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort, page = 1, limit = 10 } = req.query;

    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    if (sort === "price_desc") sortOption = { price: -1 };
    if (sort === "stock") sortOption = { stock: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("vendor", "email")
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    res.status(200).json({
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      products,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error: error.message });
  }
};

// GET /api/products/:id (Public: Get single product details)
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("vendor", "email");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Error fetching product", error: error.message });
  }
};

// POST /api/products (Vendor only: Create product)
export const createProduct = async (req, res) => {
  try {
    const { name, description, sku, category, price, stock } = req.body;

    if (!name || !sku || !category || price == null || stock == null) {
      return res.status(400).json({ message: "Please provide all required product fields." });
    }

    // Check SKU uniqueness
    const existingSku = await Product.findOne({ sku: sku.trim() });
    if (existingSku) {
      return res.status(400).json({ message: "Product with this SKU already exists." });
    }

    const product = await Product.create({
      name,
      description,
      sku: sku.trim(),
      category,
      price: Number(price),
      stock: Number(stock),
      vendor: req.user.id, // Auth middleware sets req.user
      isActive: true,
    });

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Failed to create product", error: error.message });
  }
};

// PUT /api/products/:id (Vendor only: Update own product)
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Only product owner (or admin) can update
    if (req.user.role !== "admin" && product.vendor.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to update this product." });
    }

    const updates = req.body;
    // Don't allow changing vendor directly
    delete updates.vendor;

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: "Failed to update product", error: error.message });
  }
};

// DELETE /api/products/:id (Vendor/Admin: Soft delete or deactivate)
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (req.user.role !== "admin" && product.vendor.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to delete this product." });
    }

    product.isActive = false;
    await product.save();

    res.status(200).json({ message: "Product deactivated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
};
