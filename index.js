// index.js (Backend, full)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = 'mongodb://localhost:27017/book-rental';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_123';
const RENTAL_LIMIT = 3; // per-user open rentals

mongoose
  .connect(MONGO_URI, {})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

/* ===== Schemas ===== */
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, sparse: true },
  password: String, // bcrypt hash (legacy/plaintext auto-upgrade at login)
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  address: String,
  phone: String,
});

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  category: String,
  stock: { type: Number, default: 1 },
  isRented: { type: Boolean, default: false }, // UI compatibility
  avgRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
});

const rentalSchema = new mongoose.Schema({
  userId: String,
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  bookTitle: String,
  renterName: String,
  renterAddress: String,
  renterPhone: String,
  rentalDate: { type: Date, default: Date.now },
  dueDate: Date,
  returnDate: Date,
  returned: { type: Boolean, default: false },
  lateFeeCharged: { type: Number, default: 0 },
});

const reviewSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  userId: String,
  renterName: String,
  rating: { type: Number, min: 1, max: 5 },
  review: String,
  rentalDate: Date,
  returnDate: Date,
  createdAt: { type: Date, default: Date.now },
});

const settingSchema = new mongoose.Schema({
  lateFeePerDay: { type: Number, default: 20 },
});

const User = mongoose.model('User', userSchema);
const Book = mongoose.model('Book', bookSchema);
const Rental = mongoose.model('Rental', rentalSchema);
const Review = mongoose.model('Review', reviewSchema);
const Setting = mongoose.model('Setting', settingSchema);

/* ===== Middlewares ===== */
const auth = (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
    const token = h.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // {_id,name,role,email}
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
};

/* ===== Auth ===== */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'user', address, phone } = req.body;
    if (!name || !password) return res.status(400).json({ message: 'Name & password required' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role, address, phone });
    const token = jwt.sign(
      { _id: user._id.toString(), name: user.name, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { _id: user._id, name, email, role, address, phone } });
  } catch (e) {
    res.status(400).json({ message: 'Registration failed', error: e.message });
  }
});

// Legacy plaintext-friendly login (auto-upgrade)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const stored = user.password || '';
    let ok = false;

    if (stored.startsWith('$2')) {
      ok = await bcrypt.compare(password, stored);
    } else {
      ok = stored === password;
      if (ok) {
        user.password = await bcrypt.hash(password, 10); // auto-upgrade
        await user.save();
      }
    }
    if (!ok) return res.status(400).json({ message: 'Invalid email or password' });
    if (role && user.role !== role) return res.status(403).json({ message: 'Role mismatch' });

    const token = jwt.sign(
      { _id: user._id.toString(), name: user.name, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, address: user.address, phone: user.phone },
    });
  } catch {
    res.status(500).json({ message: 'Login failed' });
  }
});

/* ===== Books/Admin ===== */
app.get('/api/books', async (_req, res) => {
  const books = await Book.find().sort({ title: 1 });
  res.json(books);
});

app.post('/api/add-book', auth, adminOnly, async (req, res) => {
  try {
    const { title, author, stock = 1, category } = req.body;
    if (!title || !author) return res.status(400).json({ message: 'Title & author required' });
    const b = await Book.create({ title, author, stock: Number(stock || 1), category });
    if (b.stock <= 0) { b.isRented = true; await b.save(); }
    res.status(201).json({ message: 'Book added successfully!' });
  } catch {
    res.status(500).json({ message: 'Error adding book' });
  }
});

app.delete('/api/remove-book/:bookId', auth, adminOnly, async (req, res) => {
  try {
    await Book.findByIdAndDelete(req.params.bookId);
    res.json({ message: 'Book removed successfully!' });
  } catch {
    res.status(500).json({ message: 'Error removing book' });
  }
});

app.post('/api/update-stock/:bookId', auth, adminOnly, async (req, res) => {
  try {
    const { stock } = req.body;
    const b = await Book.findById(req.params.bookId);
    if (!b) return res.status(404).json({ message: 'Book not found' });
    b.stock = Number(stock || 0);
    b.isRented = b.stock <= 0;
    await b.save();
    res.json({ message: 'Stock updated' });
  } catch {
    res.status(500).json({ message: 'Error updating stock' });
  }
});

/* ===== Settings (Late Fee) ===== */
app.get('/api/late-fee', async (_req, res) => {
  let s = await Setting.findOne();
  if (!s) s = await Setting.create({ lateFeePerDay: 20 });
  res.json({ lateFeePerDay: s.lateFeePerDay });
});
app.post('/api/late-fee', auth, adminOnly, async (req, res) => {
  const { lateFeePerDay } = req.body;
  let s = await Setting.findOne();
  if (!s) s = await Setting.create({ lateFeePerDay: Number(lateFeePerDay || 0) });
  else { s.lateFeePerDay = Number(lateFeePerDay || 0); await s.save(); }
  res.json({ lateFeePerDay: s.lateFeePerDay });
});

