export const adminUser = {
  name: 'Test Admin',
  email: 'admin@test.com',
  password: 'admin123',
  role: 'admin',
};

export const regularUser = {
  name: 'Test User',
  email: 'user@test.com',
  password: 'user123',
  role: 'user',
};

export const sampleProducts = [
  {
    name: 'Fresh Apples',
    price: 2.5,
    description: 'Crisp and juicy fresh apples',
    category: 'Fruits',
    image: '/images/apples.jpg',
    countInStock: 50,
    isFeatured: true,
    isWeeklyDeal: true,
    isNewArrival: true,
    nutrition: { calories: '52', fat: '0.2g', carbs: '14g', protein: '0.3g' },
  },
  {
    name: 'Whole Milk 2L',
    price: 1.8,
    description: 'Fresh whole milk',
    category: 'Dairy',
    image: '/images/milk.jpg',
    countInStock: 30,
    nutrition: { calories: '61', fat: '3.5g', carbs: '4.8g', protein: '3.2g' },
  },
  {
    name: 'Brown Bread',
    price: 1.2,
    description: 'Wholegrain brown bread',
    category: 'Bakery',
    image: '/images/bread.jpg',
    countInStock: 20,
  },
];

export const sampleOrder = {
  items: [
    {
      productId: null, // set dynamically
      quantity: 2,
    },
  ],
  shippingAddress: {
    street: '123 Test Street',
    city: 'London',
    state: 'England',
    postalCode: 'SW1A 1AA',
    country: 'UK',
  },
  paymentMethod: 'card',
  customerEmail: 'buyer@test.com',
};

export const sampleRecipe = {
  title: 'Test Jollof Rice',
  description: 'A tasty test recipe',
  ingredients: ['Rice', 'Tomatoes', 'Onions'],
  steps: ['Boil rice', 'Add sauce'],
  category: 'Main',
  diet: 'none',
  image: '/images/jollof.jpg',
};
