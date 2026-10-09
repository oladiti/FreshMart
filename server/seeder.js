// server/seeder.js
import dotenv from "dotenv";
import readline from "readline";
import Product from "./models/Product.js";
import User from "./models/User.js";
import Recipe from "./models/Recipe.js";
import connectDB from "./config/db.js";

dotenv.config();

// Canonical admin identity for this project. The single source of truth for the
// admin account -- e2e-seed.js deliberately does not create its own.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@freshmart.com";

// Accounts seeder.js owns: --reset deletes these and importData() rebuilds them
// in the same run, so the database is never left without them.
const SEEDED_USER_EMAILS = ["demo@example.com", ADMIN_EMAIL];

// Accounts left behind by retired seed logic. --reset purges these and does NOT
// rebuild them. e2e-seed.js once created its own admin here, which left the
// database with two admin accounts holding different passwords.
const LEGACY_USER_EMAILS = ["admin@e2e.test.com"];

// NOTE: e2e@test.com is deliberately not listed anywhere above. It belongs to
// e2e-seed.js ("npm run seed:e2e"), which seeder.js cannot rebuild. Deleting it
// here would strip the Playwright suite of its login account until e2e-seed ran.

// ✅ Helper function to generate random stock
const randomStock = (min = 10, max = 200) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// // ✅ Base Products
const extraProducts = [
  // fruits
  { name: "Organic Apples", description: "Fresh organic apples, crisp and juicy.", price: 3.99, category: "Fruits", countInStock: randomStock(), isWeeklyDeal: true, image: "/images/Apples.png" },
  { name: "Bananas", description: "Sweet ripe bananas, perfect for smoothies.", price: 1.29, category: "Fruits", countInStock: randomStock(), isWeeklyDeal: true, image: "/images/Banana.jpeg" },
  { name: "Oranges", description: "Citrusy and refreshing oranges.", price: 2.49, category: "Fruits", countInStock: randomStock(), image: "/images/Oranges.jpeg" },
  { name: "Strawberries", description: "Fresh red strawberries.", price: 4.99, category: "Fruits", countInStock: randomStock(), image: "/images/strawberries.jpeg" },
  { name: "Grapes", description: "Sweet seedless grapes.", price: 3.5, category: "Fruits", countInStock: randomStock(), image: "/images/grapes.webp" },
  { name: "Mangoes", description: "Tropical sweet mangoes.", price: 2.99, category: "Fruits", image: "/images/mangoes.jpeg", countInStock: randomStock() },
  { name: "Pineapple", description: "Juicy ripe pineapple.", price: 3.49, category: "Fruits", image: "/images/pineapple.jpeg", countInStock: randomStock() },
  { name: "Avocado", description: "Creamy avocados, great for toast.", price: 1.89, category: "Fruit", image: "/images/Avocado.jpeg", countInStock: randomStock() },
  { name: "Blueberries", description: "Fresh blueberries.", price: 5.99, category: "Fruits", image: "/images/blueberries.jpeg", countInStock: randomStock() },
  //dairy
  { name: "Whole Milk 1L", description: "Fresh full cream milk.", price: 1.29, category: "Dairy", image: "/images/Milk.jpeg", countInStock: randomStock() },
  { name: "Cheddar Cheese 200g", description: "Mature cheddar cheese block.", price: 3.99, category: "Dairy", image: "/images/cheddar.jpeg", countInStock: randomStock() },
  { name: "Greek Yogurt 500g", description: "Thick and creamy yogurt.", price: 2.79, category: "Dairy", image: "/images/greek-yogurt.jpeg", countInStock: randomStock() },
  { name: "Butter 250g", description: "Creamy salted butter.", price: 2.49, category: "Dairy", image: "/images/Butter.jpeg", countInStock: randomStock() },
  { name: "Eggs (dozen)", description: "Free-range chicken eggs.", price: 2.99, category: "Dairy", image: "/images/eggs.png", countInStock: randomStock() },
  // vegetables
  { name: "Spinach", description: "Fresh green spinach leaves.", price: 2.5, category: "Vegetables", image: "/images/fresh-spinach.webp", countInStock: randomStock() },
  { name: "oha", description: "Fresh oha leaves, perfect for oha soup.", price: 1.79, category: "Vegetables", image: "/images/fresh-oha-leaves.webp", countInStock: randomStock() },
  { name: "soko leaves", description: "Fresh soko leaves, a nutritious green.", price: 2.99, category: "Vegetables", image: "/images/fresh-soko-leaves.webp", countInStock: randomStock() },
  { name: "ewedu", description: "Fresh ewedu leaves, great for soups.", price: 1.49, category: "Vegetables", image: "/images/frozen-ewedu.webp", countInStock: randomStock() },
  
  { name: "efo", description: "Fresh green spinach leaves.", price: 2.5, category: "Vegetables", image: "/images/efo-tete.webp", countInStock: randomStock() },
  { name: "20 bunch of spinach", description: "A bulk bunch of fresh spinach.", price: 1.79, category: "Vegetables", image: "/images/20-bunch-of-spinash.webp", countInStock: randomStock() },
  { name: "water leaf", description: "Fresh water leaves, ideal for stews.", price: 2.99, category: "Vegetables", image: "/images/waterLeaf.webp", countInStock: randomStock() },
  { name: "Onions", description: "Red onions, full of flavor.", price: 1.49, category: "Vegetables", image: "/images/onions.jpeg", countInStock: randomStock() },

  { name: "Carrots", description: "Crunchy fresh carrots.", price: 1.79, category: "Vegetables", image: "/images/carrots.jpg", countInStock: randomStock() },
  { name: "Broccoli", description: "Nutritious broccoli florets.", price: 2.99, category: "Vegetables", image: "/images/broccoli.jpg", countInStock: randomStock() },
  { name: "Tomatoes", description: "Fresh juicy tomatoes.", price: 2.49, category: "Vegetables", image: "/images/tomatoes.jpg", countInStock: randomStock() },
  { name: "Potatoes", description: "Versatile potatoes, 1kg bag.", price: 2.99, category: "Vegetables", image: "/images/potatoes.jpg", countInStock: randomStock() },
  { name: "Cucumbers", description: "Cool and crisp cucumbers.", price: 1.29, category: "Vegetables", image: "/images/cucumbers.jpg", countInStock: randomStock() },
  


];

