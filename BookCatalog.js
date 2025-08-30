// src/BookCatalog.js
import React, { useEffect, useMemo, useState, useContext } from 'react';
import './BookCatalog.css';
import { AuthContext } from './AuthContext';

const API = 'http://localhost:5000';

export default function BookCatalog() {
  const { authUser, token } = useContext(AuthContext);
  const isAdmin = authUser?.role === 'admin';

  // core state
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState('title');

  // renter details (prefill from authUser if available)
  const [renterDetails, setRenterDetails] = useState({
    name: authUser?.name || '',
    address: authUser?.address || '',
    phone: authUser?.phone || '',
  });
  const [userId, setUserId] = useState(authUser?.phone || 'user123');

  useEffect(() => {
    if (renterDetails.phone && renterDetails.phone.trim()) {
      setUserId(renterDetails.phone.trim());
    }
  }, [renterDetails.phone]);

  // per-book date states
  const [returnDates, setReturnDates] = useState({});
  const [dueDates, setDueDates] = useState({});
  const setReturnDateFor = (id, v) => setReturnDates((p) => ({ ...p, [id]: v }));
  const setDueDateFor = (id, v) => setDueDates((p) => ({ ...p, [id]: v }));

  // new book form + stock inputs
  const [newBook, setNewBook] = useState({ title: '', author: '', stock: 1 });
  const [stockInputs, setStockInputs] = useState({});

  // history / overdue / recommendations / late fee / reviews
  const [rentalHistory, setRentalHistory] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [recs, setRecs] = useState([]);
  const [lateFeePerDay, setLateFeePerDay] = useState(20);

  const [reviewInputs, setReviewInputs] = useState({});
  const [reviewsVisible, setReviewsVisible] = useState({});
  const [reviewsData, setReviewsData] = useState({});

  // NEW: Admin rentals dashboard
  const [adminRentals, setAdminRentals] = useState([]);
  const [adminFilter, setAdminFilter] = useState('open'); // open | returned | all

  // helper: auth header
  const authHeaders = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  // loaders
  const loadBooks = async () => {
    const data = await fetch(`${API}/api/books`).then((r) => r.json());
    setBooks(data);
    const stocks = {};
    data.forEach((b) => (stocks[b._id] = b.stock || 0));
    setStockInputs((p) => ({ ...stocks, ...p }));
  };

  const loadSettings = async () => {
    const d = await fetch(`${API}/api/late-fee`).then((r) => r.json());
    setLateFeePerDay(d.lateFeePerDay);
  };

  const loadHistory = async () => {
    if (!userId) return;
    const d = await fetch(`${API}/api/rental-history/${userId}`).then((r) => r.json());
    setRentalHistory(d);
  };

  const loadOverdue = async () => {
    if (!userId) return;
    const d = await fetch(`${API}/api/overdue/${userId}`).then((r) => r.json());
    setOverdue(d);
  };

  const loadRecs = async () => {
    if (!userId) return;
    const d = await fetch(`${API}/api/recommendations/${userId}`).then((r) => r.json());
    setRecs(d);
  };

  // NEW: load admin rentals
  const loadAdminRentals = async () => {
    if (!isAdmin || !token) return;
    const url = `${API}/api/admin/rentals?status=${encodeURIComponent(adminFilter)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok && data && Array.isArray(data.rentals)) {
      setAdminRentals(data.rentals);
    } else {
      setAdminRentals([]);
      alert(data?.message || 'Failed to load admin rentals');
    }
  };

  useEffect(() => {
    loadBooks();
    loadSettings();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadHistory();
    loadOverdue();
    loadRecs();
  }, [userId]);

  useEffect(() => {
    if (isAdmin && token) {
      loadAdminRentals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminFilter, isAdmin, token]);

  // search + sort
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return books.filter(
      (b) => b.title.toLowerCase().includes(s) || b.author.toLowerCase().includes(s)
    );
  }, [books, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortOption === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
    if (sortOption === 'author') arr.sort((a, b) => a.author.localeCompare(b.author));
    return arr;
  }, [filtered, sortOption]);

  // actions
  const addBook = async () => {
    if (!isAdmin) return alert('Admin only');
    const title = newBook.title.trim();
    const author = newBook.author.trim();
    const stock = Number(newBook.stock || 1);
    if (!title || !author) return alert('Please enter title and author.');
    await fetch(`${API}/api/add-book`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title, author, stock }),
    }).then((r) => r.json());
    setNewBook({ title: '', author: '', stock: 1 });
    await loadBooks();
  };

  const removeBook = async (bookId, title) => {
    if (!isAdmin) return alert('Admin only');
    if (!window.confirm(`Remove "${title}"?`)) return;
    await fetch(`${API}/api/remove-book/${bookId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.json());
    await loadBooks();
  };

  const updateStock = async (bookId) => {
    if (!isAdmin) return alert('Admin only');
    const stock = Number(stockInputs[bookId] ?? 0);
    await fetch(`${API}/api/update-stock/${bookId}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ stock }),
    }).then((r) => r.json());
    await loadBooks();
  };

  const rentBook = async (bookId) => {
    const b = books.find((x) => x._id === bookId);
    if (!renterDetails.name.trim() || !renterDetails.address.trim() || !renterDetails.phone.trim()) {
      return alert('Please provide name, address, and phone number.');
    }
    const payload = {
      bookId,
      userId: userId || 'user123',
      renterName: renterDetails.name.trim(),
      renterAddress: renterDetails.address.trim(),
      renterPhone: renterDetails.phone.trim(),
      dueDate: dueDates[bookId] || null,
    };
    const res = await fetch(`${API}/api/rent-book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // public route
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Failed to rent the book');
    alert(data.message);

    setBooks((prev) =>
      prev.map((x) =>
        x._id === bookId ? { ...x, stock: Math.max(0, (x.stock || 0) - 1), isRented: (x.stock - 1) <= 0 } : x
      )
    );
    loadHistory();
    loadOverdue();
    loadRecs();
    if (isAdmin) loadAdminRentals();
  };

  const returnBook = async (bookId) => {
    const date = returnDates[bookId];
    if (!date) return alert('Please pick a return date.');
    const res = await fetch(`${API}/api/return-book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // public route
      body: JSON.stringify({ bookId, userId, returnDate: date }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Failed to return');
    alert(
      data.lateFee && data.lateFee > 0
        ? `Book returned. Late fee: ${data.lateFee}`
        : 'Book returned successfully'
    );
    setBooks((prev) =>
      prev.map((x) =>
        x._id === bookId ? { ...x, stock: (x.stock || 0) + 1, isRented: false } : x
      )
    );
    loadHistory();
    loadOverdue();
    loadRecs();
    if (isAdmin) loadAdminRentals();
  };

  const submitReview = async (bookId) => {
    const input = reviewInputs[bookId] || {};
    const rating = Number(input.rating || 0);
    const review = (input.review || '').trim();
    if (!rating || rating < 1 || rating > 5) return alert('Give a rating 1–5');
    await fetch(`${API}/api/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // public
      body: JSON.stringify({ bookId, userId, rating, review }),
    }).then((r) => r.json());
    alert('Thanks for your review!');
    await loadBooks();
    if (reviewsVisible[bookId]) await showReviews(bookId, true);
  };

  const showReviews = async (bookId, forceReload = false) => {
    setReviewsVisible((p) => ({ ...p, [bookId]: !p[bookId] }));
    if (!reviewsVisible[bookId] || forceReload) {
      const data = await fetch(`${API}/api/reviews/${bookId}`).then((r) => r.json());
      setReviewsData((p) => ({ ...p, [bookId]: data }));
    }
  };

  const updateLateFee = async () => {
    if (!isAdmin) return alert('Admin only');
    const v = Number(lateFeePerDay || 0);
    const res = await fetch(`${API}/api/late-fee`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ lateFeePerDay: v }),
    });
    const data = await res.json();
    if (!res.ok) return alert('Failed to update late fee');
    setLateFeePerDay(data.lateFeePerDay);
    alert('Late fee updated');
  };

  // UI
  return (
    <div className="book-catalog" style={{ paddingBottom: 60, maxWidth: 1140, margin: '0 auto' }}>
      <h2>Book Catalog</h2>

      {/* renter details */}
      <div className="renter-details">
        <input
          type="text"
          placeholder="Your Name"
          value={renterDetails.name}
          onChange={(e) => setRenterDetails({ ...renterDetails, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Address"
          value={renterDetails.address}
          onChange={(e) => setRenterDetails({ ...renterDetails, address: e.target.value })}
        />
        <input
          type="tel"
          placeholder="Phone Number"
          value={renterDetails.phone}
          onChange={(e) => setRenterDetails({ ...renterDetails, phone: e.target.value })}
        />
        <input
          type="text"
          placeholder="User ID (defaults to phone)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>

      {/* search/sort + admin late fee control */}
      <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by title or author"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240 }}
        />
        <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
          <option value="title">Sort by Title</option>
          <option value="author">Sort by Author</option>
        </select>

        {isAdmin && (
          <>
            <span style={{ marginLeft: 12 }}>Late Fee/Day:</span>
            <input
              type="number"
              value={lateFeePerDay}
              onChange={(e) => setLateFeePerDay(e.target.value)}
              style={{ width: 120 }}
            />
            <button onClick={updateLateFee}>Update Late Fee</button>
          </>
        )}
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3>Recommended for You</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {recs.map((r) => (
              <div key={r._id} className="book-item" style={{ width: 260 }}>
                <h4>{r.title}</h4>
                <p>by {r.author}</p>
                <small>Avg Rating: {r.avgRating || 0}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* books grid */}
      <div className="book-list">
        {sorted.map((b) => {
          const rIn = reviewInputs[b._id] || {};
          const show = reviewsVisible[b._id];
          const revs = reviewsData[b._id] || [];
          return (
            <div key={b._id} className="book-item">
              <h3>{b.title}</h3>
              <p>by {b.author}</p>
              <p className="meta">
                <span className="badge">Stock: {b.stock ?? 0}</span>
                <span className="badge">Avg Rating: {b.avgRating || 0}</span>
              </p>

              {/* optional due date when renting */}
              <input
                type="date"
                value={dueDates[b._id] || ''}
                onChange={(e) => setDueDateFor(b._id, e.target.value)}
                style={{ marginBottom: 6 }}
              />

              <div className="btn-row">
                <button onClick={() => rentBook(b._id)} disabled={(b.stock ?? 0) <= 0}>
                  {b.stock <= 0 ? 'Out of Stock' : 'Rent This Book'}
                </button>
              </div>

              {/* Return with custom date */}
              <div className="btn-row">
                <input
                  type="date"
                  value={returnDates[b._id] || ''}
                  onChange={(e) => setReturnDateFor(b._id, e.target.value)}
                />
                <button onClick={() => returnBook(b._id)}>Return Book</button>
              </div>

              {/* Admin actions */}
              {isAdmin && (
                <>
                  <div className="btn-row">
                    <button className="btn-danger" onClick={() => removeBook(b._id, b.title)}>
                      Remove Book
                    </button>
                  </div>
                  <div className="btn-row">
                    <input
                      type="number"
                      value={stockInputs[b._id] ?? b.stock ?? 0}
                      onChange={(e) =>
                        setStockInputs((p) => ({ ...p, [b._id]: e.target.value }))
                      }
                      style={{ width: 80 }}
                    />
                    <button onClick={() => updateStock(b._id)}>Update Stock</button>
                  </div>
                </>
              )}

              {/* Review/Rating */}
              <div style={{ marginTop: 10 }}>
                <div style={{ marginBottom: 6 }}>
                  <select
                    value={rIn.rating || ''}
                    onChange={(e) =>
                      setReviewInputs((p) => ({
                        ...p,
                        [b._id]: { ...(p[b._id] || {}), rating: e.target.value },
                      }))
                    }
                  >
                    <option value="">Rate…</option>
                    <option value="1">1 ★</option>
                    <option value="2">2 ★★</option>
                    <option value="3">3 ★★★</option>
                    <option value="4">4 ★★★★</option>
                    <option value="5">5 ★★★★★</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  placeholder="Write a short review…"
                  value={rIn.review || ''}
                  onChange={(e) =>
                    setReviewInputs((p) => ({
                      ...p,
                      [b._id]: { ...(p[b._id] || {}), review: e.target.value },
                    }))
                  }
                />
                <div className="btn-row">
                  <button onClick={() => submitReview(b._id)}>Submit Review</button>
                  <button className="btn-outline" onClick={() => showReviews(b._id)}>
                    {show ? 'Hide Reviews' : 'Show Reviews'}
                  </button>
                </div>

                {show && (
                  <div style={{ marginTop: 6 }}>
                    {revs.length === 0 ? (
                      <small>No reviews yet.</small>
                    ) : (
                      revs.map((rv) => (
                        <div key={rv._id} style={{ borderTop: '1px solid #ddd', paddingTop: 6 }}>
                          <div>
                            <strong>{rv.renterName || rv.userId}</strong> — {rv.rating || 0}★
                          </div>
                          <div>{rv.review}</div>
                          <small>
                            Rented:{' '}
                            {rv.rentalDate ? new Date(rv.rentalDate).toLocaleDateString() : '-'}
                            {rv.returnDate && ` | Returned: ${new Date(rv.returnDate).toLocaleDateString()}`}
                          </small>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* History (manual for current user) */}
      <div style={{ marginTop: 24 }}>
        <button onClick={loadHistory}>View Rental History</button>
        {rentalHistory.length > 0 && (
          <div className="rental-history" style={{ marginTop: 10 }}>
            <h3>Rental History</h3>
            {rentalHistory.map((r) => (
              <div key={r._id} style={{ borderTop: '1px solid #eee', paddingTop: 6 }}>
                <p>
                  <strong>{r.bookTitle}</strong> — rented on{' '}
                  {r.rentalDate ? new Date(r.rentalDate).toLocaleDateString() : '-'}
                </p>
                <p>
                  Due: {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'} | Returned:{' '}
                  {r.returned ? new Date(r.returnDate).toLocaleDateString() : 'Not returned yet'}
                </p>
                {r.lateFeeCharged > 0 && <p>Late fee paid: {r.lateFeeCharged}</p>}
                {r.renterName && (
                  <p>
                    Rented by: {r.renterName} | {r.renterAddress} | {r.renterPhone}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue (for current user) */}
      <div style={{ marginTop: 24 }}>
        <h3>Overdue Books (Reminders)</h3>
        {overdue.length === 0 ? (
          <p>No overdue books at the moment.</p>
        ) : (
          overdue.map((o) => (
            <div key={o._id}>
              <p>
                <strong>{o.bookTitle}</strong> — due{' '}
                {o.dueDate ? new Date(o.dueDate).toLocaleDateString() : '-'}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Add new book (Admin only) */}
      {isAdmin && (
        <div className="add-book" style={{ marginTop: 24 }}>
          <h3>Add a New Book</h3>
          <div className="form-row">
            <input
              type="text"
              placeholder="Book Title"
              value={newBook.title}
              onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
            />
            <input
              type="text"
              placeholder="Author"
              value={newBook.author}
              onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
            />
            <input
              type="number"
              placeholder="Stock"
              value={newBook.stock}
              onChange={(e) => setNewBook({ ...newBook, stock: e.target.value })}
            />
            <button onClick={addBook}>Add Book</button>
          </div>
        </div>
      )}

      {/* ============== NEW: Admin Rentals Dashboard ============== */}
      {isAdmin && (
        <div className="admin-panel" style={{ marginTop: 24 }}>
          <h3>Admin • All Rentals</h3>
          <div className="form-row" style={{ alignItems: 'center' }}>
            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              style={{ maxWidth: 220 }}
            >
              <option value="open">Open (Not Returned)</option>
              <option value="returned">Returned</option>
              <option value="all">All</option>
            </select>
            <button onClick={loadAdminRentals}>Refresh</button>
          </div>

          {adminRentals.length === 0 ? (
            <p style={{ marginTop: 10 }}>No records.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: 10, textAlign: 'left' }}>Book</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Renter</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Phone</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Rented On</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Due</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Returned?</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Return Date</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Late Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {adminRentals.map((r) => {
                    const rentedOn = r.rentalDate ? new Date(r.rentalDate).toLocaleDateString() : '—';
                    const due = r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—';
                    const ret = r.returned ? 'Yes' : 'No';
                    const retDate = r.returned && r.returnDate
                      ? new Date(r.returnDate).toLocaleDateString()
                      : '—';
                    const fee = r.returned
                      ? r.lateFeeCharged || 0
                      : r.lateFeeDueNow || 0;
                    return (
                      <tr key={r._id}>
                        <td style={{ padding: 10 }}>{r.bookTitle}</td>
                        <td style={{ padding: 10 }}>{r.renterName}</td>
                        <td style={{ padding: 10 }}>{r.renterPhone}</td>
                        <td style={{ padding: 10 }}>{rentedOn}</td>
                        <td style={{ padding: 10 }}>{due}</td>
                        <td style={{ padding: 10 }}>{ret}</td>
                        <td style={{ padding: 10 }}>{retDate}</td>
                        <td style={{ padding: 10 }}>{fee}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
