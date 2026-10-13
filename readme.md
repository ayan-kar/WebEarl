Overview
This is the backend API for a multi-vendor inventory and order management system. Vendors create products, customers browse and order them, and vendors/admins manage the order lifecycle.

Architecture
The backend is organized as:

server.js → app entry point, MongoDB connection, health check, centralized error handler
routes/ → URL routing (authRoutes, productRoutes, orderRoutes)
controllers/ → request logic (authController, productController, orderController)
models/ → Mongoose schemas (user, product, order)
middleware/auth.js → JWT authentication + role authorization
seed.js → sample data script
General Rules
All JSON request/response bodies
All protected endpoints require a JWT token sent in the header:


Authorization: Bearer <token>
Authentication (How it Works)
Passwords are hashed with bcrypt (salt rounds = 10) before saving
On login, the server signs a JWT containing the user's id, role, and email. The token expires after 1 day
The authenticate middleware verifies the token on every protected request and attaches the decoded user to req.user
The authorize(...roles) middleware then checks that the user's role is allowed to access that endpoint (returns 403 otherwise)
All permission checks are done on the BACKEND — the frontend cannot bypass them
Roles
Role	Permissions
admin	Full access; can manage any product/order
vendor	Can create/manage OWN products; see and update orders assigned to them
customer	Can browse products; place orders; view own order history
Endpoints — Health
GET /api/health
Public

Purpose: Check that the server is running.

Response:



200 → { "status": "ok", "message": "Server is healthy and running" }
Endpoints — Auth
POST /api/auth/register
Public

Purpose: Create a new user account.

Body:

json


{
  "email": "you@mail.com",
  "password": "secret",
  "role": "vendor"
}
Field Rules:

email and password are required
role is optional; must be one of "admin" | "vendor" | "customer". Anything invalid/missing defaults to "customer"
Success:



201 → {
  "message": "User registered successfully.",
  "user": {
    "id": "...",
    "email": "...",
    "role": "..."
  }
}
Errors:

400 → email or password missing
400 → an account with this email already exists
Notes:

Password is stored ONLY as a bcrypt hash — never as plain text
Email is normalized to lowercase
POST /api/auth/login
Public

Purpose: Log in and receive a JWT token.

Body:

json


{
  "email": "you@mail.com",
  "password": "secret"
}
Success:



200 → {
  "message": "Login successful.",
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "...",
    "role": "..."
  }
}
Errors:

400 → email or password missing
401 → invalid email or password
Notes:

Use the returned token in the Authorization header for every protected endpoint
Token expires in 1 day
Endpoints — Products
GET /api/products
Public

Purpose: Browse the product catalog with search, filter, sort, and pagination. Only ACTIVE products are returned.

Query Parameters (all optional):

Parameter	Type	Description
search	String	Matches product NAME or SKU (case-insensitive)
category	String	Exact category match
minPrice	Number	Price >= value
maxPrice	Number	Price <= value
sort	String	"price_asc" | "price_desc" | "stock" (default: newest first, createdAt desc)
page	Number	Page number, default 1
limit	Number	Items per page, default 10
Example Request:



/api/products?search=mouse&category=Electronics&minPrice=10&maxPrice=100&sort=price_asc&page=1&limit=10
Success:



200 → {
  "total": 42,           // total matching products
  "page": 1,
  "pages": 5,            // total pages
  "products": [ ... ]    // each product includes vendor email
}
Notes:

Vendor info is populated (only the vendor's email is returned, not their whole record)
GET /api/products/:id
Public

Purpose: Get full details of one product.

Success:



200 → product object (includes vendor email)
Errors:

404 → product not found
POST /api/products
Vendor/Admin only — requires token

Purpose: Create a new product. The logged-in vendor becomes the product owner automatically.

Body:

json


{
  "name": "Wireless Mouse",        // required
  "description": "Ergonomic mouse",// optional
  "sku": "WM-1001",                // required, unique
  "category": "Electronics",        // required
  "price": 25.99,                  // required, >= 0
  "stock": 100                     // required, >= 0
}
Success:



201 → {
  "message": "Product created successfully",
  "product": { ... }
}
Errors:

401 → no/invalid token
403 → logged-in user is not a vendor/admin
400 → missing required fields
400 → a product with this SKU already exists (SKUs must be unique across the whole platform)
PUT /api/products/:id
Vendor/Admin only — requires token

Purpose: Update a product (price, stock, name, description, category, sku). Vendors can update ONLY their own products; admins can update any.

Body:

json


{
  // any of the product fields you want to change
}
Success:



200 → {
  "message": "Product updated successfully",
  "product": { ...updated... }
}
Errors:

404 → product not found
403 → vendor does not own this product
Notes:

The "vendor" field is stripped from the request body, so ownership can never be transferred or forged through this endpoint
DELETE /api/products/:id
Vendor/Admin only — requires token

Purpose: Deactivate a product (SOFT delete — the product stays in the database but is marked inactive and no longer appears in the public catalog or in new orders).

Success:



200 → { "message": "Product deactivated successfully" }
Errors:

404 → product not found
403 → vendor does not own this product
Endpoints — Orders
POST /api/orders
Customer only — requires token

Purpose: Place an order from a shopping cart.

Body:

json


{
  "items": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "quantity": 2
    },
    {
      "productId": "507f1f77bcf86cd799439012",
      "quantity": 1
    }
  ]
}
Business Rules Enforced on the Backend:

