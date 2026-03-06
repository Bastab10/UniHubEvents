const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

console.log('🔍 TROUBLESHOOTING COLLEGE EVENT MANAGEMENT SYSTEM\n');

// Check 1: Environment Variables
console.log('\n📋 1. Checking Environment Variables...');
try {
    require('dotenv').config();
    
    const requiredEnvVars = ['PORT', 'MONGODB_URI', 'SESSION_SECRET'];
    let envIssues = [];
    
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            envIssues.push(varName);
        }
    });
    
    if (envIssues.length > 0) {
        console.log('❌ Missing environment variables:', envIssues.join(', '));
        console.log('💡 Solution: Add these variables to your .env file');
    } else {
        console.log('✅ All environment variables are set');
    }
} catch (error) {
    console.log('❌ Environment variable error:', error.message);
}

// Check 2: Required Directories
console.log('\n📁 2. Checking Required Directories...');
const requiredDirs = ['uploads', 'public', 'views'];
let dirIssues = [];

requiredDirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
        dirIssues.push(dir);
    }
});

if (dirIssues.length > 0) {
    console.log('❌ Missing directories:', dirIssues.join(', '));
    console.log('💡 Solution: Creating missing directories...');
    dirIssues.forEach(dir => {
        const dirPath = path.join(__dirname, '..', dir);
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    });
} else {
    console.log('✅ All required directories exist');
}

// Check 3: Required View Files
console.log('\n📄 3. Checking Required View Files...');
const requiredViews = [
    'views/auth/login.ejs',
    'views/auth/register.ejs',
    'views/admin/dashboard.ejs',
    'views/faculty/dashboard.ejs',
    'views/faculty/create-event.ejs',
    'views/student/dashboard.ejs',
    'views/student/profile.ejs',
    'views/student/browse-events.ejs',
    'views/student/participation-history.ejs',
    'views/student/my-registrations.ejs',
    'views/student/event-details.ejs',
    'views/partials/header.ejs',
    'views/partials/sidebar.ejs',
    'views/partials/footer.ejs',
    'views/error.ejs'
];

let viewIssues = [];

requiredViews.forEach(view => {
    const viewPath = path.join(__dirname, '..', view);
    if (!fs.existsSync(viewPath)) {
        viewIssues.push(view);
    }
});

if (viewIssues.length > 0) {
    console.log('❌ Missing view files:', viewIssues.length);
    console.log('💡 Solution: Create missing view files');
} else {
    console.log('✅ All required view files exist');
}

// Check 4: Database Connection
console.log('\n🗄️ 4. Testing Database Connection...');
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ Database connection successful');
    
    // Check 5: Test User Creation
    console.log('\n👤 5. Testing User Models...');
    const User = require('../models/User');
    
    User.findOne({ email: 'admin@college.edu' })
    .then(user => {
        if (user) {
            console.log('✅ Admin user found in database');
        } else {
            console.log('❌ Admin user not found');
            console.log('💡 Solution: Run npm run seed to create default users');
        }
    })
    .catch(err => {
        console.log('❌ User model error:', err.message);
    });
    
    // Check 6: Test Event Creation
    console.log('\n📅 6. Testing Event Models...');
    const Event = require('../models/Event');
    
    Event.countDocuments()
    .then(count => {
        console.log(`✅ Event model working - ${count} events in database`);
    })
    .catch(err => {
        console.log('❌ Event model error:', err.message);
    });
    
    mongoose.disconnect();
})
.catch(err => {
    console.log('❌ Database connection failed:', err.message);
    console.log('💡 Solution:');
    console.log('   1. Check MongoDB URI in .env file');
    console.log('   2. Ensure MongoDB Atlas is accessible');
    console.log('   3. Check network connectivity');
});

// Check 7: Package Dependencies
console.log('\n📦 7. Checking Package Dependencies...');
try {
    const packageJson = require('../package.json');
    const requiredDeps = ['express', 'ejs', 'mongoose', 'bcryptjs', 'express-session', 'connect-mongo', 'multer', 'cors', 'express-validator', 'dotenv'];
    let depIssues = [];
    
    requiredDeps.forEach(dep => {
        if (!packageJson.dependencies[dep]) {
            depIssues.push(dep);
        }
    });
    
    if (depIssues.length > 0) {
        console.log('❌ Missing dependencies:', depIssues.join(', '));
        console.log('💡 Solution: Run npm install');
    } else {
        console.log('✅ All required dependencies are in package.json');
    }
} catch (error) {
    console.log('❌ Package.json error:', error.message);
}

// Check 8: Node Modules
console.log('\n📚 8. Checking Node Modules...');
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
    console.log('✅ Node modules directory exists');
} else {
    console.log('❌ Node modules directory missing');
    console.log('💡 Solution: Run npm install');
}

// Check 9: Port Availability
console.log('\n🌐 9. Checking Port Configuration...');
const port = process.env.PORT || 3000;
console.log(`✅ Server configured for port ${port}`);
console.log('💡 If port is in use, the server will show an error on startup');

// Summary
console.log('\n🎯 TROUBLESHOOTING COMPLETE');
console.log('\n📋 QUICK FIXES:');
console.log('1. If database connection fails: Check .env MONGODB_URI');
console.log('2. If views are missing: Run npm run seed');
console.log('3. If uploads fail: Ensure uploads directory exists');
console.log('4. If server crashes: Check all dependencies are installed');
console.log('5. If login fails: Check user approval status');
console.log('\n🚀 START SERVER: npm run dev');
console.log('🌐 ACCESS SYSTEM: http://localhost:3000');