// ✅ New Arrivals
const newArrivals = [
  { name: "Easy Naija Green Pepper Sauce (Ayamase) 500g", price: 7.99, description: "Spicy green pepper sauce from Naija", category: "Ethnic Food", image: "/images/green-pepper-sauce.jpg", countInStock: randomStock(5, 50), isNewArrival: true },
  { name: "Easy Naija Buka Stew 500g", price: 7.99, description: "Classic buka stew, ready to eat", category: "Ethnic Food", image: "/images/buka-stew.jpg", countInStock: randomStock(5, 50), isNewArrival: true },
  { name: "Easy Naija Ewa Agoyin Sauce 500g", price: 7.99, description: "Rich beans sauce, Nigerian style", category: "Ethnic Food", image: "/images/ewa-agoyin.jpg", countInStock: randomStock(5, 50), isNewArrival: true },
  { name: "Costack Yaji (Suya Pepper) 362G", price: 11.99, description: "Traditional suya pepper mix", category: "Spices", image: "/images/suya-pepper.jpg", countInStock: randomStock(10, 30), isNewArrival: true },
  { name: "Fresh Yam (per kilo, NOT per tuber)", price: 3.99, description: "Fresh yam, sold by weight", category: "Vegetables", image: "/images/fresh-yam.jpg", countInStock: randomStock(30, 70), isNewArrival: true },
  { name: "Lobster Tail (each)", price: 9.99, description: "Premium lobster tail", category: "Fish", image: "/images/lobster-tail.jpg", countInStock: 0, isNewArrival: true }, // sold out
];

// ✅ Weekly Deals
const weeklyDeals = [
  { name: "Golden Plantain Chips 200g", price: 2.99, description: "Crispy and sweet plantain chips", category: "Snacks", image: "/images/plantain-chips.jpg", countInStock: randomStock(20, 60), isWeeklyDeal: true },
  { name: "Frozen Tilapia (whole fish)", price: 5.99, description: "Fresh frozen tilapia fish", category: "Fish", image: "/images/frozen-tilapia.jpg", countInStock: randomStock(20, 50), isWeeklyDeal: true },
  { name: "Palm Oil 1L", price: 6.49, description: "Pure red palm oil, perfect for stews", category: "Cooking Oil", image: "/images/palm-oil.jpg", countInStock: randomStock(10, 40), isWeeklyDeal: true },
];

