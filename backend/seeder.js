const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const Inventory = require('./models/Inventory');
const Business = require('./models/Business');

const seedData = async () => {
  try {
    await mongoose.connect('mongodb+srv://admin_db_user:0xkIMBY3E7RE29Zi@inventory.dsqqvpk.mongodb.net/ai_verbal_assistant?retryWrites=true&w=majority&appName=Inventory');
    console.log('MongoDB Connected for Seeding...');

    const business = await Business.findOne();
    if (!business) {
      console.log('No business found. Please register an account first in your browser!');
      process.exit(1);
    }

    const businessId = business._id;

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

    console.log(`Seeding data for business: ${business.name}...`);

    for (const item of demoProducts) {
      const existingProduct = await Product.findOne({ businessId, name: item.name });
      if (!existingProduct) {
        const newProduct = await Product.create({
          businessId,
          name: item.name,
          price: item.price,
          description: item.description
        });

        await Inventory.create({
          productId: newProduct._id,
          businessId,
          quantity: item.initialStock
        });
      }
    }

    console.log('Demo Data Imported Successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedData();
