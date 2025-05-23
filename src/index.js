require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const pool = require('./config/database');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Add this root route
// After your middleware and before other routes
app.get('/', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'School Management API is running',
      endpoints: {
        root: '/',
        addSchool: '/addSchool',
        listSchools: '/listSchools'
      }
    });
  } catch (error) {
    handleError(res, error, 'Error in root route');
  }
});

// Custom error handler
const handleError = (res, error, message = 'An error occurred') => {
  console.error(`${message}:`, error);
  res.status(500).json({
    success: false,
    message,
    error: error.message
  });
};

// Helper function to validate coordinates
const isValidCoordinates = (lat, lng) => {
  return !isNaN(lat) && !isNaN(lng) && 
         lat >= -90 && lat <= 90 && 
         lng >= -180 && lng <= 180;
};

// Helper function to format school data
const formatSchoolData = (school) => ({
  id: school.id,
  name: school.name,
  address: school.address,
  latitude: parseFloat(school.latitude.toFixed(6)),
  longitude: parseFloat(school.longitude.toFixed(6)),
  distance: parseFloat(school.distance.toFixed(2)),
  created_at: school.created_at
});

// Validation middleware
const validateSchool = [
  body('name')
    .notEmpty()
    .withMessage('School name is required')
    .trim(),
  body('address')
    .notEmpty()
    .withMessage('Address is required')
    .trim(),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude')
];

// Add School API
app.post('/addSchool', validateSchool, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { name, address, latitude, longitude } = req.body;
    
    // Insert school data into database
    const [result] = await pool.execute(
      'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)',
      [name, address, latitude, longitude]
    );

    res.status(201).json({
      success: true,
      message: 'School added successfully',
      schoolId: result.insertId
    });
  } catch (error) {
    handleError(res, error, 'Error adding school');
  }
});

// List Schools API
app.get('/listSchools', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    // Validate required parameters
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Parse and validate coordinates
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);

    if (!isValidCoordinates(userLat, userLng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates provided'
      });
    }

    // Query schools with distance calculation using Haversine formula
    const [schools] = await pool.execute(
      `SELECT *,
        (
          6371 * acos(
            cos(radians(?)) * 
            cos(radians(latitude)) * 
            cos(radians(longitude) - radians(?)) + 
            sin(radians(?)) * 
            sin(radians(latitude))
          )
        ) AS distance
      FROM schools
      HAVING distance IS NOT NULL
      ORDER BY distance ASC`,
      [userLat, userLng, userLat]
    );

    // Format and return response
    const formattedSchools = schools.map(formatSchoolData);

    res.json({
      success: true,
      schools: formattedSchools,
      total: formattedSchools.length,
      userLocation: {
        latitude: userLat,
        longitude: userLng
      },
      distanceUnit: "kilometers"
    });
  } catch (error) {
    handleError(res, error, 'Error fetching schools');
  }
});

// Create schools table if it doesn't exist
async function initializeDatabase() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS schools (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Make sure to call this when server starts
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  await initializeDatabase();
});

// Add after your middleware setup
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});