const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function approveAndCreateUsers() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find and approve the existing user
        const existingUser = await User.findOne({ email: 'bs@gmail.com' });
        if (existingUser) {
            existingUser.isApproved = true;
            existingUser.isActive = true;
            await existingUser.save();
            console.log('✅ Approved existing user: bs@gmail.com');
        }

        // Create admin user if not exists
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const adminPassword = await bcrypt.hash('admin123', 10);
            const admin = new User({
                username: 'admin',
                email: 'admin@college.edu',
                password: adminPassword,
                role: 'admin',
                profile: {
                    firstName: 'System',
                    lastName: 'Administrator',
                    collegeId: 'ADMIN001',
                    phone: '1234567890'
                },
                isActive: true,
                isApproved: true
            });
            await admin.save();
            console.log('✅ Created admin user: admin / admin123');
        }

        // Create faculty user if not exists
        const facultyExists = await User.findOne({ username: 'john.smith' });
        if (!facultyExists) {
            const facultyPassword = await bcrypt.hash('faculty123', 10);
            const faculty = new User({
                username: 'john.smith',
                email: 'john.smith@college.edu',
                password: facultyPassword,
                role: 'faculty',
                profile: {
                    firstName: 'John',
                    lastName: 'Smith',
                    collegeId: 'FAC001',
                    department: 'Computer Science',
                    phone: '1234567891'
                },
                isActive: true,
                isApproved: true
            });
            await faculty.save();
            console.log('✅ Created faculty user: john.smith / faculty123');
        }

        // Create student user if not exists
        const studentExists = await User.findOne({ username: 'alice.wilson' });
        if (!studentExists) {
            const studentPassword = await bcrypt.hash('student123', 10);
            const student = new User({
                username: 'alice.wilson',
                email: 'alice.wilson@college.edu',
                password: studentPassword,
                role: 'student',
                profile: {
                    firstName: 'Alice',
                    lastName: 'Wilson',
                    collegeId: 'STU001',
                    year: '2nd Year',
                    phone: '1234567893'
                },
                isActive: true,
                isApproved: true
            });
            await student.save();
            console.log('✅ Created student user: alice.wilson / student123');
        }

        // Display all users
        const allUsers = await User.find({});
        console.log('\n📋 All users in database:');
        allUsers.forEach(user => {
            console.log(`- ${user.username} (${user.email}) - Role: ${user.role} - Active: ${user.isActive}, Approved: ${user.isApproved}`);
        });

        console.log('\n🎉 Setup complete! You can now login with these credentials:');
        console.log('Your approved user: bs@gmail.com / 098098');
        console.log('Admin: admin / admin123');
        console.log('Faculty: john.smith / faculty123');
        console.log('Student: alice.wilson / student123');

    } catch (error) {
        console.error('❌ Setup error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

approveAndCreateUsers();
