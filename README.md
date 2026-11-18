# Sevi server
### Live Link 
[Sevi-server](https://sevi-server.vercel.app)


##  Project features

* This project use Express js and mongoDb for impliment api




## API Reference

#### POST jwt token create and set cookie

```http
  POST /api/v1/jwt
```


#### Get all categories

```http
  GET /api/v1/categories
```

#### Get categories base book

```http
  GET /api/v1/books/:category
```


#### Get single book


```http
  GET /api/v1/single-book/:id
```




#### Get all books

```http
  GET /api/v1/books
```

#### POST add book

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

`quantity` and `rating` are stored exactly as sent (the web form sends them as strings). The optional metadata fields (`isbn`, `publisher`, `publishedYear`, `language`, `pages`) are normalized on save: text is trimmed and empty values are dropped, `publishedYear` and `pages` are stored as numbers.

#### POST add a borrowed book

```http
  POST /api/v1/borrow
```

#### POST GET borrowed books

```http
  GET /api/v1/borrows
```

#### DELETE GET borrowed books

```http
  DELETE /api/v1/borrows/:id
```

#### PUT update a book

```http
  PUT /api/v1/books/:id
```

Request body — the same book object as POST above; the fields sent are updated (optional metadata fields are normalized the same way).

#### PATCH decrease book quantity

```http
  PATCH /api/v1/books-quantity-decrease/:id
```

#### PATCH increase book quantity

```http
  PATCH /api/v1/books-quantity-increase/:id
```




## Authors

- [@MdTanzil](https://github.com/MdTanzil)

