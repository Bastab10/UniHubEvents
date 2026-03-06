const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function createAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');

        // Check if admin user already exists
        const existingAdmin = await User.findOne({ role: 'admin' });
        
        if (existingAdmin) {
            console.log('Admin user already exists:');
            console.log('Email:', existingAdmin.email);
            console.log('Name:', existingAdmin.profile.firstName, existingAdmin.profile.lastName);
            return;
        }

        // Create admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const admin = new User({
            email: 'admin@college.edu',
            password: hashedPassword,
            role: 'admin',
            isApproved: true,
            isActive: true,
            profile: {
                firstName: 'System',
                lastName: 'Administrator'
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await admin.save();
        
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email: admin@college.edu');
        console.log('🔑 Password: admin123');
        console.log('👤 Name: System Administrator');
        console.log('🎯 Role: admin');
        console.log('✅ Status: Active & Approved');
        
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB disconnected');
    }
}

// Run the function
createAdmin();