// ✅ More 50 Products
const products = [

 


  // Dairy
  

  

  // Meat
  { name: "Chicken Breast 1kg", description: "Lean chicken breast fillets.", price: 7.99, category: "Meat", image: "/images/chicken-drumsticks.webp", countInStock: randomStock() },
  { name: "Beef Mince 500g", description: "Fresh minced beef.", price: 6.49, category: "Meat", image: "/images/beef-mince.jpg", countInStock: randomStock() },
  { name: "Pork Chops 1kg", description: "Juicy pork chops.", price: 8.49, category: "Meat", image: "/images/pork-chops.jpg", countInStock: randomStock() },
  { name: "Lamb Leg 1kg", description: "Tender lamb leg.", price: 12.99, category: "Meat", image: "/images/lamb-leg.jpg", countInStock: randomStock() },
  

  // Beverages
  { name: "Orange Juice 1L", description: "Fresh squeezed orange juice.", price: 2.99, category: "Beverages", image: "/images/orange-juice.jpg", countInStock: randomStock() },
  { name: "Cola 2L", description: "Classic refreshing cola.", price: 1.49, category: "Beverages", image: "/images/cola.jpg", countInStock: randomStock() },
  { name: "Green Tea 20 bags", description: "Healthy green tea bags.", price: 2.99, category: "Beverages", image: "/images/green-tea.jpg", countInStock: randomStock() },
  { name: "Coffee 200g", description: "Premium ground coffee.", price: 4.99, category: "Beverages", image: "/images/coffee.jpg", countInStock: randomStock() },
  
  // Snacks
  { name: "Chocolate Bar", description: "Milk chocolate bar.", price: 0.99, category: "Snacks", image: "/images/chocolate.jpg", countInStock: randomStock() },
  { name: "Salted Peanuts 200g", description: "Crunchy roasted peanuts.", price: 2.29, category: "Snacks", image: "/images/peanuts.jpg", countInStock: randomStock() },
  { name: "Popcorn 100g", description: "Buttery popcorn snack.", price: 1.49, category: "Snacks", image: "/images/popcorn.jpg", countInStock: randomStock() },
  { name: "Biscuits 300g", description: "Crunchy tea biscuits.", price: 2.49, category: "Snacks", image: "/images/biscuits.jpg", countInStock: randomStock() },
  { name: "Crisps 150g", description: "Classic potato crisps.", price: 1.99, category: "Snacks", image: "/images/crisps.jpg", countInStock: randomStock() },

  // Pantry
  { name: "Rice 5kg", description: "Long grain rice bag.", price: 12.99, category: "Pantry", image: "/images/rice.jpeg", countInStock: randomStock() },
  { name: "Pasta 500g", description: "Durum wheat pasta pack.", price: 1.49, category: "Pantry", image: "/images/pasta.jpeg", countInStock: randomStock() },
  { name: "Canned Beans 400g", description: "Canned baked beans.", price: 0.99, category: "Pantry", image: "/images/canned-beans.jpeg", countInStock: randomStock() },
  { name: "Canned Tuna 200g", description: "Tuna chunks in brine.", price: 2.49, category: "Pantry", image: "/images/canned-tuna.jpeg", countInStock: randomStock() },
  { name: "Flour 1kg", description: "All-purpose flour.", price: 1.89, category: "Pantry", image: "/images/flour.jpg", countInStock: randomStock() },
  { name: "Sugar 1kg", description: "Granulated white sugar.", price: 1.29, category: "Pantry", image: "/images/sugar.jpg", countInStock: randomStock() },
  { name: "Salt 500g", description: "Refined table salt.", price: 0.79, category: "Pantry", image: "/images/salt.jpg", countInStock: randomStock() },
  { name: "Cooking Oil 1Ltr", description: "Vegetable cooking oil.", price: 3.49, category: "Pantry", image: "/images/cooking-oil.jpg", countInStock: randomStock() },
  { name: "Vinegar 500ml", description: "White distilled vinegar.", price: 1.99, category: "Pantry", image: "/images/vinegar.jpeg", countInStock: randomStock() },
  { name: "Honey 250g", description: "Natural honey jar.", price: 4.99, category: "Pantry", image: "/images/honey.jpg", countInStock: randomStock() },
  { name: "Jam 300g", description: "Strawberry fruit jam.", price: 2.99, category: "Pantry", image: "/images/jam.jpg", countInStock: randomStock() },
  { name: "Peanut Butter 500g", description: "Creamy peanut butter.", price: 3.49, category: "Pantry", image: "/images/peanut-butter.jpg", countInStock: randomStock() },
  { name: "Tea Bags 100 count", description: "Black tea bags.", price: 3.99, category: "Beverages", image: "/images/tea-bags.jpg", countInStock: randomStock() },
  { name: "Coffee Beans 500g", description: "Whole coffee beans.", price: 6.99, category: "Beverages", image: "/images/coffee-beans.jpg", countInStock: randomStock() },
  { name: "Cereal 500g", description: "Breakfast cereal box.", price: 2.99, category: "Pantry", image: "/images/cereal.jpg", countInStock: randomStock() },
  { name: "Oats 1kg", description: "Rolled oats pack.", price: 2.49, category: "Pantry", image: "/images/oats.jpeg", countInStock: randomStock() },
  { name: "Maple Syrup 250ml", description: "Pure maple syrup.", price: 5.99, category: "Pantry", image: "/images/maplesyrup.jpg", countInStock: randomStock() },
  { name: "Cocoa Powder 200g", description: "Unsweetened cocoa powder.", price: 3.49, category: "Pantry", image: "/images/cocoa-powder.jpg", countInStock: randomStock() },
  { name: "Baking Powder 100g", description: "Leavening agent for baking.", price: 1.99, category: "Pantry", image: "/images/baking-powder.jpeg", countInStock: randomStock() },
  { name: "Yeast 100g", description: "Active dry yeast.", price: 1.49, category: "Pantry", image: "/images/yeast.jpeg", countInStock: randomStock() },
  { name: "Chocolate Chips 200g", description: "Semi-sweet chocolate chips.", price: 2.99, category: "Pantry", image: "/images/chocolate-chips.jpeg", countInStock: randomStock() },
  { name: "Almonds 200g", description: "Raw whole almonds.", price: 4.99, category: "Snacks", image: "/images/almonds.jpg", countInStock: randomStock() },
  { name: "Walnuts 200g", description: "Shelled walnuts.", price: 5.49, category: "Snacks", image: "/images/walnuts.jpg", countInStock: randomStock() },
  { name: "Cashews 200g", description: "Roasted cashew nuts.", price: 5.99, category: "Snacks", image: "/images/cashews.jpg", countInStock: randomStock() },
  { name: "Sunflower Seeds 200g", description: "Roasted sunflower seeds.", price: 2.99, category: "Snacks", image: "/images/sunflower-seeds.jpg", countInStock: randomStock() },
  { name: "Chia Seeds 200g", description: "Nutrient-rich chia seeds.", price: 3.99, category: "Snacks", image: "/images/chia-seeds.jpg", countInStock: randomStock() },
  { name: "Olive Oil 1L", description: "Extra virgin olive oil.", price: 9.99, category: "Cooking Oil", image: "/images/olive-oil.jpg", countInStock: randomStock() },
  { name: "Canola Oil 1L", description: "Healthy canola cooking oil.", price: 4.49, category: "Cooking Oil", image: "/images/canola-oil.jpg", countInStock: randomStock() },
  { name: "Sunflower Oil 1L", description: "Light sunflower cooking oil.", price: 4.29, category: "Cooking Oil", image: "/images/sunflower-oil.jpg", countInStock: randomStock() },
  { name: "Sesame Oil 500ml", description: "Aromatic sesame oil.", price: 6.99, category: "Cooking Oil", image: "/images/sesame-oil.jpg", countInStock: randomStock() },
  { name: "Soy Sauce 500ml", description: "Dark soy sauce bottle.", price: 2.99, category: "Cooking Essentials", image: "/images/soy-sauce.jpg", countInStock: randomStock() },
  { name: "Vinegar 1L", description: "White vinegar bottle.", price: 1.99, category: "Cooking Essentials", image: "/images/vinegar-1l.jpg", countInStock: randomStock() },
  { name: "Baking Soda 500g", description: "Multi-purpose baking soda.", price: 1.49, category: "Cooking Essentials", image: "/images/baking-soda.jpg", countInStock: randomStock() },
  { name: "Cornstarch 400g", description: "Pure cornstarchh for thickening.", price: 1.99, category: "Cooking Essentials", image: "/images/cornstarch.jpg", countInStock: randomStock() },
  { name: "Garlic 1 bulb", description: "Fresh garlic bulb.", price: 0.5, category: "Cooking Essentials", image: "/images/garlic.jpg", countInStock: randomStock() },
  { name: "Ginger 100g", description: "Fresh ginger root.", price: 0.99, category: "Cooking Essentials", image: "/images/ginger.jpg", countInStock: randomStock() },
  { name: "Onion Powder 100g", description: "Dried onion powder.", price: 1.99, category: "Cooking Essentials", image: "/images/onion-powder.jpg", countInStock: randomStock() },
  { name: "Cinnamon Sticks 100g", description: "Aromatic cinnamon sticks.", price: 3.49, category: "Cooking Essentials", image: "/images/cinnamon-sticks.jpg", countInStock: randomStock() },
  { name: "Bay Leaves 50g", description: "Dried bay leaves.", price: 1.99, category: "Cooking Essentials", image: "/images/bay-leaves.jpg", countInStock: randomStock() },
  { name: "Cloves 50g", description: "Whole dried cloves.", price: 2.99, category: "Cooking Essentials", image: "/images/cloves.jpg", countInStock: randomStock() },
  { name: "Nutmeg 50g", description: "Ground nutmeg spice.", price: 2.49, category: "Cooking Essentials", image: "/images/nutmeg.jpg", countInStock: randomStock() },
  { name: "Turmeric Powder 100g", description: "Bright yellow turmeric powder.", price: 2.39, category: "Cooking Essentials", image: "/images/turmeric-powder.jpg", countInStock: randomStock() },
  { name: "Coriander Seeds 100g", description: "Aromatic coriander seeds.", price: 1.99, category: "Cooking Essentials", image: "/images/coriander-seeds.jpg", countInStock: randomStock() },
  { name: "Cumin Seeds 100g", description: "Earthy cumin seeds.", price: 1.99, category: "Cooking Essentials", image: "/images/cumin-seeds.jpg", countInStock: randomStock() },
  { name: "Mustard Seeds 100g", description: "Tangy mustard seeds.", price: 1.99, category: "Cooking Essentials", image: "/images/mustard-seeds.jpg", countInStock: randomStock() },
  { name: "Fennel Seeds 100g", description: "Sweet fennel seeds.", price: 1.99, category: "Cooking Essentials", image: "/images/fennel-seeds.jpg", countInStock: randomStock() },
  { name: "Cardamom Pods 50g", description: "Fragrant cardamom pods.", price: 3.99, category: "Cooking Essentials", image: "/images/cardamom-pods.jpg", countInStock: randomStock() },
  { name: "Star Anise 50g", description: "Licorice-flavored star anise.", price: 2.99, category: "Cooking Essentials", image: "/images/star-anise.jpg", countInStock: randomStock() },
  { name: "Saffron 1g", description: "Premium saffron threads.", price: 9.99, category: "Cooking Essentials", image: "/images/saffron.jpg", countInStock: randomStock() },
  { name: "Vanilla Beans 2 pods", description: "Aromatic vanilla beans.", price: 4.99, category: "Cooking Essentials", image: "/images/vanilla-beans.jpg", countInStock: randomStock() },
  { name: "Allspice 100g", description: "Warm allspice powder.", price: 2.49, category: "Cooking Essentials", image: "/images/allspice.jpg", countInStock: randomStock() },
  { name: "Garam Masala 100g", description: "Indian spice blend garam masala.", price: 2.99, category: "Cooking Essentials", image: "/images/garam-masala.jpg", countInStock: randomStock() },
  { name: "Curry Leaves 50g", description: "Fresh curry leaves.", price: 1.99, category: "Cooking Essentials", image: "/images/curry-leaves.jpg", countInStock: randomStock() },
  { name: "Lemongrass 100g", description: "Fresh lemongrass stalks.", price: 1.49, category: "Cooking Essentials", image: "/images/lemongrass.jpg", countInStock: randomStock() },
  { name: "Chili Flakes 100g", description: "Spicy chili flakes.", price: 2.49, category: "Cooking Essentials", image: "/images/chili-flakes.jpg", countInStock: randomStock() },
  { name: "Dried Oregano 50g", description: "Aromatic dried oregano.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-oregano.jpg", countInStock: randomStock() },
  { name: "Dried Basil 50g", description: "Fragrant dried basil.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-basil.jpg", countInStock: randomStock() },
  { name: "Dried Rosemary 50g", description: "Pine-scented dried rosemary.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-rosemary.jpg", countInStock: randomStock() },
  { name: "Dried Thyme 50g", description: "Earthy dried thyme.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-thyme.jpg", countInStock: randomStock() },
  { name: "Dried Parsley 50g", description: "Fresh-tasting dried parsley.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-parsley.jpg", countInStock: randomStock() },
  { name: "Dried Dill 50g", description: "Tangy dried dill weed.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-dill.jpg", countInStock: randomStock() },
  { name: "Dried Sage 50g", description: "Savory dried sage.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-sage.jpg", countInStock: randomStock() },
  { name: "Dried Mint 50g", description: "Refreshing dried mint.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-mint.jpg", countInStock: randomStock() },
  { name: "Dried Cilantro 50g", description: "Citrusy dried cilantro.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-cilantro.jpg", countInStock: randomStock() },
  { name: "Dried Chives 50g", description: "Mild onion-flavored dried chives.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-chives.jpg", countInStock: randomStock() },
  { name: "Dried Tarragon 50g", description: "Anise-flavored dried tarragon.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-tarragon.jpg", countInStock: randomStock() },
  { name: "Dried Marjoram 50g", description: "Sweet dried marjoram.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-marjoram.jpg", countInStock: randomStock() },
  { name: "Dried Lavender 50g", description: "Floral dried lavender.", price: 2.49, category: "Cooking Essentials", image: "/images/dried-lavender.jpg", countInStock: randomStock() },
  { name: "Dried Lemongrass 50g", description: "Citrusy dried lemongrass.", price: 1.99, category: "Cooking Essentials", image: "/images/dried-lemongrass.jpg", countInStock: randomStock() },
  { name: "Dried Galangal 50g", description: "Spicy dried galangal.", price: 2.49, category: "Cooking Essentials", image: "/images/dried-galangal.jpg", countInStock: randomStock() },

  // Cooking Essentials

  // Ethnic Foods
  { name: "Egusi Seeds 500g", description: "Ground melon seeds for Nigerian soups.", price: 7.99, category: "Ethnic Food", image: "/images/egusi.jpg", countInStock: randomStock(10, 50) },
  { name: "Stockfish Head", description: "Traditional dried stockfish head.", price: 14.99, category: "Ethnic Food", image: "/images/stockfish.jpg", countInStock: randomStock(5, 20) },
  { name: "Okra 1kg", description: "Fresh okra pods.", price: 4.99, category: "Ethnic Food", image: "/images/okra.jpg", countInStock: randomStock(10, 40) },
  { name: "Plantain (per kilo)", description: "Fresh ripe plantain.", price: 3.99, category: "Ethnic Food", image: "/images/plantain.jpg", countInStock: randomStock(15, 60) },
  { name: "Ofada Rice 5kg", description: "Local Nigerian rice variety.", price: 19.99, category: "Ethnic Food", image: "/images/ofada-rice.jpg", countInStock: randomStock(5, 30) },
  { name: "Groundnut Oil 1Ltr", description: "Traditional groundnut cooking oil.", price: 6.99, category: "Ethnic Food", image: "/images/groundnut-oil.jpg", countInStock: randomStock(10, 40) },
  { name: "Basmati Rice 5kg", description: "Fragrant long grain basmati rice.", price: 15.99, category: "Pantry", image: "/images/basmati-rice.jpeg", countInStock: randomStock() },
  { name: "Coconut Rice 5kg", description: "Aromatic coconut infused rice.", price: 16.99, category: "Pantry", image: "/images/coconut-rice.jpeg", countInStock: randomStock() },
  { name: "Jollof Rice Mix 500g", description: "Spice mix for classic jollof rice.", price: 3.99, category: "Pantry", image: "/images/jollof-rice-mix.jpg", countInStock: randomStock() },
  { name: "Fried Rice Mix 500g", description: "Seasoning mix for fried rice.", price: 3.99, category: "Pantry", image: "/images/fried-rice-mix.jpg", countInStock: randomStock() },
  { name: "Curry Powder 100g", description: "Aromatic curry spice blend.", price: 2.99, category: "Spices", image: "/images/curry-powder.jpg", countInStock: randomStock() },
  { name: "Thyme 100g", description: "Dried thyme herb.", price: 1.99, category: "Spices", image: "/images/thyme.jpg", countInStock: randomStock() },
  { name: "Cumin 100g", description: "Ground cumin spice.", price: 2.49, category: "Spices", image: "/images/cumin.jpg", countInStock: randomStock() },
  { name: "Paprika 100g", description: "Smoked paprika spice.", price: 2.49, category: "Spices", image: "/images/paprika.jpg", countInStock: randomStock() },
  { name: "Chili Powder 100g", description: "Spicy chili powder.", price: 2.49, category: "Spices", image: "/images/chili-powder.jpg", countInStock: randomStock() },
  { name: "Black Pepper 100g", description: "Ground black pepper.", price: 2.49, category: "Spices", image: "/images/black-pepper.jpg", countInStock: randomStock() },
  { name: "Garlic Powder 100g", description: "Dried garlic powder.", price: 1.99, category: "Spices", image: "/images/garlic-powder.jpg", countInStock: randomStock() },

  // Poultry
  { name: "Chicken Drumsticks 1kg", description: "Fresh, juicy chicken drumsticks.", price: 5.49, category: "Poultry", image: "/images/chicken-drumsticks.webp", countInStock: randomStock() },
  { name: "Frozen Chicken Wings 1kg", description: "Ideal for party platters and grilling.", price: 4.99, category: "Poultry", image: "/images/frozen-chicken-wing.webp", countInStock: randomStock() },
  { name: "Chicken Gizzard 500g", description: "Tasty chicken gizzards, great for stews.", price: 3.49, category: "Poultry", image: "/images/chicken-gizzard.webp", countInStock: randomStock() },
  { name: "Soft Chicken 1kg", description: "Tender, easy-to-cook soft chicken.", price: 6.99, category: "Poultry", image: "/images/soft-chicken.webp", countInStock: randomStock() },
  { name: "Fresh Turkey Drumsticks 1kg", description: "Fresh turkey drumsticks, perfect for roasting.", price: 6.29, category: "Poultry", image: "/images/fresh-turkey-drumsticks.webp", countInStock: randomStock() },
  { name: "Smoked Turkey Drumstick (each)", description: "Ready-to-eat smoked turkey drumstick.", price: 4.49, category: "Poultry", image: "/images/smoked-turkey-drumstick.webp", countInStock: randomStock() },

  // Bakery
  { name: "Fresh White Bread Loaf", description: "Soft, freshly baked white bread loaf.", price: 1.29, category: "Bakery", image: "/images/bread.webp", countInStock: randomStock() },
  { name: "Whole Wheat Bread", description: "Hearty whole wheat bread loaf.", price: 1.49, category: "Bakery", image: "/images/bread.jpeg", countInStock: randomStock() },
  { name: "Bakery Fresh Loaf", description: "Golden crust bakery loaf.", price: 2.19, category: "Bakery", image: "/images/bakery.webp", countInStock: randomStock() },
  { name: "Samis Bread", description: "Soft and fluffy Samis bread.", price: 1.79, category: "Bakery", image: "/images/samis-bread.webp", countInStock: randomStock() },
  { name: "Lulu Twist Bread", description: "Sweet twirled twist bread.", price: 2.29, category: "Bakery", image: "/images/Lulu-twist-Bread_375x.webp", countInStock: randomStock() },

  // Fish
  { name: "Catfish Steak 500g", description: "Fresh catfish steak, ready to cook.", price: 6.49, category: "Fish", image: "/images/catfish-steak.webp", countInStock: randomStock() },
  { name: "Frozen Catfish (whole)", description: "Whole frozen catfish.", price: 7.99, category: "Fish", image: "/images/frozen-catfish-whole.webp", countInStock: randomStock() },
  { name: "Tilapia Fish (each)", description: "Fresh tilapia fish.", price: 3.99, category: "Fish", image: "/images/tilapia-fish.webp", countInStock: randomStock() },
  { name: "Horse Mackerel Fish 500g", description: "Flavorful smoked horse mackerel.", price: 4.49, category: "Fish", image: "/images/horse-mackerel-fish.webp", countInStock: randomStock() },
  { name: "Smoke Fish 500g", description: "Delicious smoked fish fillets.", price: 5.49, category: "Fish", image: "/images/smoke-fish.webp", countInStock: randomStock() },
  { name: "Smoked Mangela Fish (each)", description: "Traditional smoked mangela fish.", price: 5.99, category: "Fish", image: "/images/smoked-mangela-fish.webp", countInStock: randomStock() },

  // Health & Beauty
  { name: "Daily Health Supplements", description: "Essential daily vitamins and minerals.", price: 9.99, category: "Health & Beauty", image: "/images/health-supplements.jpg", countInStock: randomStock() },
  { name: "Multivitamin Gummies", description: "Tasty multivitamin gummies for adults.", price: 7.49, category: "Health & Beauty", image: "/images/health-vitamins.jpg", countInStock: randomStock() },
  { name: "Herbal Skincare Cream", description: "Nourishing herbal skincare cream.", price: 6.99, category: "Health & Beauty", image: "/images/health-skincare.jpg", countInStock: randomStock() },
  { name: "Essential Body Care Set", description: "Gentle everyday body care essentials.", price: 8.49, category: "Health & Beauty", image: "/images/health-body-care.jpg", countInStock: randomStock() },

  // Household
  { name: "Bath Tissue 12 rolls", description: "Soft 2-ply bath tissue, 12 rolls.", price: 5.99, category: "Household", image: "/images/household-bath-tissue.jpg", countInStock: randomStock() },
  { name: "All-Purpose Household Cleaner", description: "Multi-surface household cleaner 1L.", price: 2.49, category: "Household", image: "/images/household-cleaner.jpg", countInStock: randomStock() },
  { name: "Laundry Detergent 2L", description: "Fresh-scent liquid laundry detergent.", price: 4.99, category: "Household", image: "/images/household-detergent.jpg", countInStock: randomStock() },
  { name: "Trash Bags 50 count", description: "Heavy-duty drawstring trash bags.", price: 3.49, category: "Household", image: "/images/household-trash-bags.jpg", countInStock: randomStock() },

  // Beer, Wine & Spirit
  { name: "Premium Lager 6 pack", description: "Refreshing premium lager, 6 bottles.", price: 6.49, category: "Beer, Wine & Spirit", image: "/images/beer.jpg", countInStock: randomStock() },
  { name: "Red Wine 750ml", description: "Smooth red wine, 750ml.", price: 8.99, category: "Beer, Wine & Spirit", image: "/images/wine.jpg", countInStock: randomStock() },
  { name: "Spirits Collection 700ml", description: "Premium spirits, 700ml.", price: 14.99, category: "Beer, Wine & Spirit", image: "/images/spirits.jpg", countInStock: randomStock() },
  { name: "Single Malt Whiskey 700ml", description: "Rich single malt whiskey, 700ml.", price: 19.99, category: "Beer, Wine & Spirit", image: "/images/whiskey.jpg", countInStock: randomStock() },
];

