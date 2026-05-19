const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { protect } = require('../middleware/authMiddleware');

// SEED Demo Data
router.get('/seed', protect, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const demoProducts = [
      { name: "Nestle Milk 1L", price: 250, description: "Dairy", initialStock: 50 },
      { name: "Dawn Bread Large", price: 120, description: "Bakery", initialStock: 30 },
      { name: "Eggs Dozen", price: 300, description: "Dairy", initialStock: 20 },
      { name: "Lipton Yellow Label 250g", price: 450, description: "Beverages", initialStock: 15 },
      { name: "Coca Cola 1.5L", price: 150, description: "Beverages", initialStock: 40 },
      { name: "Surf Excel 1kg", price: 550, description: "Cleaning", initialStock: 25 },
      { name: "National Ketchup 800g", price: 350, description: "Condiments", initialStock: 10 },
      { name: "Tapal Danedar 200g", price: 380, description: "Beverages", initialStock: 20 },
      { name: "LU Prince Biscuits", price: 80, description: "Snacks", initialStock: 100 },
      { name: "Lux Soap Regular", price: 110, description: "Toiletries", initialStock: 60 }
    ];

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
    res.json({ success: true, message: "Demo data loaded!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all products + their inventory levels for the user's business
router.get('/', protect, async (req, res) => {
  try {
    const products = await Product.find({ businessId: req.user.businessId });
    const inventory = await Inventory.find({ businessId: req.user.businessId });

    const merged = products.map(p => {
      const invItem = inventory.find(i => i.productId.toString() === p._id.toString());
      return {
        ...p._doc,
        stockQuantity: invItem ? invItem.quantity : 0
      }
    });

    res.json({ success: true, data: merged });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add a new product (and initialize its inventory)
router.post('/', protect, async (req, res) => {
  try {
    const { name, price, description, initialStock } = req.body;

    const product = await Product.create({
      businessId: req.user.businessId,
      name,
      price,
      description
    });

    const inventory = await Inventory.create({
      productId: product._id,
      businessId: req.user.businessId,
      quantity: initialStock || 0
    });

    res.status(201).json({ success: true, product, inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update product quantity and/or price
router.put('/:id', protect, async (req, res) => {
  try {
    const { quantity, price } = req.body;
    const product = await Product.findOne({ _id: req.params.id, businessId: req.user.businessId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (price !== undefined) {
      product.price = Number(price);
      await product.save();
    }

    if (quantity !== undefined) {
      const invRecord = await Inventory.findOne({ productId: product._id });
      if (invRecord) {
        invRecord.quantity = Number(quantity);
        await invRecord.save();
      } else {
        await Inventory.create({ productId: product._id, businessId: req.user.businessId, quantity: Number(quantity) });
      }
    }

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a product and its inventory record
router.delete('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, businessId: req.user.businessId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await Inventory.deleteOne({ productId: product._id });
    await Product.deleteOne({ _id: product._id });

    res.json({ success: true, message: `${product.name} deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
