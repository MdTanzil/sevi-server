# Sevi server

REST API for [Sevi](https://sevi-efc34.web.app/) — a Library Management
System. Express + MongoDB Atlas, with JWT cookie authentication.

**Live API:** https://sevi-server.vercel.app
**Client:** [sevi-client](https://github.com/MdTanzil/sevi-client)

## Features

- Book catalogue: list all books, filter by category, single-book lookup
- Add and update books, including optional metadata (ISBN, publisher,
  published year, language, pages) — librarians and admins only
- Delete books — librarians and admins only; refused while a book has an
  active borrow, and the book's wishlist entries and notifications are
  removed with it
- Borrowing: record borrows (max 3 active borrows per user, return date
  within 5 days), list a user's borrowed books, return books with a kept
  borrow history (quantity tracking). Out-of-stock books cannot be
  borrowed — the server rejects the borrow even if the client check is
  bypassed.
- Wishlist: users save books to a personal wishlist (including out-of-stock
  books) and view it; when a wishlisted book is restocked (quantity goes
  from 0 to above 0, via a stock edit or a return), each user who
  wishlisted it gets an in-app notification (one unread notification per
  book — no duplicates while one is still unread)
- Notifications: in-app notifications (currently restock alerts), listed
  newest first, with mark-one-read and mark-all-read
- User profiles with roles (member, librarian, admin); admins manage users
  and their roles
- Dashboard data for librarians and admins: library-wide stats (books,
  copies, users, borrows, overdue, out of stock), a list of all active
  borrows across users, and category image updates
- JWT authentication: token issued on login, stored in an httpOnly cookie

## Tech stack

Express 4, MongoDB (official Node.js driver), JSON Web Tokens, cookie-parser,
CORS, dotenv.

## Getting started

Prerequisites: Node.js 20+ and npm, plus a MongoDB Atlas cluster.

```bash
npm install
npm start   # listens on PORT (default 5000)
```

### Environment variables

Create a `.env` file in the project root:

| Variable | Description |
| --- | --- |
| `USER` | MongoDB Atlas database username |
| `PASSWORD` | MongoDB Atlas database password |
| `SECRET_KEY` | Secret used to sign JWTs |
| `ADMIN_EMAILS` | Comma-separated emails that become admins automatically on first login (e.g. `owner@example.com,admin@example.com`) |
| `PORT` | Port to listen on (default `5000`) |
| `NODE_ENV` | Set to `production` for secure, cross-site auth cookies |

The server connects to the `booksDB` database (collections: `categories`,
`books`, `borrows`, `users`, `wishlists`, `notifications`). CORS allows `http://localhost:5173` and
`https://sevi-efc34.web.app` with credentials.

## Roles & permissions

Every logged-in user has a profile (auto-created on first access) with one
of three roles. The default role is `member`; emails listed in
`ADMIN_EMAILS` become `admin` automatically. Admins assign the `librarian`
role from the client.

| Action | Member | Librarian | Admin |
| --- | --- | --- | --- |
| Browse books, borrow & return (max 3 at a time), view own history | ✅ | ✅ | ✅ |
| Wishlist (add/view/remove) and restock notifications | ✅ | ✅ | ✅ |
| Edit own profile (name, phone, address, email) | ✅ | ✅ | ✅ |
| Add & update books | ❌ | ✅ | ✅ |
| Delete books (blocked while a book is borrowed) | ❌ | ✅ | ✅ |
| View dashboard stats & all active borrows | ❌ | ✅ | ✅ |
| Update category images | ❌ | ✅ | ✅ |
| List users & change roles | ❌ | ❌ | ✅ |
| Delete borrow records | ❌ | ❌ | ✅ |

## Project structure

```
├── index.js                  # Entry point: connects the DB, starts the server
├── vercel.json               # Vercel deployment config
├── .env.example              # Documented environment variables
└── src/
    ├── app.js                # Express app: middleware + route mounting (no listen)
    ├── config/
    │   └── db.js             # MongoClient setup, dbConnect(), collections
    ├── routes/               # One router per resource, mounted under /api/v1
    │   ├── admin.routes.js
    │   ├── auth.routes.js
    │   ├── books.routes.js
    │   ├── borrows.routes.js
    │   ├── categories.routes.js
    │   ├── notifications.routes.js
    │   ├── users.routes.js
    │   └── wishlist.routes.js
    ├── controllers/          # Route handlers (one file per resource)
    │   ├── admin.controller.js
    │   ├── auth.controller.js
    │   ├── books.controller.js
    │   ├── borrows.controller.js
    │   ├── categories.controller.js
    │   ├── notifications.controller.js
    │   ├── users.controller.js
    │   └── wishlist.controller.js
    ├── middlewares/
    │   ├── verifyToken.js    # JWT cookie verification
    │   └── requireRole.js    # Role gate (reads the caller's users profile)
    └── utils/
        ├── normalizeBook.js  # Book metadata normalization before saving
        ├── restock.js        # quantityOf() + notifyRestock() (wishlist alerts)
        ├── roles.js          # Role constants + ADMIN_EMAILS handling
        └── tokenEmail.js     # Extract the user's email from a decoded JWT
```

## API Reference

Base URL: `https://sevi-server.vercel.app/api/v1`
(locally `http://localhost:5000/api/v1`).

Endpoints marked 🔒 require the JWT cookie issued by `POST /jwt`.
`GET /` returns a plain-text greeting (quick health check).

#### Create a JWT and set the auth cookie

```http
  POST /api/v1/jwt
```

Body: the user object to embed in the token (e.g. `{ "email": "..." }`).
Responds with `{ "success": true }` and sets an httpOnly `token` cookie
(10h expiry).

#### Clear the auth cookie (logout)

```http
  POST /api/v1/logout
```

Clears the `token` cookie. Responds with `{ "success": true }`.

#### Get all categories

```http
  GET /api/v1/categories
```

#### Get books by category

```http
  GET /api/v1/books/:category
```

#### Get a single book

```http
  GET /api/v1/single-book/:id
```

#### Get all books 🔒

```http
  GET /api/v1/books
```

#### Add a book 🔒 (librarian or admin)

```http
  POST /api/v1/books
```

Request body — a book object:

```json
{
  "name": "The Hobbit",
  "author": "J.R.R. Tolkien",
  "quantity": 6,
  "imageUrl": "https://example.com/hobbit.jpg",
  "category": "Fantasy",
  "rating": 8,
  "shortDescription": "Bilbo Baggins joins thirteen dwarves...",
  "isbn": "9780547928227",
  "publisher": "Houghton Mifflin Harcourt",
  "publishedYear": 2012,
  "language": "English",
  "pages": 366
}
```

| Field | Type | Required |
| --- | --- | --- |
| name | string | yes |
| author | string | yes |
| quantity | number | yes |
| imageUrl | string (URL) | yes |
| category | string | yes |
| rating | number (0-10) | yes |
| shortDescription | string | no |
| isbn | string | no |
| publisher | string | no |
| publishedYear | number | no |
| language | string | no |
| pages | number | no |

`quantity` and `rating` are stored exactly as sent (the web form sends them
as strings). The optional metadata fields (`isbn`, `publisher`,
`publishedYear`, `language`, `pages`) are normalized on save: text is trimmed
and empty values are dropped, `publishedYear` and `pages` are stored as
numbers.

#### Update a book 🔒 (librarian or admin)

```http
  PUT /api/v1/books/:id
```

Request body — the same book object as POST above; the fields sent are
updated (optional metadata fields are normalized the same way).

#### Delete a book 🔒 (librarian or admin)

```http
  DELETE /api/v1/books/:id
```

Deletes the book. Returns `404` when the book does not exist and `400`
for a malformed id. The delete is refused with `409` while the book has
an active borrow (borrows without a `status` count as borrowed) — the
response carries a clear message naming the book. When a book is
deleted, its wishlist entries and notifications are removed with it, so
no orphaned references remain. A successful delete responds with
`{ "deleted": true, "bookId": "...", "wishlistsRemoved": 0,
"notificationsRemoved": 0 }`.

#### Decrease book quantity 🔒

```http
  PATCH /api/v1/books-quantity-decrease/:id
```

#### Increase book quantity 🔒

```http
  PATCH /api/v1/books-quantity-increase/:id
```

#### Add a borrowed book 🔒

```http
  POST /api/v1/borrow
```

The borrower's email is taken from the JWT, not from the request body.
Each user may have at most 3 active borrows; a fourth borrow returns
`400 { "error": "Borrow limit reached (3 books)" }`.
A book with no available copies cannot be borrowed at all — borrowing an
out-of-stock book returns `400 { "error": "This book is out of stock." }`.
The return date (`retunDate`, `YYYY-MM-DD`) must be within 5 days of
today — the server allows 1 extra day of grace for timezone skew, so
dates more than 6 days out (or more than 1 day in the past) return
`400` with a clear message.

#### Get borrowed books 🔒

```http
  GET /api/v1/borrows
```

Returns only the token owner's ACTIVE borrowed books (returned books are
excluded; the email is derived from the JWT; no `?email=` query parameter
is needed or used).

#### Get borrow history 🔒

```http
  GET /api/v1/borrows/history
```

Returns all of the token owner's borrows (borrowed and returned), newest
first. Each record has `status` (`borrowed` or `returned`) and, once
returned, `returnedDate`.

#### Return a borrowed book 🔒

```http
  PATCH /api/v1/borrows/:id/return
```

Marks the borrow as returned (sets `status` to `returned` and
`returnedDate` to today) — the record is kept for the borrow history.
Returns `403` for a borrow that belongs to another user, `404` when the
record does not exist, and `400` when it was already returned.

#### Delete a borrowed book 🔒 (admin only)

```http
  DELETE /api/v1/borrows/:id
```

Deletes a borrow record (cleanup use — returns use the PATCH endpoint
above). Returns `404` when the record does not exist.

#### Get my profile 🔒

```http
  GET /api/v1/profile
```

Returns the caller's profile (`email`, `name`, `phone`, `address`, `role`,
`createdAt`). The profile is auto-created on first access (role `admin`
for emails listed in `ADMIN_EMAILS`, otherwise `member`).

