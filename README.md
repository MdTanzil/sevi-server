# Sevi server

REST API for [Sevi](https://sevi-efc34.web.app/) — a Library Management
System. Express + MongoDB Atlas, with JWT cookie authentication.

**Live API:** https://sevi-server.vercel.app
**Client:** [sevi-client](https://github.com/MdTanzil/sevi-client)

## Features

- Book catalogue: list all books, filter by category, single-book lookup
- Add and update books, including optional metadata (ISBN, publisher,
  published year, language, pages)
- Borrowing: record borrows, list a user's borrowed books, return books
  (quantity tracking)
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
| `PORT` | Port to listen on (default `5000`) |
| `NODE_ENV` | Set to `production` for secure, cross-site auth cookies |

The server connects to the `booksDB` database (collections: `categories`,
`books`, `borrows`). CORS allows `http://localhost:5173` and
`https://sevi-efc34.web.app` with credentials.

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
    │   ├── auth.routes.js
    │   ├── books.routes.js
    │   ├── borrows.routes.js
    │   └── categories.routes.js
    ├── controllers/          # Route handlers (one file per resource)
    │   ├── auth.controller.js
    │   ├── books.controller.js
    │   ├── borrows.controller.js
    │   └── categories.controller.js
    ├── middlewares/
    │   └── verifyToken.js    # JWT cookie verification
    └── utils/
        ├── normalizeBook.js  # Book metadata normalization before saving
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

#### Add a book 🔒

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

#### Update a book 🔒

```http
  PUT /api/v1/books/:id
```

Request body — the same book object as POST above; the fields sent are
updated (optional metadata fields are normalized the same way).

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

#### Get borrowed books 🔒

```http
  GET /api/v1/borrows
```

Returns only the token owner's borrowed books (the email is derived from
the JWT; no `?email=` query parameter is needed or used).

#### Delete a borrowed book 🔒

```http
  DELETE /api/v1/borrows/:id
```

Only the owner of the borrow record can delete it: returns `403` for a
borrow that belongs to another user, `404` when the record does not exist.

## Deployment

Deployed on Vercel — `vercel.json` routes all requests to `index.js` via
`@vercel/node`. The environment variables (`USER`, `PASSWORD`, `SECRET_KEY`)
are set in the Vercel project settings.

## Authors

- [@MdTanzil](https://github.com/MdTanzil)
