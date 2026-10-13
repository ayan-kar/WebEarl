# Inventory & Order Management Platform — API Documentation

**Written by:** Ayan  
**Project:** MERN Stack Assignment (Inventory & Order Management)  
**Backend:** Node.js + Express + MongoDB (Mongoose) + JWT  
**Base URL:** `http://localhost:5000`  
> **Note:** This document describes what is **actually implemented** in the backend. Known gaps are listed at the end.

---

## Table of Contents
1. [Overview](#1-overview)
2. [Authentication (How It Works)](#2-authentication-how-it-works)
3. [Roles](#3-roles)
4. [Endpoints — Health](#4-endpoints--health)
5. [Endpoints — Auth](#5-endpoints--auth)
6. [Endpoints — Products](#6-endpoints--products)
7. [Endpoints — Orders](#7-endpoints--orders)
8. [Data Models (Database Schemas)](#8-data-models-database-schemas)
9. [HTTP Status Codes Used](#9-http-status-codes-used)
10. [Known Limitations / Not Yet Implemented](#10-known-limitations--not-yet-implemented)

---

## 1. Overview
This is the backend API for a multi-vendor inventory and order management system. Vendors create products, customers browse and order them, and vendors/admins manage the order lifecycle.

### Project Architecture:
- `server.js` → App entry point, MongoDB connection, health check, centralized error handler.
- `routes/` → URL routing (`authRoutes`, `productRoutes`, `orderRoutes`).
- `controllers/` → Request logic (`authController`, `productController`, `orderController`).
- `models/` → Mongoose schemas (`user`, `product`, `order`).
- `middleware/auth.js` → JWT authentication + role authorization.
- `seed.js` → Sample data script.

All communication uses JSON request/response bodies. All protected endpoints require a JWT token sent in the header:
```http
Authorization: Bearer <token>
```

---

## 2. Authentication (How It Works)
- Passwords are hashed with `bcryptjs` (salt rounds = 10) before saving.
- On login, the server signs a JWT containing the user's `id`, `role`, and `email`. The token expires after **1 day**.
- The `authenticate` middleware verifies the token on every protected request and attaches the decoded user to `req.user`.
- The `authorize(...roles)` middleware then checks that the user's role is allowed to access that endpoint (returns `403 Forbidden` otherwise).
- **All permission checks are done on the backend** — the frontend cannot bypass them.

---

## 3. Roles
- `admin` → Full access, can manage any product/order across the platform.
- `vendor` → Can create/manage their **own** products, view and update orders assigned to them.
- `customer` → Can browse products, place orders, and view their own order history.

---

## 4. Endpoints — Health

### `GET /api/health`
- **Access:** Public
- **Purpose:** Check that the server is running.
- **Success Response (`200 OK`):**
```json
{
  "status": "ok",
  "message": "Server is healthy and running"
}
```

---

## 5. Endpoints — Auth

### `POST /api/auth/register`
- **Access:** Public
- **Purpose:** Create a new user account.
- **Request Body:**
```json
{
  "email": "you@mail.com",
  "password": "secret",
  "role": "vendor"
}
```
  - `email` and `password` are required.
  - `role` is optional; must be one of `"admin"` | `"vendor"` | `"customer"`. Anything invalid or missing defaults to `"customer"`.
- **Success Response (`201 Created`):**
```json
{
  "message": "User registered successfully.",
  "user": {
    "id": "670ab1234567890abcdef123",
    "email": "you@mail.com",
    "role": "vendor"
  }
}
```
- **Error Responses:**
  - `400 Bad Request` → Email or password missing.
  - `400 Bad Request` → An account with this email already exists.
- **Note:** Password is stored **only** as a bcrypt hash — never as plain text. Email is normalized to lowercase.

---

### `POST /api/auth/login`
- **Access:** Public
- **Purpose:** Log in and receive a JWT token.
- **Request Body:**
```json
{
  "email": "you@mail.com",
  "password": "secret"
}
```
- **Success Response (`200 OK`):**
```json
{
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "670ab1234567890abcdef123",
    "email": "you@mail.com",
    "role": "vendor"
  }
}
```
- **Error Responses:**
  - `400 Bad Request` → Email or password missing.
  - `401 Unauthorized` → Invalid email or password.
- **Note:** Use the returned token in the `Authorization` header for every protected endpoint. Token expires in 1 day.

---

## 6. Endpoints — Products

### `GET /api/products`
- **Access:** Public
- **Purpose:** Browse the product catalog with search, filter, sort, and pagination. Only **active** products are returned.
- **Query Parameters (all optional):**
  - `search` → Matches product `name` or `sku` (case-insensitive regex).
  - `category` → Exact category match.
  - `minPrice` → Price >= value.
  - `maxPrice` → Price <= value.
  - `sort` → `"price_asc"` | `"price_desc"` | `"stock"` (default: newest first, `createdAt` desc).
  - `page` → Page number (default: `1`).
  - `limit` → Items per page (default: `10`).
- **Example:**
```http
GET /api/products?search=mouse&category=Electronics&minPrice=10&maxPrice=100&sort=price_asc&page=1&limit=10
```
- **Success Response (`200 OK`):**
```json
{
  "total": 42,
  "page": 1,
  "pages": 5,
  "products": [
    {
      "_id": "670ab1234567890abcdef456",
      "name": "Wireless Mouse",
      "description": "Ergonomic mouse",
      "sku": "WM-1001",
      "category": "Electronics",
      "price": 25.99,
      "stock": 100,
      "vendor": {
        "_id": "670ab1234567890abcdef123",
        "email": "vendor@example.com"
      },
      "isActive": true
    }
  ]
}
```
- **Note:** Vendor info is populated (only the vendor's email is returned, not their full user record).

---

### `GET /api/products/:id`
- **Access:** Public
- **Purpose:** Get full details of one single product.
- **Success Response (`200 OK`):** Product object with populated vendor email.
- **Error Response (`404 Not Found`):** Product not found.

---

### `POST /api/products`
- **Access:** Vendor / Admin only (Requires Bearer Token)
- **Purpose:** Create a new product. The logged-in vendor becomes the product owner automatically.
- **Request Body:**
```json
{
  "name": "Wireless Mouse",
  "description": "Ergonomic mouse",
  "sku": "WM-1001",
  "category": "Electronics",
  "price": 25.99,
  "stock": 100
}
```
- **Success Response (`201 Created`):**
```json
{
  "message": "Product created successfully",
  "product": { ... }
}
```
- **Error Responses:**
  - `401 Unauthorized` → No or invalid token.
  - `403 Forbidden` → User is not a vendor or admin.
  - `400 Bad Request` → Missing required fields.
  - `400 Bad Request` → A product with this SKU already exists (SKUs must be unique).

---

### `PUT /api/products/:id`
- **Access:** Vendor / Admin only (Requires Bearer Token)
- **Purpose:** Update a product (`price`, `stock`, `name`, `description`, `category`, `sku`). Vendors can update **only their own** products; admins can update any product.
- **Request Body:** Any of the fields you want to update.
- **Success Response (`200 OK`):**
```json
{
  "message": "Product updated successfully",
  "product": { ... }
}
```
- **Error Responses:**
  - `404 Not Found` → Product not found.
  - `403 Forbidden` → Vendor does not own this product.
- **Note:** The `vendor` field is stripped from updates, preventing ownership hijacking.

---

### `DELETE /api/products/:id`
- **Access:** Vendor / Admin only (Requires Bearer Token)
- **Purpose:** Deactivate a product (**soft delete** — the product stays in the database but `isActive` is set to `false`, removing it from the public catalog and new orders).
- **Success Response (`200 OK`):**
```json
{
  "message": "Product deactivated successfully"
}
```
- **Error Responses:**
  - `404 Not Found` → Product not found.
  - `403 Forbidden` → Vendor does not own this product.

---

## 7. Endpoints — Orders

### `POST /api/orders`
- **Access:** Customer only (Requires Bearer Token)
- **Purpose:** Place an order from a shopping cart.
- **Request Body:**
```json
{
  "items": [
    { "productId": "670ab1234567890abcdef456", "quantity": 2 },
    { "productId": "670ab1234567890abcdef789", "quantity": 1 }
  ]
}
```
- **Business Rules Enforced on Backend:**
  - **Authoritative Pricing:** Prices are **always** taken from the database at order time. Frontend prices are ignored to prevent tampering.
  - **Active State Check:** Inactive products are rejected.
  - **Stock Check:** Quantity must be within available stock.
  - **Stock Deduction:** Available stock is decremented immediately upon order placement.
  - **Initial Status:** The order starts with status `"Pending"`.
- **Success Response (`201 Created`):**
```json
{
  "message": "Order placed successfully",
  "order": { ... }
}
```
- **Error Responses:**
  - `400 Bad Request` → Empty cart or invalid items array.
  - `400 Bad Request` → Product not found or inactive.
  - `400 Bad Request` → Insufficient stock (`"Available: X"` is included).
- **Note:** Current design assigns the first product's vendor as the order's vendor (single-vendor orders).

---

### `GET /api/orders/my-orders`
- **Access:** Customer only (Requires Bearer Token)
- **Purpose:** The logged-in customer views their **own** order history, sorted newest first.
- **Success Response (`200 OK`):** Array of order objects, each including the vendor's email.

---

### `GET /api/orders/vendor-orders`
- **Access:** Vendor / Admin only (Requires Bearer Token)
- **Purpose:** 
  - **Vendors** see incoming orders routed to them (orders containing their products).
  - **Admins** see all orders in the entire system.
- **Success Response (`200 OK`):** Array of order objects, each including customer email.
- **Note:** A vendor can **never** see another vendor's orders — filtered strictly by `req.user.id`.

---

### `PATCH /api/orders/:id/status`
- **Access:** Vendor / Admin only (Requires Bearer Token)
- **Purpose:** Move an order through its lifecycle:
  `Pending` → `Confirmed` → `Processing` → `Shipped` → `Delivered` or set it to `Cancelled`.
- **Request Body:**
```json
{
  "status": "Shipped"
}
```
- **Allowed Values:** `"Pending"` | `"Confirmed"` | `"Processing"` | `"Shipped"` | `"Delivered"` | `"Cancelled"`
- **Success Response (`200 OK`):**
```json
{
  "message": "Order status updated to Shipped",
  "order": { ... }
}
```
- **Error Responses:**
  - `400 Bad Request` → Status value is not in the allowed list.
  - `404 Not Found` → Order not found.
  - `403 Forbidden` → Vendor does not own this order.
- **Stock Restoration on Cancellation:**
  - When an order is updated to `"Cancelled"`, the stock for every item is added back to its respective product using atomic `$inc`.
  - Stock is restored **only** if the order was not already cancelled (`order.status !== "Cancelled"`), preventing duplicate stock restoration on retries.

---

## 8. Data Models (Database Schemas)

### User
| Field | Type | Details |
| :--- | :--- | :--- |
| `email` | `String` | Required, unique, stored lowercase, trimmed |
| `passwordHash` | `String` | Required (bcrypt hash, never plain text) |
| `role` | `String` | Enum: `"admin"`, `"vendor"`, `"customer"` (default: `"customer"`) |
| `createdAt` / `updatedAt` | `Date` | Managed automatically by Mongoose timestamps |

### Product
| Field | Type | Details |
| :--- | :--- | :--- |
| `name` | `String` | Required |
| `description`| `String` | Optional |
| `sku` | `String` | Required, unique across platform, trimmed |
| `category` | `String` | Required |
| `price` | `Number` | Required, min: 0 |
| `stock` | `Number` | Required, min: 0 |
| `vendor` | `ObjectId` | Ref: `User`, required (owning vendor) |
| `isActive` | `Boolean`| Default: `true` (used for soft deletes) |
| `createdAt` / `updatedAt` | `Date` | Managed automatically by Mongoose timestamps |

### Order
| Field | Type | Details |
| :--- | :--- | :--- |
| `customer` | `ObjectId` | Ref: `User`, required |
| `vendor` | `ObjectId` | Ref: `User`, required (owning vendor) |
| `items` | `Array` | Embedded order items: `product`, `name`, `sku`, `unitPrice` (snapshot), `quantity`, `total` |
| `subTotal` | `Number` | Required, min: 0 (sum of item totals) |
| `tax` | `Number` | Default: 0 |
| `shippingFee`| `Number` | Default: 0 |
| `totalAmount`| `Number` | Required, min: 0 (currently equals `subTotal`) |
| `status` | `String` | Enum: `"Pending"`, `"Confirmed"`, `"Processing"`, `"Shipped"`, `"Delivered"`, `"Cancelled"` (default: `"Pending"`) |
| `payment` | `ObjectId` | Ref: `Payment` (placeholder for future payment module) |
| `createdAt` / `updatedAt` | `Date` | Managed automatically by Mongoose timestamps |

---

## 9. HTTP Status Codes Used

| Code | Meaning | Typical Usage |
| :--- | :--- | :--- |
| `200 OK` | Succeeded | `GET`, `PUT`, `DELETE`, `PATCH` operations |
| `201 Created` | Resource Created | `POST /register`, `POST /products`, `POST /orders` |
| `400 Bad Request` | Validation Error | Missing fields, bad format, business rule rejection, duplicate SKU |
| `401 Unauthorized` | Unauthenticated | Missing, invalid, or expired JWT token |
| `403 Forbidden` | Access Denied | Authenticated user lacks permission (wrong role / not owner) |
| `404 Not Found` | Not Found | Target product or order doesn't exist |
| `500 Server Error` | Server Exception | Centralized error handler catches unhandled exceptions |

---

## 10. Known Limitations / Not Yet Implemented

Because of the 3-hour time constraint, the following items from `req.txt` are **not** implemented in this version:

1. **Payment Simulation (Module E):** The `Order` model includes a payment placeholder, but simulated payment endpoints do not exist yet.
2. **Dashboard & Analytics (Module F):** No aggregation endpoints for admin/vendor dashboards yet.
3. **Order Activity Log (Module D):** Status changes modify the `status` field directly without saving a separate audit log collection.
4. **Strict Status Transitions (Module D):** Forward-only state transitions are not strictly locked down (any allowed status can be set from another).
5. **Idempotency Keys (Module C):** Duplicate order prevention on network retry is not yet implemented.
6. **MongoDB Multi-Document Transactions:** Stock deduction uses sequential model updates rather than an atomic session transaction.
7. **Refresh Tokens & Session Invalidation:** Only a single 1-day access token is used; no refresh token rotation or blacklist exists.
8. **Vendor Activation/Deactivation by Admin:** Admin management endpoints for toggling vendor statuses are not implemented.
9. **Automated Tests (Module I):** Jest/Supertest automated tests are not yet included.
10. **Frontend (Module G):** No UI screens built.