Prices are ALWAYS taken from the database at order time. The frontend price is ignored — a customer cannot pay a tampered/fake price
Inactive products are rejected
Quantity must be within available stock (rejected otherwise)
The order starts with status "Pending"
Success:



201 → {
  "message": "Order placed successfully",
  "order": { ... }
}
Errors:

400 → empty cart / bad items array
400 → product missing or inactive
400 → insufficient stock ("Available: X" is included)
Notes:

Current design supports items from a single vendor per order (the first product's vendor is assigned as the order's vendor). See Limitations
GET /api/orders/my-orders
Customer only — requires token

Purpose: The logged-in customer views their OWN order history, newest first.

Success:



200 → [ order objects, each includes vendor email ]
GET /api/orders/vendor-orders
Vendor/Admin only — requires token

Purpose: Vendors see orders routed to them (orders containing their products). Admins see ALL orders in the system.

Success:



200 → [ order objects, each includes customer email ]
Notes:

A vendor can NEVER see another vendor's orders — the query is filtered by req.user.id on the server side
PATCH /api/orders/:id/status
Vendor/Admin only — requires token

Purpose: Move an order through its lifecycle: Pending → Confirmed → Processing → Shipped → Delivered or set it to "Cancelled".

Body:

json


{
  "status": "Shipped"
}
Allowed Values:

Pending
Confirmed
`Processing
Shipped
Delivered
Cancelled
Success:



200 → {
  "message": "Order status updated to Shipped",
  "order": { ... }
}
Errors:

400 → status value not in the allowed list
404 → order not found
403 → vendor does not own this order
Stock Restoration on Cancellation:

When an order is set to "Cancelled", the stock of every item is added back to its product (via an atomic $inc operation)
Stock is restored ONLY if the order was not already cancelled (the check order.status !== "Cancelled" prevents double restoration if cancellation is retried)
Data Models (Database Schemas)
User
Field	Type	Notes
email	String	Required, unique, stored lowercase
passwordHash	String	Required (bcrypt hash, never plain text)
role	String	"admin" | "vendor" | "customer", default "customer"
Product
Field	Type	Notes
name	String	Required
description	String	Optional
sku	String	Required, unique, trimmed
category	String	Required
price	Number	Required, min 0
stock	Number	Required, min 0 (can never go negative)
vendor	ObjectId → User	Required (the owning vendor)
createdAt	Date	Added automatically by Mongoose timestamps
updatedAt	Date	Added automatically by Mongoose timestamps
Order
Field	Type	Notes
customer	ObjectId → User	Required
vendor	ObjectId → User	Required (vendor the order belongs to)
items	Array	Array of item objects (see below)
subTotal	Number	Required, min 0 (sum of item totals)
tax	Number	Default 0
shippingFee	Number	Default 0
totalAmount	Number	Required, min 0 (currently = subTotal)
status	String	Pending | Confirmed | Processing | Shipped | Delivered | Cancelled, default "Pending"
payment	ObjectId → Payment	Placeholder for future payment module; not yet implemented
Order Item (nested in items array)
Field	Type	Notes
product	ObjectId → Product	Reference to the product
name	String	Snapshot of product name
sku	String	Snapshot of product SKU
unitPrice	Number	Snapshot, min 0
quantity	Number	Min 1
total	Number	unitPrice × quantity
HTTP Status Codes Used
Code	Meaning
200	Request succeeded (GET, PUT, DELETE, PATCH)
201	Resource created (register, create product, place order)
400	Validation error / bad input / business rule rejected
401	Missing, invalid, or expired token (unauthenticated)
403	Authenticated but not allowed (wrong role / not the owner)
404	Product or order not found
500	Unexpected server error (handled by centralized middleware)
Known Limitations / Not Yet Implemented
Because of the time limit, the following requirement items are NOT yet done in this version:

Payment simulation (Module E) — the Order model has a payment placeholder field, but no payment endpoints exist
Dashboard & analytics (Module F) — no aggregation/analytics endpoints yet
Order history/activity log (Module D) — status changes update the status field but are not yet recorded as a separate log
Strict status transition validation (Module D) — any allowed status can be set from any other; forward-only transitions are not enforced yet
Idempotency keys for order creation (Module C) — retrying the same request can currently create a duplicate order
MongoDB transactions — stock deduction happens per product save rather than inside a multi-document transaction
Refresh tokens & logout — only a single access token (1 day) is issued; there is no refresh flow or token blacklist
Vendor activation/deactivation by admin (Platform Admin role)
Automated tests (Module I) — not yet written
Frontend (Module G) — not yet built
These are honest gaps relative to the full requirement document and are listed here for the submission's "Known limitations" section.
