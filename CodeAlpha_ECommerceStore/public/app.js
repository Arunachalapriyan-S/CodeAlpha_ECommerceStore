const app = document.getElementById('app');
const navEl = document.getElementById('nav');
const toastEl = document.getElementById('toast');

/* ---------- helpers ---------- */
const money = c => '$' + (c / 100).toFixed(2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

let cart = read('cart', []);        // [{ id, name, price_cents, color, stock, qty }]
let token = localStorage.getItem('token');
let user = read('user', null);
let filters = { q: '', category: '' };
let nextHash = '#/';

const saveCart = () => { localStorage.setItem('cart', JSON.stringify(cart)); renderNav(); };
const cartCount = () => cart.reduce((n, i) => n + i.qty, 0);
const cartTotal = () => cart.reduce((n, i) => n + i.qty * i.price_cents, 0);

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) logout(false);
    throw new Error(data.error || 'Something went wrong. Try again.');
  }
  return data;
}

function setSession(data) {
  token = data.token; user = data.user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  renderNav();
}
function logout(go = true) {
  token = null; user = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  renderNav();
  if (go) { toast('Logged out'); location.hash = '#/'; }
}

const art = p => `<div class="art" style="background:${esc(p.color)}" aria-hidden="true">${esc(p.name[0])}</div>`;

/* ---------- nav ---------- */
function renderNav() {
  navEl.innerHTML = `
    <a href="#/">Shop</a>
    ${user
      ? `<a href="#/orders">Orders</a><span>${esc(user.name.split(' ')[0])}</span><a href="#/" data-logout>Log out</a>`
      : `<a href="#/login">Log in</a><a href="#/register">Sign up</a>`}
    <a href="#/cart">Cart<span class="count">${cartCount()}</span></a>`;
}

/* ---------- views ---------- */
async function homeView() {
  app.innerHTML = '<p class="empty">Loading products…</p>';
  const [cats, products] = await Promise.all([
    api('/categories'),
    api(`/products?q=${encodeURIComponent(filters.q)}&category=${encodeURIComponent(filters.category)}`),
  ]);
  app.innerHTML = `
    <h1>Everyday things for the home</h1>
    <div class="tools">
      <input id="search" type="search" placeholder="Search products" aria-label="Search products" value="${esc(filters.q)}">
      <div class="chips">
        ${['', ...cats].map(c => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${filters.category === c}">${c || 'All'}</button>`).join('')}
      </div>
    </div>
    ${products.length ? `<div class="grid">${products.map(p => `
      <article class="card">
        <a class="media" href="#/product/${p.id}" aria-label="${esc(p.name)}">${art(p)}</a>
        <div class="body">
          <h3><a href="#/product/${p.id}" style="text-decoration:none">${esc(p.name)}</a></h3>
          <span class="meta">${esc(p.category)}</span>
          ${p.stock === 0 ? '<span class="tag">Out of stock</span>' : ''}
          <div class="row">
            <span class="price">${money(p.price_cents)}</span>
            <button class="btn" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button>
          </div>
        </div>
      </article>`).join('')}</div>`
      : '<p class="empty">No products match your search. Try a different word or choose All.</p>'}`;
  const s = document.getElementById('search');
  let t;
  s.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { filters.q = s.value.trim(); homeView().then(() => { const n = document.getElementById('search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 300); });
}

async function productView(id) {
  const p = await api('/products/' + id);
  const inCart = cart.find(i => i.id === p.id);
  app.innerHTML = `
    <p><a href="#/">← All products</a></p>
    <div class="detail">
      ${art(p)}
      <div>
        <h1>${esc(p.name)}</h1>
        <p class="meta">${esc(p.category)}</p>
        <p class="price" style="font-size:1.5rem">${money(p.price_cents)}</p>
        <p>${esc(p.description)}</p>
        <p>${p.stock === 0 ? '<span class="tag">Out of stock</span>' : `${p.stock} in stock`}${inCart ? ` · ${inCart.qty} in your cart` : ''}</p>
        <button class="btn" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button>
      </div>
    </div>`;
}

function cartView() {
  if (!cart.length) {
    app.innerHTML = '<h1>Your cart</h1><p class="empty">Your cart is empty. <a href="#/">Browse products</a></p>';
    return;
  }
  app.innerHTML = `
    <h1>Your cart</h1>
    <div class="lines">${cart.map(i => `
      <div class="line">
        <div class="art" style="background:${esc(i.color)}" aria-hidden="true">${esc(i.name[0])}</div>
        <div class="lt"><a href="#/product/${i.id}"><strong>${esc(i.name)}</strong></a><br><span class="meta">${money(i.price_cents)} each</span></div>
        <div class="qty">
          <button data-dec="${i.id}" aria-label="Decrease quantity of ${esc(i.name)}">−</button>
          <span>${i.qty}</span>
          <button data-inc="${i.id}" aria-label="Increase quantity of ${esc(i.name)}">+</button>
        </div>
        <div><span class="price">${money(i.price_cents * i.qty)}</span><br><button class="link" data-remove="${i.id}">Remove</button></div>
      </div>`).join('')}
    </div>
    <div class="summary">
      <h2>Total: ${money(cartTotal())}</h2>
      <a class="btn" href="#/checkout">Check out</a>
    </div>`;
}

function checkoutView() {
  if (!user) { nextHash = '#/checkout'; toast('Log in to place your order'); location.hash = '#/login'; return; }
  if (!cart.length) { location.hash = '#/cart'; return; }
  app.innerHTML = `
    <h1>Check out</h1>
    <div class="panel">
      <p>${cartCount()} item(s) · <strong>${money(cartTotal())}</strong></p>
      <form id="checkout" novalidate>
        <label for="name">Full name</label>
        <input id="name" required value="${esc(user.name)}" autocomplete="name">
        <label for="address">Delivery address</label>
        <textarea id="address" rows="3" required autocomplete="street-address"></textarea>
        <p class="error" id="err"></p>
        <button class="btn" type="submit">Place order</button>
      </form>
    </div>`;
  document.getElementById('checkout').addEventListener('submit', async e => {
    e.preventDefault();
    const err = document.getElementById('err');
    err.textContent = '';
    try {
      const { orderId } = await api('/orders', {
        method: 'POST',
        body: { name: document.getElementById('name').value, address: document.getElementById('address').value, items: cart.map(i => ({ id: i.id, qty: i.qty })) },
      });
      cart = []; saveCart();
      app.innerHTML = `<h1>Order #${orderId} placed</h1><p>Thanks, ${esc(user.name.split(' ')[0])}. You can track it under Orders.</p><a class="btn" href="#/orders">View orders</a>`;
    } catch (ex) { err.textContent = ex.message; }
  });
}

