// Helper to abstract some DB logic for the controller
const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Business = require('../models/Business');

// Assuming a single default business for simplicity in Phase-I
const getDefaultBusiness = async () => {
    let business = await Business.findOne();
    if (!business) {
        business = await Business.create({
            name: 'Hamza Store',
            type: 'retail',
            contactDetails: '123-456-7890'
        });
    }
    return business;
};

const recordDummySale = async () => {
    const business = await getDefaultBusiness();

    // Create a dummy sale
    const newSale = await Sale.create({
        businessId: business._id,
        products: [
            { name: "Dummy Item", quantity: 1, price: 500 }
        ],
        totalAmount: 500
    });

    // Generate Invoice automatically
    const newInvoice = await Invoice.create({
        saleId: newSale._id,
        businessId: business._id,
        invoiceNumber: `INV-${Date.now()}`,
        totalAmount: 500
    });

    return { sale: newSale, invoice: newInvoice, totalAmount: 500 };
};

const getInventoryStatus = async () => {
    const business = await getDefaultBusiness();
    const items = await Inventory.find({ businessId: business._id });
    return {
        totalTypes: items.length
    };
};

module.exports = {
    recordDummySale,
    getInventoryStatus
};
