import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import BackToHome from "../components/BackToHome";
import api from "../utils/api";
import AddToCartButton from "../components/AddToCartButton";
import Pagination from "../components/Pagination";
import ProductGridSkeleton from "../components/ProductGridSkeleton";

const ITEMS_PER_PAGE = 20;

const PantryPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let ignore = false;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(
          `/products?category=Pantry&page=${page}&limit=${ITEMS_PER_PAGE}`
        );

        if (ignore) return;

        const list = Array.isArray(data) ? data : data?.products || [];
        setProducts(list);
        setTotal(Array.isArray(data) ? list.length : data?.total ?? list.length);
        setTotalPages(Array.isArray(data) ? 1 : data?.totalPages || 1);
      } catch (err) {
        if (ignore) return;
        console.error("Error fetching products:", err);
        setProducts([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      ignore = true;
    };
  }, [page]);

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="w-full py-8 px-4 md:px-8 lg:px-16 bg-cream min-h-screen">
      <BackToHome className="mb-4" />
      <h2 className="text-2xl md:text-3xl font-bold text-gradient-green mb-2 capitalize">
        Pantry
      </h2>
      <div className="w-14 h-1 rounded-full bg-primary-600 mb-6"></div>

      {loading ? (
        <ProductGridSkeleton />
      ) : products.length === 0 ? (
        <p className="text-center text-gray-600">
          No products found in this category.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {products.map((product) => (
              <div
                key={product._id}
                className="border border-gray-100 rounded-lg shadow-sm hover:shadow-lg transition p-3 sm:p-4 bg-white flex flex-col card-hover"
              >
                <Link to={`/products/${product.slug}`}>
                  <img
                    src={
                      product.image ||
                      "/images/placeholder.jpg"
                    }
                    alt={product.name}
                    loading="lazy"
                    onError={(e) =>
                      (e.target.src = "/images/placeholder.jpg")
                    }
                    className="w-full h-32 object-cover rounded-md"
                  />
                </Link>
                <Link to={`/products/${product.slug}`}>
                  <h3 className="mt-3 text-primary-800 font-semibold truncate hover:underline">
                    {product.name}
                  </h3>
                </Link>
                <p className="text-sm text-gray-600">£{Number(product.price).toFixed(2)}</p>
                <AddToCartButton product={product} />
              </div>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            total={total}
            pageSize={ITEMS_PER_PAGE}
          />
        </>
      )}
    </section>
  );
};

export default PantryPage;
