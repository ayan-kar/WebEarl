====================================================================
INVENTORY & ORDER MANAGEMENT PLATFORM — API DOCUMENTATION
====================================================================
Written by : Ayan
Project    : MERN Stack Assignment (Inventory & Order Management)
Backend    : Node.js + Express + MongoDB (Mongoose) + JWT
Base URL   : http://localhost:5000
Note       : This document describes what is ACTUALLY implemented
             in the backend. Known gaps are listed at the end.

--------------------------------------------------------------------
TABLE OF CONTENTS
--------------------------------------------------------------------
1.  Overview
2.  Authentication (how it works)
3.  Roles
4.  Endpoints — Health
5.  Endpoints — Auth
6.  Endpoints — Products
7.  Endpoints — Orders
8.  Data Models (fields stored in the database)
9.  HTTP Status Codes used
10. Known Limitations / Not Yet Implemented

====================================================================
1. OVERVIEW
====================================================================
This is the backend API for a multi-vendor inventory and order
management system. Vendors create products, customers browse and
order them, and vendors/admins manage the order lifecycle.

The backend is organized as:
  - server.js          → app entry point, MongoDB connection,
                         health check, centralized error handler
  - routes/            → URL routing (authRoutes, productRoutes,
                         orderRoutes)
  - controllers/       → request logic (authController,
                         productController, orderController)
  - models/            → Mongoose schemas (user, product, order)
  - middleware/auth.js → JWT authentication + role authorization
  - seed.js            → sample data script

All JSON request/response bodies. All protected endpoints require a
JWT token sent in the header:

  Authorization: Bearer <token>

====================================================================
2. AUTHENTICATION (HOW IT WORKS)
====================================================================
- Passwords are hashed with bcrypt (salt rounds = 10) before saving.
- On login, the server signs a JWT containing the user's id, role
  and email. The token expires after 1 day.
- The `authenticate` middleware verifies the token on every
  protected request and attaches the decoded user to req.user.
- The `authorize(...roles)` middleware then checks that the user's
  role is allowed to access that endpoint (returns 403 otherwise).
- All permission checks are done on the BACKEND — the frontend
  cannot bypass them.

====================================================================
3. ROLES
====================================================================
admin    → full access, can manage any product/order
vendor   → can create/manage OWN products, see and update orders
           assigned to them
customer → can browse products, place orders, view own order history

====================================================================
4. ENDPOINTS — HEALTH
====================================================================
GET /api/health            (Public)
  Purpose : Check that the server is running.
  Response:
    200 → { "status": "ok", "message": "Server is healthy and running" }

====================================================================
5. ENDPOINTS — AUTH
====================================================================
POST /api/auth/register    (Public)
  Purpose : Create a new user account.
  Body    : { "email": "you@mail.com", "password": "secret", "role": "vendor" }
            - email and password are required
            - role is optional; must be one of "admin" | "vendor" |
              "customer". Anything invalid/missing defaults to "customer".
  Success : 201 → { "message": "User registered successfully." ,
                    "user": { "id", "email", "role" } }
  Errors  : 400 → email or password missing
            400 → an account with this email already exists
  Note    : Password is stored ONLY as a bcrypt hash — never as plain
            text. Email is normalized to lowercase.

POST /api/auth/login       (Public)
  Purpose : Log in and receive a JWT token.
  Body    : { "email": "you@mail.com", "password": "secret" }
  Success : 200 → { "message": "Login successful.",
                    "token": "<JWT token>",
                    "user": { "id", "email", "role" } }
  Errors  : 400 → email or password missing
            401 → invalid email or password
  Note    : Use the returned token in the Authorization header for
            every protected endpoint. Token expires in 1 day.

