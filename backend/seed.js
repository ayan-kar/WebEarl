import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/user.js";
import Product from "./models/product.js";
import Order from "./models/order.js";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/inventory_db";

const seedDatabase = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    //  Clear existing data
    console.log("Clearing old data...");
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

   
    const passwordHash = await bcrypt.hash("password123", 10);

    // Admin
    console.log("Creating users...");
    const admin = await User.create({
      email: "admin@example.com",
      passwordHash,
      role: "admin",
    });
    // 2 Vendors
    const vendor1 = await User.create({
      email: "techvendor@example.com",
      passwordHash,
      role: "vendor",
    });

    const vendor2 = await User.create({
      email: "homevendor@example.com",
      passwordHash,
      role: "vendor",
    });
    // Customer
    const customer = await User.create({
      email: "customer@example.com",
      passwordHash,
      role: "customer",
    });

    console.log("Creating products...");
    const products = await Product.create([
      // Vendor 1 - Tech Products
      {
        name: "Keyboard",
        description: "keyboard",
        sku: uuidv4(),
        category: "Electronics",
        price: 89.99,
        stock: 25,
        vendor: vendor1._id,
        isActive: true,
      },
      {
        name: "Gaming Mouse",
        description: "Gaming Mouse",
        sku: uuidv4(),
        category: "Electronics",
        price: 49.99,
        stock: 50,
        vendor: vendor1._id,
        isActive: true,
      },
      {
        name: "Headphones",
        description: "Headphones",
        sku: uuidv4(),
        category: "Electronics",
        price: 199.99,
        stock: 12,
        vendor: vendor1._id,
        isActive: true,
      },
      
      // Vendor 2 - Home & Office Products
      {
        name: " Office Chair",
        description: " Office Chair",
        sku: uuidv4(),
        category: "Furniture",
        price: 149.00,
        stock: 15,
        vendor: vendor2._id,
        isActive: true,
      },
      {
        name: "Standing Desk",
        description: "Standing Desk",
        sku: uuidv4(),
        category: "Furniture",
        price: 320.00,
        stock: 8,
        vendor: vendor2._id,
        isActive: true,
      },
      {
        name: "LED",
        description: "lamp",
        sku: uuidv4(),
        category: "Home Office",
        price: 29.99,
        stock: 35,
        vendor: vendor2._id,
        isActive: true,
      },
    ]);

    // sample initial order
    console.log("Creating order");
    const sampleItem = products[0]; // Keyboard
    await Order.create({
      customer: customer._id,
      vendor: vendor1._id,
      items: [
        {
          product: sampleItem._id,
          name: sampleItem.name,
          sku: sampleItem.sku,
          unitPrice: sampleItem.price,
          quantity: 1,
          total: sampleItem.price,
        },
      ],
      subTotal: sampleItem.price,
      totalAmount: sampleItem.price,
      status: "Confirmed",
    });
    console.log("Database seeded");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
