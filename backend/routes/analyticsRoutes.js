const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
  try {
    const businessId = req.user.businessId;

    // Aggregate sales data to find top selling products
    const sales = await Sale.find({ businessId });
    
    let productSalesMap = {}; // { productId: quantitySold }
    sales.forEach(sale => {
      sale.products.forEach(p => {
        const pIdStr = p.productId ? p.productId.toString() : 'unknown';
        if (!productSalesMap[pIdStr]) {
            productSalesMap[pIdStr] = { name: p.name, quantity: 0, revenue: 0 };
        }
        productSalesMap[pIdStr].quantity += p.quantity;
        productSalesMap[pIdStr].revenue += p.price * p.quantity;
      });
    });

    const rankedProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);
    
    const topSellers = rankedProducts.slice(0, 3);
    const lowPerformers = rankedProducts.slice(-3).reverse(); // weakest at top of this list

    // AI Suggestions Logic
    // We fetch current inventory to see if top sellers are out of stock
    const inventories = await Inventory.find({ businessId }).populate('productId');
    
    let insights = [];
    
    if (topSellers.length > 0) {
      topSellers.forEach(ts => {
        // Find stock of the top seller
        const invItem = inventories.find(i => i.productId && i.productId.name === ts.name);
        if (invItem && invItem.quantity < 5) {
          insights.push(`Urgent: "${ts.name}" is your top seller but stock is running critically low (${invItem.quantity} left). Restock immediately!`);
        } else {
          insights.push(`"${ts.name}" is performing great! Keep pushing it.`);
        }
      });
    }

    if (lowPerformers.length > 0) {
      lowPerformers.forEach(lp => {
         const invItem = inventories.find(i => i.productId && i.productId.name === lp.name);
         if (invItem && invItem.quantity > 20) {
            insights.push(`Warning: "${lp.name}" has low sales but high stock (${invItem.quantity}). Consider offering a discount next week.`);
         }
      });
    }

    if (insights.length === 0) {
        insights.push("Start recording sales with your voice assistant to see AI suggestions here!");
    }

    res.json({
        success: true,
        data: {
            topSellers,
            lowPerformers,
            insights
        }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

module.exports = router;