async function ordersView() {
  if (!user) { nextHash = '#/orders'; location.hash = '#/login'; return; }
  const orders = await api('/orders');
  app.innerHTML = `<h1>Your orders</h1>` + (orders.length ? orders.map(o => `
    <article class="order">
      <header><strong>Order #${o.id}</strong><span>${esc(o.created_at)} UTC · ${esc(o.status)}</span></header>
      <ul>${o.items.map(i => `<li>${i.quantity} × ${esc(i.name)} — ${money(i.price_cents * i.quantity)}</li>`).join('')}</ul>
      <p><strong>Total: ${money(o.total_cents)}</strong> · Ships to ${esc(o.ship_name)}</p>
    </article>`).join('') : '<p class="empty">You haven’t ordered anything yet. <a href="#/">Browse products</a></p>');
}

function authView(mode) {
  const reg = mode === 'register';
  app.innerHTML = `
    <h1>${reg ? 'Create your account' : 'Log in'}</h1>
    <div class="panel">
      <form id="auth" novalidate>
        ${reg ? '<label for="name">Name</label><input id="name" autocomplete="name">' : ''}
        <label for="email">Email</label><input id="email" type="email" autocomplete="email">
        <label for="password">Password</label><input id="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}">
        <p class="error" id="err"></p>
        <button class="btn" type="submit">${reg ? 'Sign up' : 'Log in'}</button>
      </form>
      <p>${reg ? 'Already have an account? <a href="#/login">Log in</a>' : 'New here? <a href="#/register">Create an account</a>'}</p>
    </div>`;
  document.getElementById('auth').addEventListener('submit', async e => {
    e.preventDefault();
    const err = document.getElementById('err');
    err.textContent = '';
    try {
      const body = { email: document.getElementById('email').value, password: document.getElementById('password').value };
      if (reg) body.name = document.getElementById('name').value;
      setSession(await api(reg ? '/register' : '/login', { method: 'POST', body }));
      toast(reg ? 'Account created' : 'Welcome back');
      const go = nextHash; nextHash = '#/';
      location.hash = go;
    } catch (ex) { err.textContent = ex.message; }
  });
}

/* ---------- cart actions ---------- */
async function addToCart(id) {
  const p = await api('/products/' + id);
  const line = cart.find(i => i.id === p.id);
  if ((line ? line.qty : 0) + 1 > p.stock) return toast(`Only ${p.stock} in stock`);
  if (line) { line.qty++; line.stock = p.stock; }
  else cart.push({ id: p.id, name: p.name, price_cents: p.price_cents, color: p.color, stock: p.stock, qty: 1 });
  saveCart();
  toast(`${p.name} added to cart`);
  if (location.hash.startsWith('#/product/')) productView(p.id);
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-add],[data-inc],[data-dec],[data-remove],[data-cat],[data-logout]');
  if (!t) return;
  const d = t.dataset;
  if (d.add) addToCart(Number(d.add)).catch(x => toast(x.message));
  else if (d.inc || d.dec || d.remove) {
    const id = Number(d.inc || d.dec || d.remove);
    const line = cart.find(i => i.id === id);
    if (!line) return;
    if (d.inc) { if (line.qty >= line.stock) return toast(`Only ${line.stock} in stock`); line.qty++; }
    if (d.dec) line.qty--;
    if (d.remove || line.qty <= 0) cart = cart.filter(i => i.id !== id);
    saveCart(); cartView();
  } else if (d.cat !== undefined) { filters.category = d.cat; homeView(); }
  else if ('logout' in d) { e.preventDefault(); logout(); }
});

const routes = [
  [/^#\/product\/(\d+)$/, productView],
  [/^#\/cart$/, cartView],
  [/^#\/checkout$/, checkoutView],
  [/^#\/orders$/, ordersView],
  [/^#\/login$/, () => authView('login')],
  [/^#\/register$/, () => authView('register')],
];
async function route() {
  const h = location.hash || '#/';
  try {
    for (const [re, fn] of routes) { const m = h.match(re); if (m) { await fn(...m.slice(1)); window.scrollTo(0, 0); return; } }
    await homeView();
  } catch (e) {
    app.innerHTML = `<p class="empty">${esc(e.message)} <a href="#/">Back to shop</a></p>`;
  }
}
window.addEventListener('hashchange', route);
renderNav();
route();
