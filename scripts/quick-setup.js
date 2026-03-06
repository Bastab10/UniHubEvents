const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function quickSetup() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin exists
        const existingAdmin = await User.findOne({ username: 'admin' });
        
        if (!existingAdmin) {
            console.log('Creating admin user...');
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
            console.log('✅ Admin user created: admin / admin123');
        } else {
            console.log('✅ Admin user already exists');
        }

        // Check if faculty exists
        const existingFaculty = await User.findOne({ username: 'john.smith' });
        
        if (!existingFaculty) {
            console.log('Creating faculty user...');
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
            console.log('✅ Faculty user created: john.smith / faculty123');
        } else {
            console.log('✅ Faculty user already exists');
        }

        // Check if student exists
        const existingStudent = await User.findOne({ username: 'alice.wilson' });
        
        if (!existingStudent) {
            console.log('Creating student user...');
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
            console.log('✅ Student user created: alice.wilson / student123');
        } else {
            console.log('✅ Student user already exists');
        }

        // Display all users
        const allUsers = await User.find({});
        console.log('\n📋 All users in database:');
        allUsers.forEach(user => {
            console.log(`- ${user.username} (${user.role}) - Active: ${user.isActive}, Approved: ${user.isApproved}`);
        });

        console.log('\n🎉 Setup complete! You can now login with these credentials:');
        console.log('Admin: admin / admin123');
        console.log('Faculty: john.smith / faculty123');
        console.log('Student: alice.wilson / student123');

    } catch (error) {
        console.error('❌ Setup error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

quickSetup();
