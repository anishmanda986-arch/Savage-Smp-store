const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'minecraft_server_secret_2024_ultra_secure';

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads dir exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// ─── In-Memory Database ───────────────────────────────────────────────────────
let db = {
  users: [
    {
      id: 'admin-001',
      discordUsername: 'Admin#0001',
      ingameUsername: 'AdminPlayer',
      email: 'admin@minecraft.com',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      createdAt: new Date().toISOString(),
      avatar: null
    }
  ],
  ranks: [
    { id: 'rank-1', name: 'VIP', price: 9.99, color: '#00ff88', description: 'Entry level rank with basic perks', image: null, perks: ['Custom prefix', '5 homes', 'Fly in lobby'], featured: false, createdAt: new Date().toISOString() },
    { id: 'rank-2', name: 'VIP+', price: 19.99, color: '#00ccff', description: 'Enhanced VIP with more features', image: null, perks: ['All VIP perks', '10 homes', 'Access to /nick', 'Colored chat'], featured: true, createdAt: new Date().toISOString() },
    { id: 'rank-3', name: 'MVP', price: 34.99, color: '#ff9900', description: 'Mid-tier rank for dedicated players', image: null, perks: ['All VIP+ perks', '20 homes', 'Particle effects', 'Custom join message'], featured: false, createdAt: new Date().toISOString() },
    { id: 'rank-4', name: 'MVP+', price: 54.99, color: '#ff4444', description: 'Top tier with exclusive features', image: null, perks: ['All MVP perks', 'Unlimited homes', 'Kit MVP+', 'Access to /fly everywhere', 'Priority support'], featured: true, createdAt: new Date().toISOString() },
    { id: 'rank-5', name: 'LEGEND', price: 99.99, color: '#cc44ff', description: 'Legendary status - the ultimate rank', image: null, perks: ['All MVP+ perks', 'Custom armor stand', 'Name in lobby', 'Discord Legend role', 'Monthly crate key'], featured: false, createdAt: new Date().toISOString() },
  ],
  crateKeys: [
    { id: 'crate-1', name: 'Common Crate Key', price: 2.99, description: 'Basic crate with common rewards', image: null, stock: 999, createdAt: new Date().toISOString() },
    { id: 'crate-2', name: 'Rare Crate Key', price: 5.99, description: 'Rare rewards inside!', image: null, stock: 500, createdAt: new Date().toISOString() },
    { id: 'crate-3', name: 'Epic Crate Key', price: 9.99, description: 'Epic loot awaits you', image: null, stock: 200, createdAt: new Date().toISOString() },
    { id: 'crate-4', name: 'Legendary Crate Key', price: 19.99, description: 'The rarest rewards in existence', image: null, stock: 50, createdAt: new Date().toISOString() },
  ],
  customItems: [
    { id: 'item-1', name: 'Spawner Bundle', price: 14.99, description: 'Get 3 mob spawners of your choice', image: null, category: 'spawners', stock: 100, createdAt: new Date().toISOString() },
    { id: 'item-2', name: 'God Set', price: 24.99, description: 'Full enchanted diamond armor set', image: null, category: 'gear', stock: 50, createdAt: new Date().toISOString() },
    { id: 'item-3', name: 'Money Bag', price: 4.99, description: '$50,000 in-game currency', image: null, category: 'currency', stock: 999, createdAt: new Date().toISOString() },
  ],
  claimBlocks: [
    { id: 'cb-1', name: '1,000 Claim Blocks', price: 1.99, amount: 1000, createdAt: new Date().toISOString() },
    { id: 'cb-2', name: '5,000 Claim Blocks', price: 7.99, amount: 5000, createdAt: new Date().toISOString() },
    { id: 'cb-3', name: '10,000 Claim Blocks', price: 12.99, amount: 10000, createdAt: new Date().toISOString() },
    { id: 'cb-4', name: '25,000 Claim Blocks', price: 24.99, amount: 25000, createdAt: new Date().toISOString() },
  ],
  orders: [],
  announcements: [
    { id: 'ann-1', text: '🎉 Welcome to CrystalMC! Join us at play.crystalmc.net', active: true, createdAt: new Date().toISOString() },
    { id: 'ann-2', text: '⚔️ Season 3 is LIVE! New map, new features!', active: true, createdAt: new Date().toISOString() },
    { id: 'ann-3', text: '🛒 Weekend SALE - 30% off all ranks! Use code: WEEKEND30', active: true, createdAt: new Date().toISOString() },
    { id: 'ann-4', text: '🏆 PvP Tournament this Saturday at 8PM EST - $50 prize pool!', active: true, createdAt: new Date().toISOString() },
  ],
  serverStatus: {
    status: 'online',
    playerCount: 47,
    maxPlayers: 200,
    ip: 'play.crystalmc.net',
    bedrockIp: 'bedrock.crystalmc.net',
    bedrockPort: 19132,
    version: '1.21.1',
    motd: 'Welcome to CrystalMC | Season 3 LIVE!',
    updatedAt: new Date().toISOString()
  },
  qrCode: null,
  discountCodes: [
    { id: 'dc-1', code: 'WEEKEND30', discount: 30, type: 'percent', active: true },
    { id: 'dc-2', code: 'WELCOME10', discount: 10, type: 'percent', active: true },
  ]
};

