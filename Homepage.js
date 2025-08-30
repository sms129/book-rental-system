import React from 'react';
import './Homepage.css';
import { useHistory } from 'react-router-dom'; // For navigation

const Homepage = () => {
  const history = useHistory();

  const goToCatalog = () => {
    history.push('/book-catalog');
  };

  return (
    <div className="home-container">
      <h1>Welcome to the Book Rental System</h1>
      <p>Browse our collection of books and rent your favorites!</p>
      <button className="explore-button" onClick={goToCatalog}>
        Explore Books
      </button>
    </div>
  );
};

export default Homepage;
