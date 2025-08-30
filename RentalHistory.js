import React, { useState, useEffect } from 'react';

const RentalHistory = ({ userId }) => {
  const [rentals, setRentals] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:5000/api/rental-history/${userId}`)
      .then((response) => response.json())
      .then((data) => setRentals(data))
      .catch((error) => console.error('Error fetching rental history:', error));
  }, [userId]);

  return (
    <div className="rental-history">
      <h2>Your Rental History</h2>
      <ul>
        {rentals.map((rental) => (
          <li key={rental._id}>
            Book: {rental.bookTitle}, Rented on: {rental.rentalDate}, Return by: {rental.returnDate}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RentalHistory;
