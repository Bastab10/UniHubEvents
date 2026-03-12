const path = require('path');

// Environment configuration for consistent paths
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Base URL configuration
const config = {
    development: {
        baseUrl: 'http://localhost:8080',
        uploadPath: '/uploads/',
        fullUploadPath: path.join(__dirname, '../uploads')
    },
    production: {
        baseUrl: process.env.BASE_URL || 'https://your-app-name.onrender.com',
        uploadPath: '/uploads/',
        fullUploadPath: path.join(__dirname, 'uploads')
    }
};

// Get current environment config
const currentConfig = config[isProduction ? 'production' : 'development'];

module.exports = {
    isProduction,
    isDevelopment,
    baseUrl: currentConfig.baseUrl,
    uploadPath: currentConfig.uploadPath,
    fullUploadPath: currentConfig.fullUploadPath,
    
    // Helper function to get full image URL
    getImageUrl: (filename) => {
        return currentConfig.baseUrl + currentConfig.uploadPath + filename;
    },
    
    // Helper function to get relative path for database
    getRelativePath: (filename) => {
        return currentConfig.uploadPath + filename;
    }
};
