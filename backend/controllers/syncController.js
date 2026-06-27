const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { runInTransaction } = require('../utils/transactionHelper');

const syncOfflineData = async (req, res) => {
  const { actions } = req.body;
  const businessId = req.user.businessId;
  const userId = req.user.id;

  if (!actions || !Array.isArray(actions)) {
    return res.status(400).json({ success: false, error: 'Invalid actions payload' });
  }

  const results = [];

  for (const action of actions) {
    if (action.type === 'RECORD_SALE') {
      try {
        const result = await runInTransaction(async ({ session }) => {
          const { items, customerId, customerName, customerPhone, totalAmount, paymentStatus, tempId } = action.payload;
          
          let resolvedCustomerId = customerId;

          // If it's a new customer created offline, we might need to upsert by phone
          if (!resolvedCustomerId && customerPhone) {
            let customer = await Customer.findOne({ phone: customerPhone, businessId }).session(session);
            if (!customer) {
              customer = await Customer.create([{
                businessId,
                name: customerName || 'Walk-in Customer',
                phone: customerPhone,
                credit_balance: paymentStatus === 'credit' || paymentStatus === 'partial' ? totalAmount : 0 // Simplified logic
              }], { session });
              resolvedCustomerId = customer[0]._id;
            } else {
              resolvedCustomerId = customer._id;
              if (paymentStatus === 'credit' || paymentStatus === 'partial') {
                 customer.credit_balance += totalAmount;
                 await customer.save({ session });
              }
            }
          }

          // Deduct inventory
          for (const item of items) {
            const product = await Product.findOne({ _id: item.product_id, businessId }).session(session);
            if (product) {
               // Only deduct if not already deducted. In a true offline-first, you might need CRDTs or strict sequence numbers.
               // For this implementation, we assume offline actions are mutually exclusive or we just apply the delta.
               product.stock_qty -= item.quantity;
               await product.save({ session });
            }
          }

          // Create Sale
          const newSale = await Sale.create([{
            businessId,
            userId,
            customer_id: resolvedCustomerId,
            items: items.map(i => ({
                product_id: i.product_id,
                name: i.name,
                quantity: i.quantity,
                unit_price: i.unit_price,
                subtotal: i.subtotal
            })),
            total_amount: totalAmount,
            payment_status: paymentStatus || 'paid',
            sync_status: 'synced',
            sale_date: action.timestamp || Date.now()
          }], { session });

          // Create Invoice
          await Invoice.create([{
            sale_id: newSale[0]._id,
            businessId,
            customer_id: resolvedCustomerId,
            invoiceNumber: `INV-SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            totalAmount: totalAmount,
            delivery_status: 'pending'
          }], { session });

          return { tempId, success: true, serverId: newSale[0]._id };
        });

        results.push(result);
      } catch (err) {
        console.error(`Sync error for action ${action.tempId}:`, err);
        results.push({ tempId: action.tempId, success: false, error: err.message });
      }
    } else {
        // Handle other action types if necessary
        results.push({ tempId: action.tempId, success: false, error: 'Unsupported action type' });
    }
  }

  res.json({ success: true, results });
};

module.exports = { syncOfflineData };
