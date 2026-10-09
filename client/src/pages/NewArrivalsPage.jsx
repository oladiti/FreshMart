// pages/NewArrivalsPage.jsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";
import ProductCard from "../components/ProductCard";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function NewArrivalsPage() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(12);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      try {
        const { data } = await api.get("/products/new");
        let apiProducts = [];

        if (Array.isArray(data)) {
          apiProducts = data;
        } else if (data.products && Array.isArray(data.products)) {
          apiProducts = data.products;
        }

        //  Use products as-is, no duplicates
        setProducts(apiProducts);
        setStatus("success");
      } catch (err) {
        console.error("Failed to load new arrivals:", err.message);
        setStatus("error");
      }
    };

    fetchNewArrivals();
  }, []);

  // Pagination logic
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(products.length / productsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const prevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      if (currentPage <= 3) {
        pageNumbers.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pageNumbers.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pageNumbers;
  };

  // Loading
  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-600">Loading new arrivals...</span>
      </div>
    );
  }

  // Error
  if (status === "error") {
    return (
      <div className="text-center py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-rose-700 font-medium">Failed to load new arrivals</p>
          <p className="text-rose-600 text-sm mt-2">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Back to home
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
           All New Arrivals
        </h1>
        <p className="text-gray-600">
          Discover our complete collection of latest products
        </p>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No new arrivals available at the moment.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {currentProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
              {/* Products count */}
              <div className="text-sm text-gray-600 text-center sm:text-left">
                Showing {indexOfFirstProduct + 1}-
                {Math.min(indexOfLastProduct, products.length)} of {products.length} products
              </div>

              {/* Page controls */}
              <div className="flex flex-col items-center space-y-3 sm:flex-row sm:space-y-0 sm:space-x-2">
                {/* Prev */}
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1 transition-colors ${
                    currentPage === 1
                      ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  <ArrowLeft size={16} /> <span className="hidden sm:inline">Previous</span>
                </button>

                {/* Numbers */}
                <div className="flex space-x-1">
                  {getPageNumbers().map((number, index) => (
                    <button
                      key={index}
                      onClick={() => typeof number === "number" && paginate(number)}
                      className={`min-w-[40px] px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        number === currentPage
                          ? "bg-primary-600 text-white border-primary-600"
                          : typeof number === "number"
                          ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                          : "bg-white text-gray-500 border-gray-300 cursor-default"
                      }`}
                      disabled={number === "..."}
                    >
                      {number}
                    </button>
                  ))}
                </div>

                {/* Next */}
                <button
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1 transition-colors ${
                    currentPage === totalPages
                      ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  <span className="hidden sm:inline">Next</span> <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
