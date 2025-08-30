import React, { useState } from 'react';

const AdminDashboard = () => {
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');

  const addBook = () => {
    fetch('http://localhost:5000/api/add-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: bookTitle, author: bookAuthor }),
    })
      .then((response) => response.json())
      .then((data) => alert(data.message))
      .catch((error) => alert('Failed to add book'));
  };

  const removeBook = (bookId) => {
    fetch(`http://localhost:5000/api/remove-book/${bookId}`, {
      method: 'DELETE',
    })
      .then((response) => response.json())
      .then((data) => alert(data.message))
      .catch((error) => alert('Failed to remove book'));
  };

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      <input 
        type="text" 
        placeholder="Book Title" 
        value={bookTitle} 
        onChange={(e) => setBookTitle(e.target.value)} 
      />
      <input 
        type="text" 
        placeholder="Book Author" 
        value={bookAuthor} 
        onChange={(e) => setBookAuthor(e.target.value)} 
      />
      <button onClick={addBook}>Add Book</button>
      <button onClick={() => removeBook('bookId123')}>Remove Book</button>
    </div>
  );
};

export default AdminDashboard;