// ✅ Sample Recipes
const recipes = [
  {
    title: "Nigerian Jollof Rice",
    description:
      "A rich, smoky one-pot rice dish that's a West African classic.",
    ingredients: [
      "4 cups long grain rice",
      "2 cups tomato sauce",
      "1 red bell pepper",
      "1 onion",
      "2 tbsp cooking oil",
      "Seasoning cubes & salt to taste",
    ],
    steps: [
      "Blend tomatoes, peppers and onion into a smooth paste.",
      "Heat oil in a pot and fry the onion until soft.",
      "Add the blended mix and fry until the sauce reduces.",
      "Add rice, seasoning and enough water to cover.",
      "Cover and cook on low heat until rice is tender and smoky.",
    ],
    category: "Main Dish",
    diet: "vegan",
    image: "/images/recipe-jollof-rice.jpg",
  },
  {
    title: "Egusi Soup",
    description:
      "A hearty Nigerian soup made with ground melon seeds and vegetables.",
    ingredients: [
      "2 cups egusi seeds",
      "500g assorted meat",
      "3 cups spinach",
      "1 onion",
      "1 cup palm oil",
      "Seasoning to taste",
    ],
    steps: [
      "Cook the assorted meat with seasoning and set aside.",
      "Blend egusi seeds and onion into a paste.",
      "Heat palm oil, add the egusi paste and fry.",
      "Add meat stock and simmer, then stir in spinach.",
      "Cook until thickened and serve with pounded yam or rice.",
    ],
    category: "Soup",
    diet: "none",
    image: "/images/recipe-egusi-soup.jpg",
  },
  {
    title: "Fresh Fruit Salad",
    description:
      "A refreshing mix of seasonal fruits with a honey drizzle.",
    ingredients: [
      "2 cups strawberries",
      "2 bananas",
      "1 cup grapes",
      "1 cup pineapple chunks",
      "2 tbsp honey",
    ],
    steps: [
      "Wash and cut all the fruits into bite-sized pieces.",
      "Combine the fruits in a large bowl.",
      "Drizzle with honey and toss gently.",
      "Chill for 20 minutes before serving.",
    ],
    category: "Dessert",
    diet: "vegan",
    image: "/images/recipe-fruit-salad.jpg",
  },
  {
    title: "Chicken Stir Fry",
    description:
      "Quick stir fry with chicken, crunchy veggies, and soy sauce.",
    ingredients: [
      "500g chicken breast",
      "2 cups mixed vegetables",
      "3 tbsp soy sauce",
      "2 cloves garlic",
      "1 tbsp cooking oil",
    ],
    steps: [
      "Slice chicken into strips and season lightly.",
      "Heat oil in a wok and cook chicken until golden.",
      "Add garlic and vegetables, stir-fry for 3 minutes.",
      "Add soy sauce and toss until well coated.",
      "Serve hot with rice or noodles.",
    ],
    category: "Main Dish",
    diet: "none",
    image: "/images/recipe-stir-fry.jpg",
  },
];

