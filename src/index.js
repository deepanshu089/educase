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

// Validation middleware
const validateSchool = [
  body('name').notEmpty().withMessage('School name is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
];

// Add School API
app.post('/addSchool', validateSchool, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, address, latitude, longitude } = req.body;
    
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
    console.error('Error adding school:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding school',
      error: error.message
    });
  }
});

// List Schools API
app.get('/listSchools', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Convert coordinates to numbers
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);

    // Validate coordinates
    if (isNaN(userLat) || isNaN(userLng) || 
        userLat < -90 || userLat > 90 || 
        userLng < -180 || userLng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates provided'
      });
    }

    // Get all schools and calculate distance using Haversine formula
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

    // Format the response
    const formattedSchools = schools.map(school => ({
      id: school.id,
      name: school.name,
      address: school.address,
      latitude: parseFloat(school.latitude.toFixed(6)),
      longitude: parseFloat(school.longitude.toFixed(6)),
      distance: parseFloat(school.distance.toFixed(2)),
      created_at: school.created_at
    }));

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
    console.error('Error fetching schools:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schools',
      error: error.message
    });
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
  }
}

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  initializeDatabase();
}); 