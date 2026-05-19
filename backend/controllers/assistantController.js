const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

// ─── Fuzzy / Smart matching helpers ───────────────────────────────────────────

// Translate common Roman Urdu / conversational terms to English intents
function translateRomanUrdu(str) {
  let mapped = str
    .replace(/\b(ko|kro|karo|bhai|ki|ka)\b/g, '') // remove filler words
    .replace(/\bdo\b/gi, '2')
    .replace(/\bek\b/gi, '1')
    .replace(/\bteen\b/gi, '3')
    .replace(/\bchar\b/gi, '4')
    .replace(/\bpaanch\b/gi, '5')
    .replace(/\b(chay|chey)\b/gi, '6')
    .replace(/\bsaath\b/gi, '7')
    .replace(/\baath\b/gi, '8')
    .replace(/\bnau\b/gi, '9')
    .replace(/\bdas\b/gi, '10')
    .replace(/\bbech|becho\b/gi, 'sell')
    .replace(/\bhatao|mitao\b/gi, 'delete')
    .replace(/\bshamil|dalao|add\b/gi, 'add')
    .replace(/\bkitne|kitna|check\b/gi, 'check')
    .replace(/\bchalu\b/gi, 'start');
  
  return mapped;
}

// Normalise a string: lowercase, remove punctuation, expand common abbreviations
function normalise(str) {
  str = translateRomanUrdu(str.toLowerCase());
  return str
    // expand common unit abbreviations BEFORE stripping punctuation
    .replace(/\b1\s*l\b/g, '1 liter')
    .replace(/\b(\d+)\s*l\b/g, '$1 liter')
    .replace(/\b(\d+)\s*kg\b/g, '$1 kilogram')
    .replace(/\b(\d+)\s*g\b/g, '$1 gram')
    .replace(/\b(\d+)\s*ml\b/g, '$1 milliliter')
    .replace(/litre/g, 'liter')
    .replace(/litres/g, 'liter')
    .replace(/liters/g, 'liter')
    .replace(/kgs/g, 'kilogram')
    .replace(/kilograms/g, 'kilogram')
    .replace(/grams/g, 'gram')
    // Remove plural forms for easier matching (e.g. shirts -> shirt)
    .replace(/\b(\w+)(s)\b/g, '$1')
    .replace(/[.,!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Remove filler / intent words so only the product token remains
function stripIntentWords(text, intentWords) {
  const numWords = ['one','two','three','four','five','six','seven','eight','nine','ten', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  return text
    .split(' ')
    .filter(w => !intentWords.includes(w) && !numWords.includes(w) && isNaN(w) && w.length > 0)
    .join(' ')
    .trim();
}

// Compute similarity score between two strings (0 – 1)
// Uses word-overlap + substring containment
function similarityScore(a, b) {
  const wordsA = a.split(' ');
  const wordsB = b.split(' ');

  // Word overlap
  const setB = new Set(wordsB);
  const overlap = wordsA.filter(w => setB.has(w)).length;
  // Use a softer penalty for extra words in a, to allow long phrases to match short product names
  const wordScore = overlap / Math.max(1, wordsB.length); 

  // Substring containment bonus
  const containsBonus = (a.includes(b) || b.includes(a)) ? 0.3 : 0;

  return Math.min(1, wordScore + containsBonus);
}

// Find best matching product from inventory
function findBestMatch(text, products, threshold = 0.35) {
  const normText = normalise(text);
  let best = null;
  let bestScore = 0;

  for (const p of products) {
    const normName = normalise(p.name);
    // If the normalised product name is fully inside the text, it's a guaranteed match
    let score = 0;
    if (normText.includes(normName)) {
      score = 1;
    } else {
      score = similarityScore(normText, normName);
    }

    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  return bestScore >= threshold ? best : null;
}

// ─── Quantity parser ───────────────────────────────────────────────────────────
function parseQuantity(text) {
  const numMap = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, 
                   ek:1, 'do':2, teen:3, char:4, paanch:5, chey:6, chay:6, saath:7, aath:8, nau:9, das:10 };
  let quantity = 1;
  const words = normalise(text).split(' ');
  for (const word of words) {
    if (numMap[word]) { quantity = numMap[word]; break; }
  }
  const digitMatch = text.match(/\d+/);
  if (digitMatch) quantity = parseInt(digitMatch[0], 10);
  return quantity;
}

// ─── Main controller ──────────────────────────────────────────────────────────
const processCommand = async (req, res) => {
  const { command } = req.body;
  const businessId = req.user.businessId;
  const userId = req.user.id;

  if (!command) {
    return res.status(400).json({ success: false, textResponse: "Please say a command." });
  }

  const text = normalise(command);

  try {
    // ── SELL / SALE ────────────────────────────────────────────────────────────
    const isSale = text.includes('sale') || text.includes('record') || text.includes('sell') ||
                   text.includes('bech') || text.includes('sold') || text.includes('selling');

    if (isSale) {
      const quantity = parseQuantity(text);
      const products = await Product.find({ businessId });
      const matchedProduct = findBestMatch(text, products);

      if (!matchedProduct) {
        return res.json({
          success: false,
          textResponse: `I heard "${command}" but could not find a matching product in your inventory. Please check product names.`
        });
      }

      const invRecord = await Inventory.findOne({ productId: matchedProduct._id });
      if (!invRecord || invRecord.quantity < quantity) {
        return res.json({
          success: false,
          textResponse: `Not enough stock of ${matchedProduct.name}. Only ${invRecord ? invRecord.quantity : 0} available.`
        });
      }

      invRecord.quantity -= quantity;
      await invRecord.save();

      const totalAmount = matchedProduct.price * quantity;
      const newSale = await Sale.create({
        businessId, userId,
        products: [{ productId: matchedProduct._id, name: matchedProduct.name, quantity, price: matchedProduct.price }],
        totalAmount
      });
      await Invoice.create({
        saleId: newSale._id, businessId,
        invoiceNumber: `INV-${Date.now()}`,
        totalAmount
      });

      return res.json({
        success: true,
        intent: 'RECORD_SALE',
        data: newSale,
        textResponse: `Successfully sold ${quantity} ${matchedProduct.name}. Stock updated.`
      });
    }

    // ── DELETE / REMOVE ────────────────────────────────────────────────────────
    const isDelete = text.includes('delete') || text.includes('remove') || text.includes('hatao') ||
                     text.includes('hata') || text.includes('mitao');

    if (isDelete) {
      const products = await Product.find({ businessId });
      const matchedProduct = findBestMatch(text, products);

      if (!matchedProduct) {
        return res.json({
          success: false,
          textResponse: `Could not find a matching product to delete. Please be more specific.`
        });
      }

      await Inventory.deleteOne({ productId: matchedProduct._id });
      await Product.deleteOne({ _id: matchedProduct._id });

      return res.json({
        success: true,
        intent: 'DELETE_PRODUCT',
        textResponse: `${matchedProduct.name} has been deleted from your inventory.`
      });
    }

    // ── RESTOCK / ADD ──────────────────────────────────────────────────────────
    const isRestock = text.includes('add') || text.includes('restock') || text.includes('increase') ||
                      text.includes('shamil') || text.includes('jalao') || text.includes('stock');

    if (isRestock) {
      const quantity = parseQuantity(text);
      const products = await Product.find({ businessId });
      const matchedProduct = findBestMatch(text, products);

      if (!matchedProduct) {
        // Create new product from spoken name
        const intentWords = ['add', 'restock', 'increase', 'shamil', 'jalao', 'stock'];
        let newName = stripIntentWords(text, intentWords);
        newName = newName.replace(/\b\w/g, c => c.toUpperCase());

        if (!newName) {
          return res.json({ success: false, textResponse: "I couldn't determine the product name to add." });
        }

        const newProduct = await Product.create({
          businessId, name: newName, price: 0,
          description: "Auto-created from voice command"
        });
        await Inventory.create({ productId: newProduct._id, businessId, quantity });

        return res.json({
          success: true,
          intent: 'RESTOCK_INVENTORY',
          textResponse: `Created new product "${newName}" and added ${quantity} to stock.`
        });
      }

      const invRecord = await Inventory.findOne({ productId: matchedProduct._id });
      if (invRecord) {
        invRecord.quantity += quantity;
        await invRecord.save();
        return res.json({
          success: true,
          intent: 'RESTOCK_INVENTORY',
          textResponse: `Added ${quantity} ${matchedProduct.name}. Total stock is now ${invRecord.quantity}.`
        });
      } else {
        await Inventory.create({ productId: matchedProduct._id, businessId, quantity });
        return res.json({
          success: true,
          intent: 'RESTOCK_INVENTORY',
          textResponse: `Added ${quantity} ${matchedProduct.name} to inventory.`
        });
      }
    }

    // ── CHECK STOCK ────────────────────────────────────────────────────────────
    const isCheck = text.includes('inventory') || text.includes('stock') || text.includes('check') ||
                    text.includes('how many') || text.includes('kitna');

    if (isCheck) {
      const products = await Product.find({ businessId });
      const matchedProduct = findBestMatch(text, products, 0.25);

      if (matchedProduct) {
        const invRecord = await Inventory.findOne({ productId: matchedProduct._id });
        return res.json({
          success: true,
          intent: 'CHECK_INVENTORY',
          textResponse: `You have ${invRecord ? invRecord.quantity : 0} ${matchedProduct.name} in stock.`
        });
      }

      const numItems = await Inventory.countDocuments({ businessId });
      return res.json({
        success: true,
        intent: 'CHECK_INVENTORY',
        textResponse: `You have ${numItems} unique products in inventory. Say a product name to check its stock.`
      });
    }

    return res.json({
      success: true,
      intent: 'UNKNOWN',
      textResponse: "I didn't understand. Try: 'sell 2 milk', 'add 5 bread', 'check milk', or 'delete juice'."
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, textResponse: "System error processing your command." });
  }
};

module.exports = { processCommand };
