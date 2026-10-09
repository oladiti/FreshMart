import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import BackToHome from "../components/BackToHome";
import api from "../utils/api";

const DEFAULT_VISIBLE = 3;

export default function OrdersPage() {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setShowAll(false);

    const fetchOrders = async () => {
      try {
        const { data } = await api.get("/orders/myorders");
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-gray-600 mb-4">You must be logged in to view your orders.</p>
        <Link
          to="/login"
          className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg shadow-md shadow-primary-600/20"
        >
          Login
        </Link>
      </div>
    );
  }

  const hasMore = orders.length > DEFAULT_VISIBLE;
  const visibleOrders = showAll ? orders : orders.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <BackToHome className="mb-6" />
      <h1 className="text-3xl font-bold mb-6 text-gradient-green">My Orders</h1>

      {loading && <p className="text-gray-600">Loading orders...</p>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 p-6 rounded-xl text-center">
          <p className="text-gray-600">You have no orders yet.</p>
          <Link
            to="/shop"
            className="inline-block mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-md shadow-primary-600/20 transition"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <ul id="orders-list" className="space-y-4">
          {visibleOrders.map((order) => (
            <li
              key={order._id}
              className="bg-white shadow-sm p-4 rounded-lg border border-gray-100 card-hover"
            >
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="font-semibold text-gray-800">
                    Order #{order._id.slice(-8)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full uppercase ${
                    order.status === "delivered"
                      ? "bg-success-soft text-success"
                      : order.status === "paid"
                      ? "bg-blue-100 text-blue-700"
                      : order.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {order.status}
                </span>
              </div>

              <div className="space-y-1">
                {order.items &&
                  order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm text-gray-600"
                    >
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>£{Number(item.price).toFixed(2)}</span>
                    </div>
                  ))}
              </div>

              <div className="border-t border-gray-200 mt-3 pt-2 flex justify-between font-bold text-gray-800">
                <span>Total</span>
                <span className="text-primary-700">
                  £{Number(order.total_amount).toFixed(2)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            aria-expanded={showAll}
            aria-controls="orders-list"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-full shadow-md shadow-primary-600/20 transition"
          >
            {showAll
              ? "Show less"
              : `Show ${orders.length - DEFAULT_VISIBLE} more order${
                  orders.length - DEFAULT_VISIBLE === 1 ? "" : "s"
                }`}
            {showAll ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
