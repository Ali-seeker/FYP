const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database (Using local MongoDB with dynamic db creation)
connectDB();

// Init Middleware
app.use(cors());
app.use(express.json());

// Require Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/sync', require('./routes/syncRoutes'));

app.get('/', (req, res) => res.send('API Running'));

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