// ✅ Seeded customer reviews
// Deterministic (no randomness) so re-seeding produces an identical catalog and
// the API tests can assert on a known review count. Assigned round-robin to
// every third product in importData(), which keeps the product page's review
// section populated instead of showing the empty state.
const SEED_REVIEWS = [
  { rating: 5, comment: "Brilliant quality and it arrived fresher than I expected. Will order again." },
  { rating: 4, comment: "Really good, though the packaging could be a little more secure." },
  { rating: 5, comment: "Excellent value and the flavour is outstanding. A weekly staple now." },
  { rating: 3, comment: "Fine overall, but it was smaller than the photos suggested." },
];

// Give every 3rd product a pair of reviews from the two seeded accounts so
// reviews have distinguishable author names.
const withSeedReviews = (products, authors) =>
  products.map((product, index) => {
    if (index % 3 !== 0) return product;
    return {
      ...product,
      reviews: [
        { ...SEED_REVIEWS[index % SEED_REVIEWS.length], user: authors[0] },
        {
          ...SEED_REVIEWS[(index + 1) % SEED_REVIEWS.length],
          user: authors[1],
        },
      ],
    };
  });

// ✅ Import Function
const importData = async () => {
  try {
    await connectDB();
    await Product.deleteMany();

    // Create a demo user to own the seeded recipes
    let demoUser = await User.findOne({ email: "demo@example.com" });
    if (!demoUser) {
      demoUser = await User.create({
        name: "Demo User",
        email: "demo@example.com",
        password: "password123",
      });
    }

    // Create an admin user so the dashboard can be accessed (credentials
    // overridable via ADMIN_EMAIL / ADMIN_PASSWORD env vars)
    let adminUser = await User.findOne({ email: ADMIN_EMAIL });
    if (!adminUser) {
      adminUser = await User.create({
        name: process.env.ADMIN_NAME || "Admin",
        email: ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD || "admin12345",
        role: "admin",
      });
      console.log(`👤 Created admin account: ${ADMIN_EMAIL}`);
    } else if (adminUser.role !== "admin") {
      // Re-running the seeder silently escalated pre-existing accounts to admin.
      // Never do that quietly.
      console.warn(
        `⚠️  WARNING: existing account ${ADMIN_EMAIL} had role "${adminUser.role}" and has been promoted to "admin".`,
      );
      console.warn(
        `⚠️  If you did not intend this, change ADMIN_EMAIL in .env or reset that account's role manually.`,
      );
      adminUser.role = "admin";
      await adminUser.save();
    }

    await Recipe.deleteMany();
    const recipeDocs = recipes.map((r) => ({
      ...r,
      createdBy: demoUser._id,
    }));
    await Recipe.insertMany(recipeDocs);

    await Product.insertMany(
      withSeedReviews(
        [...products, ...newArrivals, ...weeklyDeals, ...extraProducts],
        [demoUser._id, adminUser._id]
      )
    );
    console.log("✅ 60+ Products and 4 Recipes Imported!");
    process.exit();
  } catch (error) {
    console.error("❌ Error importing data:", error);
    process.exit(1);
  }
};

