const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Event = require('../models/Event');
require('dotenv').config();

async function seedDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Event.deleteMany({});
        console.log('Cleared existing data');

        // Create admin user
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
        console.log('Created admin user');

        // Create faculty users
        const facultyPassword = await bcrypt.hash('faculty123', 10);
        const faculty1 = new User({
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
        await faculty1.save();

        const faculty2 = new User({
            username: 'sarah.jones',
            email: 'sarah.jones@college.edu',
            password: facultyPassword,
            role: 'faculty',
            profile: {
                firstName: 'Sarah',
                lastName: 'Jones',
                collegeId: 'FAC002',
                department: 'Physical Education',
                phone: '1234567892'
            },
            isActive: true,
            isApproved: true
        });
        await faculty2.save();
        console.log('Created faculty users');

        // Create student users
        const studentPassword = await bcrypt.hash('student123', 10);
        const students = [
            {
                username: 'alice.wilson',
                email: 'alice.wilson@college.edu',
                profile: {
                    firstName: 'Alice',
                    lastName: 'Wilson',
                    collegeId: 'STU001',
                    year: '2nd Year',
                    phone: '1234567893'
                }
            },
            {
                username: 'bob.brown',
                email: 'bob.brown@college.edu',
                profile: {
                    firstName: 'Bob',
                    lastName: 'Brown',
                    collegeId: 'STU002',
                    year: '3rd Year',
                    phone: '1234567894'
                }
            },
            {
                username: 'charlie.davis',
                email: 'charlie.davis@college.edu',
                profile: {
                    firstName: 'Charlie',
                    lastName: 'Davis',
                    collegeId: 'STU003',
                    year: '1st Year',
                    phone: '1234567895'
                }
            }
        ];

        for (const studentData of students) {
            const student = new User({
                ...studentData,
                password: studentPassword,
                role: 'student',
                isActive: true,
                isApproved: true
            });
            await student.save();
        }
        console.log('Created student users');

        // Create sample events
        const events = [
            {
                title: 'Web Development Workshop',
                description: 'Learn modern web development technologies including React, Node.js, and MongoDB',
                category: 'workshop',
                date: new Date('2024-12-20'),
                startTime: '09:00',
                endTime: '17:00',
                venue: 'Computer Lab 101',
                maxParticipants: 30,
                organizer: faculty1._id,
                status: 'approved'
            },
            {
                title: 'AI and Machine Learning Seminar',
                description: 'Introduction to artificial intelligence and machine learning concepts',
                category: 'seminar',
                date: new Date('2024-12-22'),
                startTime: '14:00',
                endTime: '16:00',
                venue: 'Main Auditorium',
                maxParticipants: 100,
                organizer: faculty1._id,
                status: 'approved'
            },
            {
                title: 'Annual Cultural Festival',
                description: 'College cultural festival with music, dance, and drama performances',
                category: 'cultural',
                date: new Date('2024-12-25'),
                startTime: '18:00',
                endTime: '22:00',
                venue: 'College Ground',
                maxParticipants: 500,
                organizer: faculty2._id,
                status: 'approved'
            },
            {
                title: 'Cricket Tournament',
                description: 'Inter-department cricket championship',
                category: 'sports',
                subCategory: 'Cricket',
                eventType: 'team',
                teamSize: 11,
                date: new Date('2024-12-28'),
                startTime: '08:00',
                endTime: '17:00',
                venue: 'Sports Ground',
                maxParticipants: 88, // 8 teams
                organizer: faculty2._id,
                status: 'approved'
            },
            {
                title: 'Chess Competition',
                description: 'Annual chess championship for all students',
                category: 'sports',
                subCategory: 'Chess',
                eventType: 'individual',
                date: new Date('2024-12-30'),
                startTime: '10:00',
                endTime: '18:00',
                venue: 'Game Room',
                maxParticipants: 32,
                organizer: faculty2._id,
                status: 'pending'
            }
        ];

        for (const eventData of events) {
            const event = new Event(eventData);
            await event.save();
        }
        console.log('Created sample events');

        console.log('Database seeded successfully!');
        console.log('\nLogin Credentials:');
        console.log('Admin: admin / admin123');
        console.log('Faculty: john.smith / faculty123');
        console.log('Faculty: sarah.jones / faculty123');
        console.log('Student: alice.wilson / student123');
        console.log('Student: bob.brown / student123');
        console.log('Student: charlie.davis / student123');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Run the seed function
seedDatabase();
