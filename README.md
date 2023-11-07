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

