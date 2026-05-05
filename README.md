# College Event & Sports Management System

A comprehensive web-based platform for managing college events, sports competitions, and registrations with role-based access for Admin, Faculty, and Students.

## 🌟 Features

### For Admin
- **Dashboard**: Overview of system statistics and pending approvals
- **User Management**: Manage students and faculty accounts
  - Approve/reject faculty registrations
  - Block/unblock users
  - View detailed user profiles
- **Event Management**: 
  - View and approve pending events
  - Manage approved events
  - View past events and their details
- **Registration Management**: 
  - Approve/reject student event registrations
  - View registration statistics
- **Department Teams**: View teams registered per department

### For Faculty (Event Coordinators)
- **Dashboard**: View created events and pending registrations
- **Event Creation**: Create new events with:
  - Event details (title, description, category)
  - Event type (Individual/Team)
  - Team event format (Knockout/Ranking)
  - Schedule (date, time, venue)
  - Event poster upload
  - Team size and department limits
- **Event Management**: 
  - Edit existing events
  - View event details and registered students
  - Approve/reject student registrations
  - Upload event results (1st, 2nd, 3rd positions)
- **Live Match Updates** (for knockout events):
  - Start match notifications
  - Declare winner
  - Next match announcements
- **Department Teams**: View and manage department-specific teams
- **Profile**: Update personal information

### For Students
- **Dashboard**: Browse available events and view live updates
- **Event Registration**: 
  - Register for individual events
  - Register team events with team members
  - View registration status (pending/approved/rejected)
- **Event Details**: View detailed event information
- **My Registrations**: Track all registered events
- **Past Events**: View completed events and results
- **Profile**: Update personal information

## 🛠️ Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - Database (with Mongoose ODM)
- **Express Session** - Session management with MongoDB store
- **Bcryptjs** - Password hashing
- **Multer** - File upload handling
- **Cloudinary** - Cloud image storage
- **Express Validator** - Input validation

### Frontend
- **EJS** - Template engine
- **Tailwind CSS** - Utility-first CSS framework
- **Font Awesome** - Icons
- **Vanilla JavaScript** - Client-side logic

### Development Tools
- **Nodemon** - Auto-restart development server
- **Dotenv** - Environment variable management

## 📁 Project Structure

```
UniHunEvent/
├── config/              # Configuration files
├── middleware/          # Custom middleware (auth)
├── models/              # Mongoose schemas
│   ├── User.js         # User model (admin, faculty, student)
│   ├── Event.js        # Event model
│   ├── Notification.js  # Notification model
│   └── Result.js       # Result model
├── routes/              # Express routes
│   ├── auth.js         # Authentication routes
│   ├── admin.js        # Admin routes
│   ├── faculty.js      # Faculty routes
│   ├── student.js      # Student routes
│   └── events.js       # Public event routes
├── scripts/             # Utility scripts
│   └── seed.js         # Database seeding
├── public/              # Static assets
│   ├── css/            # Custom stylesheets
│   └── images/         # Images
├── views/               # EJS templates
│   ├── admin/          # Admin views
│   ├── faculty/        # Faculty views
│   ├── student/        # Student views
│   ├── auth/           # Authentication views
│   ├── partials/       # Reusable components (header, footer, sidebar)
│   ├── home.ejs        # Landing page
│   ├── about.ejs       # About page
│   ├── contact.ejs     # Contact page
│   └── error.ejs       # Error page
├── .env                 # Environment variables
├── .gitignore          # Git ignore rules
├── package.json        # Dependencies
├── server.js           # Main application file
└── README.md           # This file
```

## 🚀 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd UniHunEvent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=8080
   MONGODB_URI=mongodb://localhost:27017/college-events
   SESSION_SECRET=your-secret-key-here
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. **Start MongoDB**
   - For local MongoDB: `mongod`
   - Or use MongoDB Atlas (cloud)

5. **Run the application**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Seed database (optional)**
   ```bash
   npm run seed
   ```

7. **Access the application**
   - Open browser: `http://localhost:8080`

## 👥 User Roles & Access

### Admin
- **Default Access**: First admin needs to be created via database or registration
- **Permissions**: Full system control, user management, event approvals
- **College ID Format**: `FAC001`, `DEPT123` (custom format)

### Faculty (Event Coordinators)
- **Registration**: Faculty must register and get approved by admin
- **College ID Format**: `FAC001`, `DEPT123`
- **Permissions**: Create events, manage registrations, upload results

### Student
- **Registration**: Students can register directly (auto-approved)
- **College ID Format**: `YYCourseRollNo` (e.g., `23BA123`, `24BCA456`)
  - YY: Year (2 digits)
  - Course: BA, BCA, BSC, BPES
  - RollNo: 3 digits
- **Permissions**: Browse events, register, view results

## 📊 Database Models

### User Model
- **Fields**: username, email, password, role, profile, isActive, isApproved
- **Profile**: firstName, lastName, fullName, collegeId, department, year, designation, phone, avatar
- **Relationships**: registeredEvents, createdEvents