#### Update my profile 🔒

```http
  PUT /api/v1/profile
```

Updates the caller's own `name`, `phone` and `address`. Role and email
cannot be changed through this endpoint.

#### Change my email 🔒

```http
  PUT /api/v1/profile/email
```

Body: `{ "newEmail": "..." }`. Migrates the caller's profile and all their
borrows to the new email. Requires a valid JWT for the old email; the
client calls this only after Firebase confirms the email change. Returns
`409` when another profile already uses the new email.

#### List users 🔒 (admin only)

```http
  GET /api/v1/users
```

Returns all users (`email`, `name`, `role`, `createdAt`).

#### Change a user's role 🔒 (admin only)

```http
  PUT /api/v1/users/:email/role
```

Body: `{ "role": "member" | "librarian" | "admin" }`. An admin cannot
change their own role (prevents lockout). Returns `404` when the user does
not exist.

#### Get dashboard stats 🔒 (librarian or admin)

```http
  GET /api/v1/admin/stats
```

Returns library-wide counts for the dashboard. Example response:

```json
{
  "totalBooks": 32,
  "totalCopies": 120,
  "totalUsers": 5,
  "totalBorrows": 20,
  "activeBorrows": 3,
  "overdueBorrows": 1,
  "outOfStockBooks": 2
}
```