====================================================================
6. ENDPOINTS — PRODUCTS
====================================================================
GET /api/products          (Public)
  Purpose : Browse the product catalog with search, filter, sort and
            pagination. Only ACTIVE products are returned.
  Query params (all optional):
    search    → matches product NAME or SKU (case-insensitive)
    category  → exact category match
    minPrice  → price >= value
    maxPrice  → price <= value
    sort      → "price_asc" | "price_desc" | "stock"
                (default: newest first, createdAt desc)
    page      → page number, default 1
    limit     → items per page, default 10
  Example : /api/products?search=mouse&category=Electronics&minPrice=10
            &maxPrice=100&sort=price_asc&page=1&limit=10
  Success : 200 → {
              "total": 42,           // total matching products
              "page": 1,
              "pages": 5,            // total pages
              "products": [ ... ]    // each product includes vendor email
            }
  Note    : Vendor info is populated (only the vendor's email is
            returned, not their whole record).

GET /api/products/:id      (Public)
  Purpose : Get full details of one product.
  Success : 200 → product object (includes vendor email)
  Errors  : 404 → product not found

POST /api/products         (Vendor/Admin only — requires token)
  Purpose : Create a new product. The logged-in vendor becomes the
            product owner automatically.
  Body    : {
              "name": "Wireless Mouse",        // required
              "description": "Ergonomic mouse",// optional
              "sku": "WM-1001",                // required, unique
              "category": "Electronics",       // required
              "price": 25.99,                  // required, >= 0
              "stock": 100                     // required, >= 0
            }
  Success : 201 → { "message": "Product created successfully",
                    "product": { ... } }
  Errors  : 401 → no/invalid token
            403 → logged-in user is not a vendor/admin
            400 → missing required fields
            400 → a product with this SKU already exists (SKUs must
                  be unique across the whole platform)

PUT /api/products/:id      (Vendor/Admin only — requires token)
  Purpose : Update a product (price, stock, name, description,
            category, sku). Vendors can update ONLY their own
            products; admins can update any.
  Body    : any of the product fields you want to change
  Success : 200 → { "message": "Product updated successfully",
                    "product": { ...updated... } }
  Errors  : 404 → product not found
            403 → vendor does not own this product
  Note    : The "vendor" field is stripped from the request body, so
            ownership can never be transferred or forged through this
            endpoint.

DELETE /api/products/:id   (Vendor/Admin only — requires token)
  Purpose : Deactivate a product (SOFT delete — the product stays in
            the database but is marked inactive and no longer appears
            in the public catalog or in new orders).
  Success : 200 → { "message": "Product deactivated successfully" }
  Errors  : 404 → product not found
            403 → vendor does not own this product

