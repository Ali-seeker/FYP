const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect('mongodb+srv://admin_db_user:0xkIMBY3E7RE29Zi@inventory.dsqqvpk.mongodb.net/ai_verbal_assistant?retryWrites=true&w=majority&appName=Inventory');
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
