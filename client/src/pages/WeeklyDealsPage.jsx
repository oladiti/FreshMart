import React, { useEffect, useState, useContext } from "react";
import { CartContext } from "../context/CartContext";
import WeeklyDealCard from "../components/WeeklyDealCard";
import BackToHome from "../components/BackToHome";
import api from "../utils/api";

const WeeklyDealsPage = () => {
  const { totalItems } = useContext(CartContext);
  const [deals, setDeals] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const { data } = await api.get(
          `/products/weekly-deals?page=${page}&limit=20`
        );
        setDeals(Array.isArray(data) ? data : data?.deals || []);
        setTotalPages(data?.totalPages || 1);
      } catch (error) {
        console.error(" Failed to fetch deals:", error);
        setDeals([]);
      }
    };
    fetchDeals();
  }, [page]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <BackToHome className="mb-6" />
      <h2 className="text-3xl font-bold text-gradient-green mb-2 text-center">
         Weekly Deals
      </h2>
      <div className="w-16 h-1.5 mx-auto mb-6 rounded-full bg-gradient-to-r from-amber-400 to-primary-500"></div>

      {/* Grid of weekly deals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {deals.length > 0 ? (
          deals.map((deal) => (
            <WeeklyDealCard key={deal._id} product={deal} />
          ))
        ) : (
          <p className="text-gray-500 col-span-full text-center">
            No weekly deals found
          </p>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-center mt-8 space-x-4">
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-3 py-2 bg-gray-100 rounded">Page {page}</span>
        <button
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          disabled={page >= totalPages}
          className="px-4 py-2 bg-primary-600 text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Floating Cart Summary */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 right-4 bg-primary-600 text-white px-4 py-3 rounded-full shadow-lg flex items-center space-x-2">
          <span className="font-bold">{totalItems}</span>
          <span>Items in Cart</span>
        </div>
      )}
    </div>
  );
};

export default WeeklyDealsPage;
