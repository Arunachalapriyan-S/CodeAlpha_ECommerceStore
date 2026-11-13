const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/* ---------- Database ---------- */
const db = new Database(path.join(__dirname, 'store.db'));
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#cfd8d3'
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Placed',
  ship_name TEXT NOT NULL,
  ship_address TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);
`);

if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
  const seed = [
    ['Stoneware Mug', 'Hand-glazed 350 ml mug with a thumb rest. Dishwasher safe.', 1800, 'Kitchen', 40, '#7a9e9f'],
    ['Pour-Over Kettle', 'Gooseneck kettle in brushed steel for precise pouring.', 5400, 'Kitchen', 15, '#4a5d6b'],
    ['Linen Apron', 'Washed linen apron with a cross-back strap and deep pocket.', 3200, 'Kitchen', 25, '#b8a27a'],
    ['Oak Cutting Board', 'End-grain oak board, finished with food-safe oil.', 4600, 'Kitchen', 12, '#9c7a54'],
    ['Wool Throw', 'Heavy merino throw, 130 x 180 cm. Woven in small batches.', 8900, 'Living', 10, '#8a5a4b'],
    ['Ceramic Vase', 'Tall matte vase with an uneven rim. Holds water.', 3800, 'Living', 18, '#5f7f6a'],
    ['Soy Candle', 'Slow-burning soy wax candle, cedar and fig, 45 hour burn.', 2400, 'Living', 60, '#c9b79c'],
    ['Brass Tray', 'Small solid brass tray for keys, rings and loose change.', 2900, 'Living', 20, '#b08d3c'],
    ['Cotton Sheet Set', 'Percale cotton, queen. Gets softer with every wash.', 9600, 'Bedroom', 8, '#a9b7c6'],
    ['Linen Pillowcases', 'Set of two stonewashed linen pillowcases.', 4200, 'Bedroom', 30, '#c7c1b6'],
    ['Bedside Lamp', 'Ceramic base, linen shade, warm dimmable light.', 6800, 'Bedroom', 0, '#6b6f8a'],
    ['Sleep Mask', 'Silk sleep mask with an adjustable band.', 1900, 'Bedroom', 45, '#3d4a5c'],
  ];
  const ins = db.prepare('INSERT INTO products (name, description, price_cents, category, stock, color) VALUES (?,?,?,?,?,?)');
  db.transaction(() => seed.forEach(s => ins.run(...s)))();
}

/* ---------- App ---------- */
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sign = u => jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' });
const publicUser = u => ({ id: u.id, name: u.name, email: u.email });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Log in to continue.' });
  try {
    const { id } = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) throw new Error('no user');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired. Log in again.' });
  }
}

/* --- Products --- */
app.get('/api/products', (req, res) => {
  const { q = '', category = '' } = req.query;
  const rows = db.prepare(
    `SELECT * FROM products
     WHERE (name LIKE @q OR description LIKE @q) AND (@category = '' OR category = @category)
     ORDER BY id`
  ).all({ q: `%${q}%`, category });
  res.json(rows);
});

app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map(r => r.category));
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  res.json(p);
});

/* --- Auth --- */
app.post('/api/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
    return res.status(409).json({ error: 'An account with this email already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)').run(name, email, hash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/me', auth, (req, res) => res.json(publicUser(req.user)));

/* --- Orders --- */
app.post('/api/orders', auth, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const shipName = String(req.body.name || '').trim();
  const shipAddress = String(req.body.address || '').trim();
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!shipName || !shipAddress) return res.status(400).json({ error: 'Enter a name and delivery address.' });

  try {
    const orderId = db.transaction(() => {
      let total = 0;
      const lines = items.map(({ id, qty }) => {
        const quantity = Number.parseInt(qty, 10);
        const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!p) throw new Error('A product in your cart no longer exists.');
        if (!(quantity > 0)) throw new Error('Invalid quantity.');
        if (p.stock < quantity) throw new Error(`Only ${p.stock} left of ${p.name}.`);
        total += p.price_cents * quantity;   // price always comes from the database
        return { p, quantity };
      });
      const o = db.prepare('INSERT INTO orders (user_id, total_cents, ship_name, ship_address) VALUES (?,?,?,?)')
        .run(req.user.id, total, shipName, shipAddress);
      for (const { p, quantity } of lines) {
        db.prepare('INSERT INTO order_items (order_id, product_id, name, price_cents, quantity) VALUES (?,?,?,?,?)')
          .run(o.lastInsertRowid, p.id, p.name, p.price_cents, quantity);
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(quantity, p.id);
      }
      return o.lastInsertRowid;
    })();
    res.status(201).json({ orderId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/orders', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const itemsStmt = db.prepare('SELECT name, price_cents, quantity FROM order_items WHERE order_id = ?');
  res.json(orders.map(o => ({ ...o, items: itemsStmt.all(o.id) })));
});

app.listen(PORT, () => console.log(`Store running at http://localhost:${PORT}`));