// ─── Middleware ───────────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { discordUsername, ingameUsername, email, password } = req.body;
  if (!discordUsername || !ingameUsername || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (db.users.find(u => u.email === email))
    return res.status(400).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: `user-${Date.now()}`, discordUsername, ingameUsername, email, passwordHash, role: 'user', createdAt: new Date().toISOString(), avatar: null };
  db.users.push(user);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, discordUsername, ingameUsername, email, role: user.role } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email);
  if (!user || !await bcrypt.compare(password, user.passwordHash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, discordUsername: user.discordUsername, ingameUsername: user.ingameUsername, email: user.email, role: user.role } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, discordUsername: user.discordUsername, ingameUsername: user.ingameUsername, email: user.email, role: user.role });
});

app.put('/api/auth/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.users.find(u => u.id === req.user.id);
  if (!await bcrypt.compare(currentPassword, user.passwordHash))
    return res.status(400).json({ error: 'Current password incorrect' });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  res.json({ message: 'Password updated' });
});

// ─── Public Routes ────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => res.json(db.serverStatus));
app.get('/api/announcements', (req, res) => res.json(db.announcements.filter(a => a.active)));
app.get('/api/ranks', (req, res) => res.json(db.ranks));
app.get('/api/crate-keys', (req, res) => res.json(db.crateKeys));
app.get('/api/custom-items', (req, res) => res.json(db.customItems));
app.get('/api/claim-blocks', (req, res) => res.json(db.claimBlocks));
app.get('/api/qr-code', (req, res) => res.json({ qrCode: db.qrCode }));

app.post('/api/discount/validate', (req, res) => {
  const { code } = req.body;
  const discount = db.discountCodes.find(d => d.code === code && d.active);
  if (!discount) return res.status(404).json({ error: 'Invalid or expired code' });
  res.json({ discount: discount.discount, type: discount.type });
});

