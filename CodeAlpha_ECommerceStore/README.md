# CodeAlpha_ECommerceStore

Simple e-commerce store built for **CodeAlpha Full Stack Development – Task 1**.

**Stack:** HTML, CSS, JavaScript (frontend) · Express.js (backend) · SQLite (database)

## Features
- Product listing with search and category filter
- Product details page
- Shopping cart (kept in the browser, quantity limited by stock)
- User registration and login (bcrypt-hashed passwords, JWT sessions)
- Order processing: prices and stock are checked on the server, stock is reduced, order history per user
- Database tables: `users`, `products`, `orders`, `order_items`

## Run it
```bash
npm install
npm start
```
Open http://localhost:3000. The database (`store.db`) is created and filled with sample products on first run.

Set `JWT_SECRET` in production: `JWT_SECRET=your-long-random-string npm start`

## API
| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | /api/products?q=&category= | – | List products |
| GET | /api/products/:id | – | Product details |
| GET | /api/categories | – | Category names |
| POST | /api/register | – | Create account |
| POST | /api/login | – | Log in |
| GET | /api/me | Bearer | Current user |
| POST | /api/orders | Bearer | Place order |
| GET | /api/orders | Bearer | Your orders |

## Structure
```
server.js        Express API + SQLite schema and seed data
public/          index.html, style.css, app.js (hash-routed single page)
```
