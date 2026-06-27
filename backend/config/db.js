const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const seedDefaultDataIfEmpty = async () => {
  try {
    const Business = require('../models/Business');
    const User = require('../models/User');
    const Product = require('../models/Product');
    const Inventory = require('../models/Inventory');

    const businessCount = await Business.countDocuments();
    if (businessCount > 0) {
      return; // Already has data
    }

    console.log('Seeding default data into MongoDB...');

    // 1. Create Business
    const business = await Business.create({
      name: 'Hamza Store',
      type: 'retail',
      contactDetails: '123-456-7890'
    });

    // 2. Create Owner User
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    await User.create({
      name: 'Hamza',
      email: 'hamza@example.com',
      password: hashedPassword,
      businessId: business._id,
      role: 'owner'
    });

    // 3. Create Products and Inventory
    const demoProducts = [
      { name: "Nestle Milk 1L", price: 250, description: "Dairy Product", initialStock: 50 },
      { name: "Dawn Bread Large", price: 120, description: "Bakery", initialStock: 30 },
      { name: "Eggs Dozen", price: 300, description: "Dairy Product", initialStock: 20 },
      { name: "Lipton Yellow Label 250g", price: 450, description: "Beverages", initialStock: 15 },
      { name: "Coca Cola 1.5L", price: 150, description: "Beverages", initialStock: 40 },
      { name: "Surf Excel 1kg", price: 550, description: "Cleaning", initialStock: 25 },
      { name: "National Ketchup 800g", price: 350, description: "Condiments", initialStock: 10 },
      { name: "Tapal Danedar 200g", price: 380, description: "Beverages", initialStock: 20 },
      { name: "LU Prince Biscuits", price: 80, description: "Snacks", initialStock: 100 },
      { name: "Lux Soap Regular", price: 110, description: "Toiletries", initialStock: 60 }
    ];

    for (const item of demoProducts) {
      const product = await Product.create({
        businessId: business._id,
        name: item.name,
        price: item.price,
        description: item.description
      });

      await Inventory.create({
        productId: product._id,
        businessId: business._id,
        quantity: item.initialStock
      });
    }

    console.log('Default data seeded successfully! You can log in with:');
    console.log('Email: hamza@example.com');
    console.log('Password: password123');
  } catch (error) {
    console.error('Error seeding default data:', error.message);
  }
};

const connectDB = async () => {
  try {
    const dbURI = process.env.MONGO_URI || 'mongodb+srv://admin_db_user:0xkIMBY3E7RE29Zi@inventory.dsqqvpk.mongodb.net/ai_verbal_assistant?retryWrites=true&w=majority&appName=Inventory';
    
    // Connect to MongoDB (5s timeout)
    await mongoose.connect(dbURI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('MongoDB Connected successfully...');
    await seedDefaultDataIfEmpty();
  } catch (err) {
    console.error('MongoDB connection failed. Falling back to local in-memory database...', err.message);
    try {
      // Disconnect first to ensure clean state
      await mongoose.disconnect();

      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoURI = mongoServer.getUri();

      await mongoose.connect(mongoURI);
      console.log(`MongoDB Connected in-memory at: ${mongoURI}`);

      await seedDefaultDataIfEmpty();
    } catch (inMemErr) {
      console.error('In-memory MongoDB startup failed:', inMemErr.message);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