`totalCopies` is the sum of every book's quantity (quantities stored as
strings are converted); `activeBorrows` counts borrows that have not been
returned (records without a `status` count as borrowed); `overdueBorrows`
counts active borrows whose return date is in the past;
`outOfStockBooks` counts books with quantity 0.

#### Get all active borrows 🔒 (librarian or admin)

```http
  GET /api/v1/admin/borrows
```

Returns every user's active borrows (returned books excluded), most recent
first. Each record carries the book title (`bookName`), the borrower's
email, `borrowedDate`, `retunDate` and `status`.

#### Update a category image 🔒 (librarian or admin)

```http
  PATCH /api/v1/admin/categories/:id
```

Body: `{ "image": "https://..." }`. Updates ONLY the category's `image`
field — the value must be a non-empty `https` URL, otherwise the request
returns `400`. Renaming a category is not supported: book records reference
the category name, so a rename would break them. Returns `404` when the
category does not exist.

#### Get my wishlist 🔒

```http
  GET /api/v1/wishlist
```

Returns the token owner's wishlist, newest first. Each entry carries the
book's current details (`name`, `author`, `imageUrl`, `category`,
`quantity`, `rating`) so no extra lookups are needed.

#### Add a book to my wishlist 🔒

```http
  POST /api/v1/wishlist
```

Body: `{ "bookId": "..." }`. Idempotent — adding a book that is already
wishlisted returns the existing entry (`alreadyWishlisted: true`) instead
of an error. Returns `404` when the book does not exist, `400` for a
malformed book id.

#### Remove a book from my wishlist 🔒

```http
  DELETE /api/v1/wishlist/:bookId
```

Returns `404` when the book is not on the token owner's wishlist.

#### Get my notifications 🔒

```http
  GET /api/v1/notifications
```

Returns the token owner's in-app notifications, newest first. Each
notification has `type` (currently only `restock`), `bookId`, `bookName`,
`message`, `read`, and `createdAt`. A restock notification is created
when a wishlisted book's quantity goes from 0 to above 0 (via a stock
edit or a book return); a user who already has an unread restock
notification for the same book does not get a second one.

#### Mark a notification as read 🔒

```http
  PATCH /api/v1/notifications/:id/read
```

Returns `404` when the notification does not exist or belongs to another
user.

#### Mark all notifications as read 🔒

```http
  PATCH /api/v1/notifications/read-all
```

Marks all of the token owner's unread notifications as read.

## Deployment

Deployed on Vercel — `vercel.json` routes all requests to `index.js` via
`@vercel/node`. The environment variables (`USER`, `PASSWORD`, `SECRET_KEY`,
`ADMIN_EMAILS`) are set in the Vercel project settings.

## Authors

- [@MdTanzil](https://github.com/MdTanzil)
