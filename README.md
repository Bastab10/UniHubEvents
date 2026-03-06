# College Event & Sports Management System

A comprehensive web-based platform for managing college events, sports activities, and participant registrations with role-based access control.

## Features

### 🔐 Admin Panel
- **Dashboard Overview**: Real-time analytics and system insights
- **User Management**: Manage students and faculty accounts
- **Event Management**: Approve/reject events, manage schedules
- **Registration Management**: Monitor and approve event registrations
- **Sports Management**: Add sports categories and manage competitions
- **Time Clash Detection**: Automatic detection of scheduling conflicts

### 👨‍🏫 Faculty Panel
- **Dashboard**: Track created events and participation statistics
- **Event Creation**: Create and manage institutional events
- **Participant Monitoring**: View and manage event registrations
- **Attendance Tracking**: Mark attendance for completed events
- **Event Status Tracking**: Monitor approval status and completion

### 🎓 Student Panel
- **Dashboard**: View registered events and upcoming schedules
- **Event Discovery**: Browse and filter events by category
- **Event Registration**: Register for events with validation
- **Registration Status**: Track approval status of registrations
- **Participation History**: View past event participation

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **EJS** - Template engine
- **bcryptjs** - Password hashing
- **express-session** - Session management
- **multer** - File upload handling

### Frontend
- **Tailwind CSS** - Utility-first CSS framework
- **Font Awesome** - Icons
- **Chart.js** - Data visualization
- **JavaScript** - Client-side functionality

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd college-event-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Copy `.env.example` to `.env` and update the following variables:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/college_event_management
   SESSION_SECRET=your_session_secret_key_here_change_in_production
   NODE_ENV=development
   ```

4. **Database Setup**
   - Ensure MongoDB is running on your system
   - The application will automatically create the database and collections

5. **Seed the Database** (Optional)
   ```bash
   npm run seed
   ```
   This will create sample users, events, and sports categories.

6. **Start the Application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

7. **Access the Application**
   Open your browser and navigate to `http://localhost:3000`

## Default Login Credentials

After running the seed script, you can use these credentials:

### Admin
- **Username**: `admin`
- **Password**: `admin123`

### Faculty
- **Username**: `john.smith`
- **Password**: `faculty123`

### Students
- **Username**: `alice.wilson`
- **Password**: `student123`
- **Username**: `bob.brown`
- **Password**: `student123`
- **Username**: `charlie.davis`
- **Password**: `student123`

## Project Structure

```
college-event-management/
├── controllers/          # Route controllers
├── middleware/           # Custom middleware
├── models/              # Database models
├── routes/              # Application routes
├── scripts/             # Utility scripts
├── views/               # EJS templates
│   ├── admin/           # Admin panel views
│   ├── faculty/         # Faculty panel views
│   ├── student/         # Student panel views
│   ├── auth/            # Authentication views
│   └── partials/        # Shared template components
├── public/              # Static assets
│   ├── css/             # Custom CSS
│   ├── js/              # Client-side JavaScript
│   └── images/          # Image assets
├── uploads/             # File upload directory
├── .env                 # Environment variables
├── package.json         # Project dependencies
├── server.js            # Application entry point
└── README.md            # This file
```

## Key Features

### Role-Based Access Control
- Secure authentication system
- Role-specific dashboards and functionalities
- Session-based authentication

### Event Management
- Create, edit, and delete events
- Event categorization (seminar, workshop, cultural, sports)
- Time and venue clash detection
- Event approval workflow

### Registration System
- Student event registration
- Registration approval process
- Time conflict prevention
- Team and individual event support

### Sports Management
- Sports category management
- Team formation and player management
- Equipment and rules tracking

### Analytics and Reporting
- Dashboard statistics
- Event participation charts
- User activity tracking

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/logout` - User logout

### Admin Routes
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/users` - User management
- `POST /admin/users/:id/approve` - Approve user
- `GET /admin/events` - Event management
- `POST /admin/events/:id/approve` - Approve event

### Faculty Routes
- `GET /faculty/dashboard` - Faculty dashboard
- `GET /faculty/events/create` - Create event form
- `POST /faculty/events/create` - Create new event
- `GET /faculty/events` - My events
- `GET /faculty/events/:id/registrations` - Event registrations

### Student Routes
- `GET /student/dashboard` - Student dashboard
- `GET /student/events` - Browse events
- `POST /student/events/:id/register` - Register for event
- `GET /student/registrations` - My registrations
- `GET /student/history` - Participation history

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and queries, please contact the development team or create an issue in the repository.

## Future Enhancements

- Email notifications for event updates
- Mobile application
- Advanced analytics and reporting
- Integration with college ERP system
- Payment gateway for paid events
- Live streaming for virtual events