// ✅ Destroy Function
// Removes catalog data only (Products + Recipes). Users are left intact.
const destroyData = async () => {
  try {
    await connectDB();
    const products = await Product.deleteMany();
    const recipes = await Recipe.deleteMany();
    console.log(`🗑️  Destroyed ${products.deletedCount} products and ${recipes.deletedCount} recipes.`);
    console.log(`ℹ️  Users were not touched. Use "npm run seed:reset" to also reset seeded accounts.`);
    process.exit();
  } catch (error) {
    console.error("❌ Error destroying data:", error);
    process.exit(1);
  }
};

// ✅ Reset Function
// Like importData(), but also drops the owned seeded accounts first so passwords
// and roles are rebuilt from scratch, plus purges any retired seed accounts.
// Every deleted account is either recreated immediately by importData() or
// intentionally retired -- --reset never orphans an account another seed owns.
// Accounts registered through the app are never deleted.
const resetData = async () => {
  try {
    await connectDB();
    const deleted = await User.deleteMany({
      email: { $in: [...SEEDED_USER_EMAILS, ...LEGACY_USER_EMAILS] },
    });
    console.log(`♻️  Removed ${deleted.deletedCount} seeded account(s).`);
    console.log(`♻️  Re-seeding catalog and accounts from scratch...`);
  } catch (error) {
    console.error("❌ Error resetting seeded accounts:", error);
    process.exit(1);
  }
  // importData calls process.exit() itself.
  await importData();
};

