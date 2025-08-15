const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/warranty_system';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemas
const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'super_admin'], default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

const WarrantyNumberSchema = new mongoose.Schema({
  warrantyNumber: { type: String, required: true, unique: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  isUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  usedAt: { type: Date },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'WarrantyRegistration' }
});

const WarrantyRegistrationSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  product: { type: String, required: true },
  productId: { type: String, required: true },
  source: { type: String, required: true },
  orderId: { type: String, required: true },
  warrantyNumber: { type: String, required: true },
  purchaseDate: { type: Date, required: true },
  warrantyStartDate: { type: Date, default: Date.now },
  warrantyEndDate: { type: Date },
  status: { type: String, enum: ['active', 'expired', 'claimed'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

// Models
const Admin = mongoose.model('Admin', AdminSchema);
const WarrantyNumber = mongoose.model('WarrantyNumber', WarrantyNumberSchema);
const WarrantyRegistration = mongoose.model('WarrantyRegistration', WarrantyRegistrationSchema);

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

// Authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Initialize default admin
const initializeAdmin = async () => {
  try {
    const adminExists = await Admin.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword,
        role: 'super_admin'
      });
      console.log('Default admin created: username=admin, password=admin123');
    }
  } catch (error) {
    console.error('Error initializing admin:', error);
  }
};

// Routes

// Admin Authentication
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, admin: { id: admin._id, username: admin.username, role: admin.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Warranty Number Management
app.post('/api/admin/warranty-numbers/upload', authenticateAdmin, upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    const errors = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        if (data.warrantyNumber && data.productId && data.productName) {
          results.push({
            warrantyNumber: data.warrantyNumber.trim(),
            productId: data.productId.trim(),
            productName: data.productName.trim()
          });
        }
      })
      .on('end', async () => {
        try {
          let successCount = 0;
          
          for (const item of results) {
            try {
              await WarrantyNumber.create(item);
              successCount++;
            } catch (error) {
              if (error.code === 11000) {
                errors.push(`Warranty number ${item.warrantyNumber} already exists`);
              } else {
                errors.push(`Error with ${item.warrantyNumber}: ${error.message}`);
              }
            }
          }

          fs.unlinkSync(req.file.path);

          res.json({
            message: `Successfully imported ${successCount} warranty numbers`,
            errors: errors.length > 0 ? errors : undefined
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/warranty-numbers', authenticateAdmin, async (req, res) => {
  try {
    const { warrantyNumber, productId, productName } = req.body;
    
    if (!warrantyNumber || !productId || !productName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const newWarrantyNumber = await WarrantyNumber.create({
      warrantyNumber,
      productId,
      productName
    });

    res.json(newWarrantyNumber);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Warranty number already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/admin/warranty-numbers', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.productId) filter.productId = req.query.productId;
    if (req.query.isUsed !== undefined) filter.isUsed = req.query.isUsed === 'true';

    const warrantyNumbers = await WarrantyNumber.find(filter)
      .populate('registrationId', 'fullName email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await WarrantyNumber.countDocuments(filter);

    res.json({
      warrantyNumbers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Warranty Registration (Public endpoint)
app.post('/api/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      fullName,
      email,
      product,
      productId,
      source,
      orderId,
      warrantyNumber,
      purchaseDate
    } = req.body;

    const validWarrantyNumber = await WarrantyNumber.findOne({
      warrantyNumber,
      productId,
      isUsed: false
    });

    if (!validWarrantyNumber) {
      return res.status(400).json({ 
        error: 'Invalid warranty number or product mismatch' 
      });
    }

    const warrantyEndDate = new Date(purchaseDate);
    warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + 1);

    const registration = await WarrantyRegistration.create({
      firstName,
      lastName,
      fullName,
      email,
      product,
      productId,
      source,
      orderId,
      warrantyNumber,
      purchaseDate: new Date(purchaseDate),
      warrantyEndDate
    });

    await WarrantyNumber.findByIdAndUpdate(validWarrantyNumber._id, {
      isUsed: true,
      usedAt: new Date(),
      registrationId: registration._id
    });

    res.json({ 
      message: 'Warranty registered successfully',
      registrationId: registration._id,
      warrantyEndDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Warranty Registration Management
app.get('/api/admin/registrations', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.productId) filter.productId = req.query.productId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.email) filter.email = new RegExp(req.query.email, 'i');

    const registrations = await WarrantyRegistration.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await WarrantyRegistration.countDocuments(filter);

    res.json({
      registrations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export warranty data to CSV
app.get('/api/admin/export/registrations', authenticateAdmin, async (req, res) => {
  try {
    const registrations = await WarrantyRegistration.find({});
    
    const csvWriter = createCsvWriter({
      path: 'exports/warranty_registrations.csv',
      header: [
        { id: 'fullName', title: 'Full Name' },
        { id: 'email', title: 'Email' },
        { id: 'product', title: 'Product' },
        { id: 'source', title: 'Purchase Source' },
        { id: 'orderId', title: 'Order ID' },
        { id: 'warrantyNumber', title: 'Warranty Number' },
        { id: 'purchaseDate', title: 'Purchase Date' },
        { id: 'warrantyEndDate', title: 'Warranty End Date' },
        { id: 'status', title: 'Status' },
        { id: 'createdAt', title: 'Registration Date' }
      ]
    });

    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }

    await csvWriter.writeRecords(registrations);
    
    res.download('exports/warranty_registrations.csv', 'warranty_registrations.csv', (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      setTimeout(() => {
        if (fs.existsSync('exports/warranty_registrations.csv')) {
          fs.unlinkSync('exports/warranty_registrations.csv');
        }
      }, 5000);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalWarrantyNumbers = await WarrantyNumber.countDocuments();
    const usedWarrantyNumbers = await WarrantyNumber.countDocuments({ isUsed: true });
    const totalRegistrations = await WarrantyRegistration.countDocuments();
    const activeWarranties = await WarrantyRegistration.countDocuments({ 
      status: 'active',
      warrantyEndDate: { $gt: new Date() }
    });

    const productStats = await WarrantyRegistration.aggregate([
      { $group: { _id: '$productId', count: { $sum: 1 }, product: { $first: '$product' } } },
      { $sort: { count: -1 } }
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRegistrations = await WarrantyRegistration.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      totalWarrantyNumbers,
      usedWarrantyNumbers,
      availableWarrantyNumbers: totalWarrantyNumbers - usedWarrantyNumbers,
      totalRegistrations,
      activeWarranties,
      recentRegistrations,
      productStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeAdmin();
});

module.exports = app;
