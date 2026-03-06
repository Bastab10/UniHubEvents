const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function approveSpecificUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find and approve the specific user
        const user = await User.findOne({ email: 'sir@gmail.com' });
        
        if (user) {
            user.isApproved = true;
            user.isActive = true;
            await user.save();
            console.log('✅ Approved user: sir@gmail.com');
            console.log('User details:');
            console.log(`- Username: ${user.username}`);
            console.log(`- Email: ${user.email}`);
            console.log(`- Role: ${user.role}`);
            console.log(`- Active: ${user.isActive}`);
            console.log(`- Approved: ${user.isApproved}`);
        } else {
            console.log('❌ User sir@gmail.com not found');
        }

        console.log('\n🎉 You can now login with:');
        console.log('Username: sir@gmail.com');
        console.log('Password: 123456');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

approveSpecificUser();