### Event Model
- **Fields**: title, description, category, eventMode, subCategory, eventType, eventFormat
- **Event Mode**: normal (Normal Day Event), versity (Versity Week Event)
- **Schedule**: date, startTime, endTime, venue
- **Team Settings**: teamSize, maxTeamsPerDepartment, maxParticipants
- **Media**: poster (Cloudinary URL)
- **Registrations**: Array of student registrations with status
- **Status**: isCompleted, attendanceMarked

### Notification Model
- **Types**: match_started, winner_declared, next_match, general
- **Fields**: event, type, message, teamA, teamB, winner, createdBy, isActive

### Result Model
- **Fields**: event, coordinator, firstPosition, secondPosition, thirdPosition
- **Position Details**: name, department, collegeId, points (optional)

### DepartmentPoints Model
- **Purpose**: Tracks department performance in Versity Week events
- **Fields**: department, totalPoints, eventBreakdown, lastUpdated
- **Point System**: 1st Place = 10 pts, 2nd Place = 7 pts, 3rd Place = 5 pts
- **Features**: Auto-updates when results are uploaded/edited/deleted

## 🔐 Authentication & Authorization

- **Session-based authentication** using express-session
- **Password hashing** with bcryptjs
- **Role-based access control** via middleware
- **Session storage** in MongoDB for persistence

## 🎨 UI/UX Features

- **Responsive Design**: Mobile-friendly layouts
- **Modern UI**: Clean, professional interface with Tailwind CSS
- **Real-time Updates**: Live match notifications for knockout events
- **Image Uploads**: Event poster management with Cloudinary
- **Flash Messages**: User feedback for actions
- **Form Validation**: Client and server-side validation

## 📝 Event Categories

- Seminars
- Workshops
- Hackathons
- Quizzes
- Talk Shows
- Bootcamps
- Cultural Events
- Sports

## 🏆 Event Formats

### Individual Events
- Single participant registration
- Direct approval by faculty

### Team Events
- **Knockout Format**: Match-based competition with live updates
  - Start match notifications
  - Winner declarations
  - Next match announcements
- **Ranking Format**: Multiple teams compete, final positions assigned
- Team size configuration
- Department-wise team limits

## 🎭 Event Modes

Events can be classified into two modes:

### Normal Day Event
- Regular college events
- Standard scheduling and execution

### Versity Week Event
- Special events during university week
- Highlighted with distinct visual indicators

## 🎯 Points System

### Result Points (Optional)
- Faculty can assign custom points to winners when uploading results
- Points are completely optional - leave blank if not needed
- If provided, points are displayed on the result page
- Points can be used for departmental or inter-college competitions

## 🏆 Versity Week Leaderboard

### Department Competition System
- **Automatic Point Calculation**: When results are uploaded for Versity Week events
- **Scoring**: 1st Place = 10 pts | 2nd Place = 7 pts | 3rd Place = 5 pts
- **Real-time Updates**: Points auto-adjust when results are edited or deleted
- **Tie Handling**: Same rank for departments with equal points

### Student Views
- **Full Leaderboard**: Complete department rankings with top 3 podium
- **Personal Highlight**: User's department is highlighted in the list
- **Department Details**: Event-wise breakdown of points earned
- **Statistics**: Total events, win counts, current rank

### Faculty Management
- Results can be edited/deleted with automatic point recalculation
- Visual indicators for Versity Week events during result management

## 🔧 API Routes

### Authentication (`/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `GET /logout` - User logout

### Admin (`/admin`)
- `GET /dashboard` - Admin dashboard
- `GET /students` - Student management
- `GET /faculty` - Faculty management
- `GET /events` - Event management
- `POST /faculty/:id/approve` - Approve faculty
- `POST /faculty/:id/reject` - Reject faculty
- `POST /students/:id/block` - Block student
- `POST /students/:id/unblock` - Unblock student

### Faculty (`/faculty`)
- `GET /dashboard` - Faculty dashboard
- `GET /events/create` - Create event form
- `POST /events/create` - Create event
- `GET /events/:id/edit` - Edit event form
- `POST /events/:id/edit` - Update event
- `GET /events/:id` - View event details
- `GET /events/:id/students` - View registered students
- `POST /events/:id/notifications/:type` - Create notification
- `GET /upload-result` - Upload result form
- `POST /upload-result` - Upload results
- `GET /results/:id/edit` - Edit result form
- `POST /results/:id/edit` - Update result
- `POST /results/:id/delete` - Delete result

### Student (`/student`)
- `GET /dashboard` - Student dashboard
- `GET /events/:id` - View event details
- `POST /events/:id/register` - Register for event
- `GET /registrations` - My registrations
- `POST /registrations/:id/cancel` - Cancel registration
- `GET /notifications` - Get notifications
- `GET /events/:eventId/notifications` - Event-specific notifications
- `GET /leaderboard` - Versity Week department leaderboard
- `GET /leaderboard/department/:name` - Department performance details

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file

2. **Session Issues**
   - Clear browser cookies
   - Check SESSION_SECRET in .env

3. **Image Upload Failure**
   - Verify Cloudinary credentials
   - Check internet connection

4. **College ID Validation Errors**
   - Students: Use format `YYCourseRollNo` (e.g., `23BA123`)
   - Faculty: Use format `FAC001` or `DEPT123`

## 📄 License

MIT License

## 👨‍💻 Authors

College Management Team

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support, please contact the development team or create an issue in the repository.