/* ===== Rent/Return ===== */
app.post('/api/rent-book', async (req, res) => {
  try {
    const { bookId, userId, renterName, renterAddress, renterPhone, dueDate } = req.body;
    if (!bookId || !userId || !renterName || !renterAddress || !renterPhone) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const openCount = await Rental.countDocuments({ userId, returned: false });
    if (openCount >= RENTAL_LIMIT) {
      return res.status(400).json({ message: `Rental limit reached (${RENTAL_LIMIT}). Return a book first.` });
    }
    const b = await Book.findById(bookId);
    if (!b) return res.status(404).json({ message: 'Book not found' });
    if ((b.stock || 0) <= 0) return res.status(400).json({ message: 'Out of stock' });

    b.stock = (b.stock || 0) - 1;
    b.isRented = b.stock <= 0;
    await b.save();

    const _due = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await Rental.create({
      userId,
      bookId: b._id,
      bookTitle: b.title,
      renterName,
      renterAddress,
      renterPhone,
      dueDate: _due,
    });
    res.json({ message: 'Book rented successfully' });
  } catch {
    res.status(500).json({ message: 'Failed to rent the book' });
  }
});

app.post('/api/return-book', async (req, res) => {
  try {
    const { bookId, userId, returnDate } = req.body;
    const b = await Book.findById(bookId);
    if (!b) return res.status(404).json({ message: 'Book not found' });

    const rental = await Rental.findOne({ bookId, userId, returned: false }).sort({ rentalDate: -1 });
    if (!rental) return res.status(404).json({ message: 'Open rental not found for this user/book' });

    let s = await Setting.findOne();
    if (!s) s = await Setting.create({ lateFeePerDay: 20 });

    const retDate = new Date(returnDate || Date.now());
    let lateFee = 0;
    if (rental.dueDate && retDate > rental.dueDate) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysLate = Math.ceil((retDate - rental.dueDate) / msPerDay);
      lateFee = daysLate * (s.lateFeePerDay || 0);
    }

    rental.returned = true;
    rental.returnDate = retDate;
    rental.lateFeeCharged = lateFee;
    await rental.save();

    b.stock = (b.stock || 0) + 1;
    b.isRented = b.stock <= 0;
    await b.save();

    res.json({ message: 'Book returned successfully', lateFee });
  } catch {
    res.status(500).json({ message: 'Failed to return the book' });
  }
});

/* ===== User History / Overdue / Reviews / Recommend ===== */
app.get('/api/rental-history/:userId', async (req, res) => {
  const rentals = await Rental.find({ userId: req.params.userId }).sort({ rentalDate: -1 });
  res.json(rentals);
});

app.get('/api/overdue/:userId', async (req, res) => {
  const now = new Date();
  const overs = await Rental.find({ userId: req.params.userId, returned: false, dueDate: { $lt: now } });
  res.json(overs);
});

