const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Reminder = require('../models/Reminder');
const Inventory = require('../models/Inventory');
const { runInTransaction } = require('../utils/transactionHelper');
const { sendNotification } = require('../utils/twilioHelper');

const AI_BRIDGE_URL = process.env.AI_BRIDGE_URL || 'http://localhost:5001';

// In-memory state for conversational clarification (Dialogue Stack)
// In production, this should use Redis or a DB.
const conversationState = {};

const processAudioCommand = async (req, res) => {
  const businessId = req.user.businessId;
  const userId = req.user.id;
  const { command, audioBase64 } = req.body;

  let textCommand = command;

  // 1. Transcribe audio if provided
  if (audioBase64) {
    try {
      const buffer = Buffer.from(audioBase64, 'base64');
      const tempFilePath = path.join(os.tmpdir(), `audio-${crypto.randomUUID()}.wav`);
      fs.writeFileSync(tempFilePath, buffer);

      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(tempFilePath));

      const transcribeRes = await axios.post(`${AI_BRIDGE_URL}/transcribe`, formData, {
        headers: formData.getHeaders()
      });

      fs.unlinkSync(tempFilePath); // Cleanup

      if (transcribeRes.data.success) {
        textCommand = transcribeRes.data.text;
      } else {
        return res.json({ success: false, textResponse: "Could not transcribe audio." });
      }
    } catch (err) {
      console.error("Transcription error:", err.message);
      return res.status(500).json({ success: false, textResponse: "AI Transcription service is unavailable." });
    }
  }

  if (!textCommand) {
    return res.status(400).json({ success: false, textResponse: "Please say a command." });
  }

  // 2. Parse NLU intents
  let parsedData;
  try {
    const parseRes = await axios.post(`${AI_BRIDGE_URL}/parse`, { text: textCommand });
    if (parseRes.data.success) {
      parsedData = parseRes.data.data;
    } else {
      return res.json({ success: false, textResponse: "Failed to parse command." });
    }
  } catch (err) {
    console.error("NLU Parsing error:", err.message);
    return res.status(500).json({ success: false, textResponse: "AI NLU service is unavailable." });
  }

  const { intent, confidence, productName, quantity, price, unit, customerName, phone } = parsedData;

  // 3. Confidence Safeguards
  if (confidence < 0.7) {
    return res.json({
      success: true,
      textResponse: "I couldn't clearly understand. Can you please repeat that?"
    });
  }

  if (confidence >= 0.7 && confidence < 0.9) {
    // In a full dialogue manager, we'd save this intent and ask for Yes/No confirmation
    // For now, we simulate asking for confirmation.
    const stateId = userId.toString();
    conversationState[stateId] = { pendingAction: parsedData, turn: 1 };
    return res.json({
      success: true,
      requiresConfirmation: true,
      textResponse: `I think you said you want to ${intent.replace('_', ' ').toLowerCase()}. Is that correct?`
    });
  }

  // Clear state on high confidence new intent
  delete conversationState[userId.toString()];

  // 4. Handle Missing Parameters with Dialogue Stack
  if (intent === 'RECORD_SALE' && !productName) {
    return res.json({ success: true, textResponse: "Which product are you selling?" });
  }

  // Fetch product for matching
  let matchedProduct = null;
  if (productName) {
    const regex = new RegExp(productName, 'i');
    matchedProduct = await Product.findOne({
      businessId,
      $or: [{ name: regex }, { name_ur: regex }]
    });
  }

  // ── UPDATE PRICE ──────────────────────────────────────────────────────────
  if (intent === 'UPDATE_PRICE') {
    if (!matchedProduct) return res.json({ success: false, textResponse: "Could not find a matching product." });
    if (!price) return res.json({ success: false, textResponse: "What should the new price be?" });

    matchedProduct.price = price;
    await matchedProduct.save();

    return res.json({ success: true, textResponse: `Price of ${matchedProduct.name} has been updated to ${price}.` });
  }

  // ── RESTOCK / ADD ──────────────────────────────────────────────────────────
  if (intent === 'RESTOCK_INVENTORY') {
    if (!matchedProduct) {
       // Create new product
       const newProduct = await Product.create({
         businessId,
         name: productName || "Unknown Product",
         unit: unit || 'piece',
         price: price || 0
       });
       await Inventory.create({
         productId: newProduct._id,
         businessId,
         quantity: quantity || 1
       });
       return res.json({ success: true, textResponse: `Created new product ${newProduct.name} with stock ${quantity || 1}.`});
    }

    let inventory = await Inventory.findOne({ productId: matchedProduct._id, businessId });
    if (!inventory) {
        inventory = await Inventory.create({ productId: matchedProduct._id, businessId, quantity: 0 });
    }
    inventory.quantity += (quantity || 1);
    await inventory.save();
    return res.json({ success: true, textResponse: `Added ${quantity || 1} to ${matchedProduct.name}. Total stock is now ${inventory.quantity}.` });
  }

  // ── CHECK STOCK ────────────────────────────────────────────────────────────
  if (intent === 'CHECK_INVENTORY') {
    if (matchedProduct) {
      const inventory = await Inventory.findOne({ productId: matchedProduct._id, businessId });
      const qty = inventory ? inventory.quantity : 0;
      return res.json({ success: true, textResponse: `You have ${qty} ${matchedProduct.name} in stock.` });
    }
    const numItems = await Product.countDocuments({ businessId });
    return res.json({ success: true, textResponse: `You have ${numItems} unique products in inventory.` });
  }

  // ── SELL / RECORD SALE ─────────────────────────────────────────────────────
  if (intent === 'RECORD_SALE') {
    if (!matchedProduct) return res.json({ success: false, textResponse: "I could not find that product." });

    const finalQuantity = quantity || 1;
    const finalPrice = price || matchedProduct.price;
    const totalAmount = finalPrice * finalQuantity;

    let responseMsg = '';

    try {
      await runInTransaction(async ({ session }) => {
        // Fetch fresh product state
        const product = await Product.findOne({ _id: matchedProduct._id }).session(session);
        const inventory = await Inventory.findOne({ productId: product._id, businessId }).session(session);

        if (!inventory || inventory.quantity < finalQuantity) {
          throw new Error(`Not enough stock. Only ${inventory ? inventory.quantity : 0} available.`);
        }

        // Deduct inventory
        inventory.quantity -= finalQuantity;
        await inventory.save({ session });

        // Proactive Low Stock Warning
        if (inventory.quantity <= product.low_stock_threshold) {
          responseMsg += `Warning: ${product.name} stock is below minimum level (${inventory.quantity} left). `;
        }

        // Resolve Customer
        let customerId = null;
        if (customerName || phone) {
           let customer = null;
           if (phone) customer = await Customer.findOne({ phone, businessId }).session(session);
           if (!customer && customerName) {
              const nameRegex = new RegExp(customerName, 'i');
              customer = await Customer.findOne({ businessId, $or: [{name: nameRegex}, {name_ur: nameRegex}] }).session(session);
           }
           
           if (!customer) {
              // Create customer
              const newCustomers = await Customer.create([{
                  businessId,
                  name: customerName || 'Walk-in',
                  phone: phone || `UNKNOWN-${Date.now()}`
              }], { session });
              customerId = newCustomers[0]._id;
           } else {
              customerId = customer._id;
           }
        }

        // Create Sale
        const newSale = await Sale.create([{
          businessId,
          userId,
          customer_id: customerId,
          items: [{
            product_id: product._id,
            name: product.name,
            quantity: finalQuantity,
            unit_price: finalPrice,
            subtotal: totalAmount
          }],
          total_amount: totalAmount,
          payment_status: 'paid', // Could be dynamic based on intent text
          sync_status: 'synced',
          sale_date: Date.now()
        }], { session });

        // Create Invoice
        await Invoice.create([{
          sale_id: newSale[0]._id,
          businessId,
          customer_id: customerId,
          invoiceNumber: `INV-${Date.now()}`,
          totalAmount: totalAmount,
          delivery_status: customerId ? 'pending' : 'none'
        }], { session });

        responseMsg = `Successfully sold ${finalQuantity} ${product.name}. ` + responseMsg;
      });

      return res.json({ success: true, textResponse: responseMsg });

    } catch (transactionErr) {
      return res.json({ success: false, textResponse: transactionErr.message });
    }
  }

  // ── CREDIT REMINDER ────────────────────────────────────────────────────────
  if (intent === 'CREDIT_REMINDER') {
      if (!customerName) return res.json({ success: false, textResponse: "Which customer should I remind?"});
      
      const regex = new RegExp(customerName, 'i');
      const customer = await Customer.findOne({ businessId, $or: [{ name: regex }, { name_ur: regex }] });
      
      if (!customer) return res.json({ success: false, textResponse: `Could not find customer ${customerName}.`});
      if (customer.credit_balance <= 0) return res.json({ success: true, textResponse: `${customer.name} has no pending credit.`});
      
      const reminderAmount = price || customer.credit_balance;

      const newReminder = await Reminder.create({
          businessId,
          customer_id: customer._id,
          amount: reminderAmount,
          channel: 'sms',
          status: 'pending'
      });

      const message = `Hello ${customer.name}, you have an outstanding credit balance of Rs. ${reminderAmount}. Please clear it at your earliest convenience.`;
      
      // Execute Twilio Helper asynchronously
      sendNotification({ to: customer.phone, message, channel: 'sms' }).then(async (result) => {
          if(result.success) {
              newReminder.status = 'sent';
          } else {
              newReminder.status = 'failed';
          }
          await newReminder.save();
      });

      return res.json({ success: true, textResponse: `Sent a reminder to ${customer.name} for ${reminderAmount} rupees.`});
  }

  // ── GENERATE REPORT ────────────────────────────────────────────────────────
  if (intent === 'GENERATE_REPORT') {
      const totalSales = await Sale.countDocuments({ businessId });
      
      // Need mongoose ObjectId conversion if needed, but simple query should work for businessId since it's typically a string or ObjectId mapped directly
      // Better to just sum without aggregation if there's type issues, but let's try standard sum
      let revenue = 0;
      try {
        const sales = await Sale.find({ businessId });
        revenue = sales.reduce((acc, curr) => acc + curr.total_amount, 0);
      } catch (e) {
        console.error("Report generation error", e);
      }
      
      return res.json({ success: true, textResponse: `You have ${totalSales} sales with a total revenue of ${revenue} rupees.` });
  }

  return res.json({ success: true, textResponse: "I didn't understand that command." });
};

module.exports = { processCommand: processAudioCommand };
