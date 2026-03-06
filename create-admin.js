const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://BastabMongodb:BastabMongodbss@cluster0.lbwfgip.mongodb.net/BCAfinalyr?appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to MongoDB');
    
    try {
        // Check if admin user already exists
        const existingAdmin = await User.findOne({ email: 'bs@gmail.com', role: 'admin' });
        
        if (existingAdmin) {
            console.log('Admin user already exists:', existingAdmin.email);
        } else {
            // Create admin user
            const hashedPassword = await bcrypt.hash('098098', 10);
            
            const adminUser = new User({
                username: 'bs',
                email: 'bs@gmail.com',
                password: hashedPassword,
                role: 'admin',
                profile: {
                    firstName: 'Admin',
                    lastName: 'User',
                    email: 'bs@gmail.com',
                    collegeId: 'ADMIN001',
                    verified: true
                },
                isActive: true,
                isApproved: true
            });
            
            await adminUser.save();
            console.log('Admin user created successfully!');
            console.log('Email: bs@gmail.com');
            console.log('Password: 098098');
            console.log('Role: admin');
        }
        
        // List all admin users
        const allAdmins = await User.find({ role: 'admin' });
        console.log('\nAll admin users in database:');
        allAdmins.forEach(admin => {
            console.log(`- ${admin.email} (${admin.username})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
}).catch(console.error);
