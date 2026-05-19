const User = require('../models/User');
const Business = require('../models/Business');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (id, businessId, role) => {
  return jwt.sign({ id, businessId, role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '30d' });
};

const registerUser = async (req, res) => {
  const { name, email, password, businessName } = req.body;
  
  if (!name || !email || !password || !businessName) {
    return res.status(400).json({ success: false, message: "Please drop all required fields" });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ success: false, message: "User already exists" });
  }

  // Create Business
  const business = await Business.create({
    name: businessName,
    type: 'general'
  });

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create User
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    businessId: business._id,
    role: 'owner'
  });

  if (user) {
    res.status(201).json({
      success: true,
      _id: user.id,
      name: user.name,
      email: user.email,
      businessId: user.businessId,
      token: generateToken(user.id, user.businessId, user.role)
    });
  } else {
    res.status(400).json({ success: false, message: "Invalid user data" });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      success: true,
      _id: user.id,
      name: user.name,
      email: user.email,
      businessId: user.businessId,
      token: generateToken(user.id, user.businessId, user.role)
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
};

const getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json({ success: true, data: user });
};

module.exports = { registerUser, loginUser, getMe };