====================================================================
7. ENDPOINTS — ORDERS
====================================================================
POST /api/orders           (Customer only — requires token)
  Purpose : Place an order from a shopping cart.
  Body    : {
              "items": [
                { "productId": "<id>", "quantity": 2 },
                { "productId": "<id>", "quantity": 1 }
              ]
            }
  Business rules enforced on the backend:
    - Prices are ALWAYS taken from the database at order time.
      The frontend price is ignored — a customer cannot pay a
      tampered/fake price.
    - Inactive products are rejected.
    - Quantity must be within available stock (rejected otherwise).
    - The order starts with status "Pending".
  Success : 201 → { "message": "Order placed successfully",
                    "order": { ... } }
  Errors  : 400 → empty cart / bad items array
            400 → product missing or inactive
            400 → insufficient stock ("Available: X" is included)
  Note    : Current design supports items from a single vendor per
            order (the first product's vendor is assigned as the
            order's vendor). See Limitations.

GET /api/orders/my-orders  (Customer only — requires token)
  Purpose : The logged-in customer views their OWN order history,
            newest first.
  Success : 200 → [ order objects, each includes vendor email ]

GET /api/orders/vendor-orders  (Vendor/Admin only — requires token)
  Purpose : Vendors see orders routed to them (orders containing
            their products). Admins see ALL orders in the system.
  Success : 200 → [ order objects, each includes customer email ]
  Note    : A vendor can NEVER see another vendor's orders — the
            query is filtered by req.user.id on the server side.

PATCH /api/orders/:id/status   (Vendor/Admin only — requires token)
  Purpose : Move an order through its lifecycle:
            Pending → Confirmed → Processing → Shipped → Delivered
            or set it to "Cancelled".
  Body    : { "status": "Shipped" }
  Allowed values: Pending | Confirmed | Processing | Shipped |
                  Delivered | Cancelled
  Success : 200 → { "message": "Order status updated to Shipped",
                    "order": { ... } }
  Errors  : 400 → status value not in the allowed list
            404 → order not found
            403 → vendor does not own this order
  Stock restore on cancellation:
    - When an order is set to "Cancelled", the stock of every item
      is added back to its product (via an atomic $inc operation).
    - Stock is restored ONLY if the order was not already cancelled
      (the check `order.status !== "Cancelled"` prevents double
      restoration if cancellation is retried).

====================================================================
8. DATA MODELS (DATABASE SCHEMAS)
====================================================================
User
  - email        String, required, unique, stored lowercase
  - passwordHash String, required (bcrypt hash, never plain text)
  - role         String: "admin" | "vendor" | "customer",
                 default "customer"

Product
  - name        String, required
  - description String, optional
  - sku         String, required, unique, trimmed
  - category    String, required
  - price       Number, required, min 0
  - stock       Number, required, min 0  (can never go negative)
  - vendor      ObjectId → User, required (the owning vendor)
  (Mongoose adds createdAt / updatedAt automatically via timestamps)

Order
  - customer    ObjectId → User, required
  - vendor      ObjectId → User, required (vendor the order belongs to)
  - items       Array of:
                  product   ObjectId → Product
                  name      String   (snapshot)
                  sku       String   (snapshot)
                  unitPrice Number   (snapshot, min 0)
                  quantity  Number   (min 1)
                  total     Number   (unitPrice × quantity)
  - subTotal    Number, required, min 0 (sum of item totals)
  - tax         Number, default 0
  - shippingFee Number, default 0
  - totalAmount Number, required, min 0 (currently = subTotal)
  - status      String: Pending | Confirmed | Processing | Shipped
                | Delivered | Cancelled, default "Pending"
  - payment     ObjectId → Payment (placeholder for future payment
                module; not yet implemented)

====================================================================
9. HTTP STATUS CODES USED
====================================================================
200 → request succeeded (GET, PUT, DELETE, PATCH)
201 → resource created (register, create product, place order)
400 → validation error / bad input / business rule rejected
401 → missing, invalid, or expired token (unauthenticated)
403 → authenticated but not allowed (wrong role / not the owner)
404 → product or order not found
500 → unexpected server error (handled by centralized middleware)

====================================================================
10. KNOWN LIMITATIONS / NOT YET IMPLEMENTED
====================================================================
Because of the time limit, the following requirement items from
req.txt are NOT yet done in this version:

1. Payment simulation (Module E) — the Order model has a payment
   placeholder field, but no payment endpoints exist.
2. Dashboard & analytics (Module F) — no aggregation/analytics
   endpoints yet.
3. Order history/activity log (Module D) — status changes update the
   status field but are not yet recorded as a separate log.
4. Strict status transition validation (Module D) — any allowed
   status can be set from any other; forward-only transitions are
   not enforced yet.
5. Idempotency keys for order creation (Module C) — retrying the
   same request can currently create a duplicate order.
6. MongoDB transactions — stock deduction happens per product save
   rather than inside a multi-document transaction.
7. Refresh tokens & logout — only a single access token (1 day) is
   issued; there is no refresh flow or token blacklist.
8. Vendor activation/deactivation by admin (Platform Admin role).
9. Automated tests (Module I) — not yet written.
10. Frontend (Module G) — not yet built.

These are honest gaps relative to the full requirement document and
are listed here for the submission's "Known limitations" section.

====================================================================
END OF DOCUMENT
====================================================================