// ✅ Confirmation prompt for destructive runs
const confirm = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });

// ✅ Run Script
const arg = process.argv[2];
const skipPrompt = process.argv.includes("-y") || process.argv.includes("--yes");

const main = async () => {
  if (arg === "-d" || arg === "--destroy") {
    if (!skipPrompt && process.stdin.isTTY) {
      const ok = await confirm(
        `⚠️  This deletes ALL products and recipes. Continue? [y/N] `,
      );
      if (!ok) {
        console.log("Cancelled.");
        return;
      }
    }
    await destroyData();
    return;
  }

  if (arg === "--reset") {
    if (!skipPrompt && process.stdin.isTTY) {
      const ok = await confirm(
        `⚠️  This deletes ALL products and recipes, plus these seeded accounts:\n` +
          `      ${SEEDED_USER_EMAILS.join(", ")} (recreated)\n` +
          `      ${LEGACY_USER_EMAILS.join(", ")} (retired, not recreated)\n` +
          `    The E2E account (e2e@test.com) and all accounts registered through\n` +
          `    the app are NOT touched.\n` +
          `    Continue? [y/N] `,
      );
      if (!ok) {
        console.log("Cancelled.");
        return;
      }
    }
    await resetData();
    return;
  }

  await importData();
};

main();

// Usage:
//   npm run seed        Re-import catalog + ensure seeded accounts exist
//   npm run seed:reset  Same as seed, but rebuild the seeded accounts from scratch
//   npm run destroy     Delete all products + recipes, keep users
//   npm run seed:e2e    Idempotent Playwright test data (see e2e-seed.js)
