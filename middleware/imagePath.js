const fs = require('fs');
const path = require('path');

// Middleware to validate and standardize image paths
exports.validateImagePath = (req, res, next) => {
    // Check if request is for an image
    if (req.path.includes('/uploads/')) {
        const imagePath = path.join(__dirname, '..', 'uploads', path.basename(req.path));
        
        // Verify file exists
        if (fs.existsSync(imagePath)) {
            console.log('✅ Image path validated:', req.path);
            console.log('✅ File exists at:', imagePath);
            return next();
        } else {
            console.log('❌ Image not found:', req.path);
            console.log('❌ Expected at:', imagePath);
            return res.status(404).json({ error: 'Image not found' });
        }
    } else {
        return next();
    }
};
