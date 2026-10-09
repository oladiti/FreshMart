import React from "react";

const FreshMartBanner = () => {
  return (
    <section className="relative overflow-hidden bg-leaf text-white">
      <div className="mx-auto grid min-h-[430px] max-w-7xl grid-cols-1 px-4 sm:px-6 lg:grid-cols-[34%_33%_33%] lg:px-10">

        {/* Left: Grocery Image */}
        <div className="relative min-h-[280px] overflow-hidden lg:min-h-[430px]">
          <img
            src="/images/banner.png"
            alt="Fresh groceries"
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Image overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-leaf" />

          <div className="absolute bottom-6 left-6 rounded-full bg-white px-5 py-2 text-sm font-bold text-leaf shadow-lg">
            100% Fresh Choices
          </div>
        </div>

        {/* Centre: Main Message */}
        <div className="relative flex flex-col justify-center px-7 py-10 sm:px-10 lg:px-8">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-lime-300">
            Welcome to FreshMart
          </p>

          <h1 className="max-w-xl text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl lg:text-4xl xl:text-5xl">
            Fresh Groceries.
            <br />
            <span className="text-lime-300">
              Delivered Fast.
            </span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-7 text-green-50 sm:text-lg">
            Shop your everyday groceries online and get fresh products
            delivered conveniently to your doorstep.
          </p>

          <a
            href="/shop"
            className="mt-7 inline-flex w-fit items-center rounded-full bg-lime-400 px-7 py-3.5 font-bold text-leaf-deep transition hover:bg-lime-300"
          >
            Shop FreshMart
            <span className="ml-2 text-xl">→</span>
          </a>
        </div>

        {/* Right: Delivery Information */}
        <div className="flex flex-col justify-center bg-cream px-7 py-10 text-leaf sm:px-10 lg:px-8">
          <h2 className="text-2xl font-black sm:text-3xl">
            Easy Online Shopping
          </h2>

          <div className="mt-7 space-y-6">

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf text-lg text-lime-300">
                ✓
              </div>

              <div>
                <h3 className="font-bold">
                  Fresh Products
                </h3>
                <p className="mt-1 text-sm leading-5 text-gray-700">
                  Quality groceries selected for your everyday needs.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf text-lg text-lime-300">
                ✓
              </div>

              <div>
                <h3 className="font-bold">
                  Convenient Delivery
                </h3>
                <p className="mt-1 text-sm leading-5 text-gray-700">
                  Place your order online and have it delivered to your door.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf text-lg text-lime-300">
                ✓
              </div>

              <div>
                <h3 className="font-bold">
                  Secure Checkout
                </h3>
                <p className="mt-1 text-sm leading-5 text-gray-700">
                  Add your groceries to cart and pay securely online.
                </p>
              </div>
            </div>

          </div>

          <div className="mt-7 border-t border-leaf/20 pt-5">
            <p className="text-xs font-bold uppercase tracking-wider">
              FreshMart
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Your everyday grocery store, online.
            </p>
          </div>
        </div>
      </div>

      {/* Decorative bottom strip */}
      <div className="h-3 bg-lime-400" />
    </section>
  );
};

export default FreshMartBanner;