app.post('/api/review', async (req, res) => {
  try {
    const { bookId, userId, rating, review } = req.body;
    if (!bookId || !userId || !rating) return res.status(400).json({ message: 'Missing fields' });

    const lastRental = await Rental.findOne({ userId, bookId }).sort({ rentalDate: -1 });
    const renterName = lastRental?.renterName || userId;

    await Review.create({
      bookId,
      userId,
      renterName,
      rating: Number(rating),
      review,
      rentalDate: lastRental?.rentalDate,
      returnDate: lastRental?.returnDate,
    });

    const stats = await Review.aggregate([
      { $match: { bookId: new mongoose.Types.ObjectId(bookId) } },
      { $group: { _id: '$bookId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (stats.length) {
      const { avg, count } = stats[0];
      await Book.findByIdAndUpdate(bookId, {
        $set: { avgRating: Number(avg.toFixed(2)), ratingCount: count },
      });
    }
    res.json({ message: 'Review saved' });
  } catch {
    res.status(500).json({ message: 'Failed to save review' });
  }
});
app.get('/api/reviews/:bookId', async (req, res) => {
  const list = await Review.find({ bookId: req.params.bookId }).sort({ createdAt: -1 });
  res.json(list);
});

app.get('/api/recommendations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const rentedIds = await Rental.find({ userId }).distinct('bookId');
    const books = await Book.find({ _id: { $nin: rentedIds }, stock: { $gt: 0 } })
      .sort({ avgRating: -1, ratingCount: -1 })
      .limit(6);
    res.json(books);
  } catch {
    res.json([]);
  }
});

/* ===== NEW: Admin Rentals Dashboard =====
   Admin দেখতে পারবে:
   - কে (name/phone/address) কোন বই নিয়েছে
   - কখন নিয়েছে, কখন ফেরত দেওয়ার কথা (dueDate)
   - ফেরত দিয়েছে কি না, দিলে returnDate
   - লেট ফি: returned হলে lateFeeCharged, নইলে আজ পর্যন্ত lateFeeDueNow
*/
app.get('/api/admin/rentals', auth, adminOnly, async (req, res) => {
  try {
    const status = (req.query.status || 'open').toLowerCase(); // open | returned | all
    const query = {};
    if (status === 'open') query.returned = false;
    else if (status === 'returned') query.returned = true;

    const rentals = await Rental.find(query).sort({ rentalDate: -1 });
    let s = await Setting.findOne();
    if (!s) s = await Setting.create({ lateFeePerDay: 20 });

    const now = new Date();
    const perDay = s.lateFeePerDay || 0;

    const data = rentals.map((r) => {
      let lateFeeDueNow = 0;
      if (!r.returned && r.dueDate && now > r.dueDate) {
        const daysLate = Math.ceil((now - r.dueDate) / (24 * 60 * 60 * 1000));
        lateFeeDueNow = daysLate * perDay;
      }
      return {
        _id: r._id,
        userId: r.userId,
        bookId: r.bookId,
        bookTitle: r.bookTitle,
        renterName: r.renterName,
        renterAddress: r.renterAddress,
        renterPhone: r.renterPhone,
        rentalDate: r.rentalDate,
        dueDate: r.dueDate,
        returned: r.returned,
        returnDate: r.returnDate,
        lateFeeCharged: r.lateFeeCharged,
        lateFeeDueNow,
      };
    });

    res.json({ lateFeePerDay: perDay, rentals: data });
  } catch (e) {
    res.status(500).json({ message: 'Failed to load admin rentals' });
  }
});

/* ===== Dev utilities (for your local testing) ===== */
const seedHandler = async (_req, res) => {
  try {
    const adminEmail = 'admin@brs.com';
    const userEmail = 'user@brs.com';

    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const hash = await bcrypt.hash('admin123', 10);
      await User.create({
        name: 'Admin',
        email: adminEmail,
        password: hash,
        role: 'admin',
        address: 'HQ',
        phone: '01900000000',
      });
    }
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      const hash = await bcrypt.hash('user123', 10);
      await User.create({
        name: 'Test User',
        email: userEmail,
        password: hash,
        role: 'user',
        address: 'Dhaka',
        phone: '01700000000',
      });
    }

    const samples = [
      ['Clean Code', 'Robert C. Martin'], ['The Pragmatic Programmer', 'Andrew Hunt'],
      ['You Don’t Know JS', 'Kyle Simpson'], ['Eloquent JavaScript', 'Marijn Haverbeke'],
      ['Design Patterns', 'GoF'], ['Refactoring', 'Martin Fowler'],
      ['JavaScript Patterns', 'Stoyan Stefanov'], ['Cracking the Coding Interview', 'Gayle Laakmann'],
      ['Deep Work', 'Cal Newport'], ['Atomic Habits', 'James Clear'],
    ];
    for (const [title, author] of samples) {
      const exist = await Book.findOne({ title });
      if (!exist) await Book.create({ title, author, stock: 3 });
    }
    let s = await Setting.findOne();
    if (!s) await Setting.create({ lateFeePerDay: 20 });

    res.json({ message: 'Seeded: admin/user + books + settings' });
  } catch {
    res.status(500).json({ message: 'Seed failed' });
  }
};
app.get('/api/dev/seed', seedHandler);
app.post('/api/dev/seed', seedHandler);

app.post('/api/dev/return-all/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const open = await Rental.find({ userId, returned: false });
    for (const r of open) {
      r.returned = true;
      r.returnDate = new Date();
      await r.save();
      const b = await Book.findById(r.bookId);
      if (b) { b.stock = (b.stock || 0) + 1; b.isRented = b.stock <= 0; await b.save(); }
    }
    res.json({ message: `Closed ${open.length} rentals for ${userId}` });
  } catch {
    res.status(500).json({ message: 'Failed to close rentals' });
  }
});

/* ===== Cron (overdue logs) ===== */
cron.schedule('0 0 * * *', async () => {
  const now = new Date();
  const overdue = await Rental.find({ returned: false, dueDate: { $lt: now } });
  overdue.forEach((r) => {
    console.log(`Overdue: "${r.bookTitle}" for user ${r.userId} (due ${r.dueDate?.toDateString()})`);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