// ─── Orders ───────────────────────────────────────────────────────────────────
app.post('/api/orders', authMiddleware, (req, res) => {
  const { items, totalAmount, discordUsername, ingameUsername, discountCode, paymentMethod } = req.body;
  const order = {
    id: `order-${Date.now()}`,
    userId: req.user.id,
    items,
    totalAmount,
    discordUsername,
    ingameUsername,
    discountCode: discountCode || null,
    paymentMethod: paymentMethod || 'qr',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  res.json(order);
});

app.get('/api/orders/my', authMiddleware, (req, res) => {
  const orders = db.orders.filter(o => o.userId === req.user.id);
  res.json(orders);
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  res.json(db.users.map(u => ({ id: u.id, discordUsername: u.discordUsername, ingameUsername: u.ingameUsername, email: u.email, role: u.role, createdAt: u.createdAt })));
});

app.get('/api/admin/orders', authMiddleware, adminMiddleware, (req, res) => res.json(db.orders));

app.put('/api/admin/orders/:id', authMiddleware, adminMiddleware, (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  Object.assign(order, req.body);
  res.json(order);
});

// Ranks CRUD
app.post('/api/admin/ranks', authMiddleware, adminMiddleware, (req, res) => {
  const rank = { id: `rank-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
  db.ranks.push(rank);
  res.json(rank);
});
app.put('/api/admin/ranks/:id', authMiddleware, adminMiddleware, (req, res) => {
  const idx = db.ranks.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.ranks[idx] = { ...db.ranks[idx], ...req.body };
  res.json(db.ranks[idx]);
});
app.delete('/api/admin/ranks/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.ranks = db.ranks.filter(r => r.id !== req.params.id);
  res.json({ message: 'Deleted' });
});

// Crate Keys CRUD
app.post('/api/admin/crate-keys', authMiddleware, adminMiddleware, (req, res) => {
  const key = { id: `crate-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
  db.crateKeys.push(key);
  res.json(key);
});
app.put('/api/admin/crate-keys/:id', authMiddleware, adminMiddleware, (req, res) => {
  const idx = db.crateKeys.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.crateKeys[idx] = { ...db.crateKeys[idx], ...req.body };
  res.json(db.crateKeys[idx]);
});
app.delete('/api/admin/crate-keys/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.crateKeys = db.crateKeys.filter(r => r.id !== req.params.id);
  res.json({ message: 'Deleted' });
});

// Custom Items CRUD
app.post('/api/admin/custom-items', authMiddleware, adminMiddleware, (req, res) => {
  const item = { id: `item-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
  db.customItems.push(item);
  res.json(item);
});
app.put('/api/admin/custom-items/:id', authMiddleware, adminMiddleware, (req, res) => {
  const idx = db.customItems.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.customItems[idx] = { ...db.customItems[idx], ...req.body };
  res.json(db.customItems[idx]);
});
app.delete('/api/admin/custom-items/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.customItems = db.customItems.filter(r => r.id !== req.params.id);
  res.json({ message: 'Deleted' });
});

// Server status
app.put('/api/admin/server-status', authMiddleware, adminMiddleware, (req, res) => {
  db.serverStatus = { ...db.serverStatus, ...req.body, updatedAt: new Date().toISOString() };
  res.json(db.serverStatus);
});

// Announcements
app.post('/api/admin/announcements', authMiddleware, adminMiddleware, (req, res) => {
  const ann = { id: `ann-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
  db.announcements.push(ann);
  res.json(ann);
});
app.put('/api/admin/announcements/:id', authMiddleware, adminMiddleware, (req, res) => {
  const idx = db.announcements.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.announcements[idx] = { ...db.announcements[idx], ...req.body };
  res.json(db.announcements[idx]);
});
app.delete('/api/admin/announcements/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.announcements = db.announcements.filter(a => a.id !== req.params.id);
  res.json({ message: 'Deleted' });
});
app.get('/api/admin/announcements', authMiddleware, adminMiddleware, (req, res) => res.json(db.announcements));

// QR Code upload
app.post('/api/admin/qr-code', authMiddleware, adminMiddleware, (req, res) => {
  const { qrCode } = req.body;
  db.qrCode = qrCode;
  res.json({ message: 'QR code updated' });
});

// Image upload
app.post('/api/admin/upload', authMiddleware, adminMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Stats
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  const totalRevenue = db.orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.totalAmount, 0);
  res.json({
    totalUsers: db.users.length,
    totalOrders: db.orders.length,
    pendingOrders: db.orders.filter(o => o.status === 'pending').length,
    totalRevenue: totalRevenue.toFixed(2),
    onlinePlayers: db.serverStatus.playerCount
  });
});

app.listen(PORT, () => console.log(`🚀 CrystalMC API running on port ${PORT}`));
