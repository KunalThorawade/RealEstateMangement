### Real Estate Management System

A full-stack, modular, and scalable Real Estate Management System designed to streamline property leasing, tenant management, payments, and maintenance tracking. Built using Node.js for the backend, a custom JavaScript/HTML/CSS frontend, and a structured MySQL database architecture in 3rd Normal Form.

## Features

- User Authentication & Role-Based Access Control
- Property Listings Management
- Lease Agreement Management
- Payment Tracking & Invoicing
- Maintenance Request Workflow
- Notification System


## Tech Stack

- **Backend:** Node.js, Express.js, JWT
- **Frontend:** HTML, CSS, JavaScript
- **Database:** MySQL with Procedures
- **Tools:** GitHub

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- MySQL Server
- npm

### 1. Clone the Repository

git clone https://github.com/AryanAg2701/RealEstateManagementSystem.git
cd RealEstateManagementSystem

### 2. Configure the Database

- Import the schema and procedures:

mysql -u root -p < database/schema.sql
mysql -u root -p < database/procedures/property_procedures.sql
mysql -u root -p < database/procedures/lease_procedures.sql
mysql -u root -p < database/procedures/payment_procedures.sql
mysql -u root -p < database/procedures/maintenance_procedures.sql

- Update your MySQL credentials in `backend/.env`:

### 3. Start the Backend Server

cd backend
npm install
node app.js

Server runs on: `http://localhost:5001`

### 4. Open the Frontend

Open `frontend/public/index.html` in your browser. All logic is managed through the `scripts/` folder.

## 📸 UI Previews

Screenshots are available in the `Images(for reference)/` folder to guide you through the UI/UX.

## 📂 Key Functional Modules

- `auth.js` — Login, JWT verification
- `property.js` — Add/update/remove/list properties
- `tenant.js` — Tenant profile handling
- `lease.js` — Lease contract creation and expiration tracking
- `payment.js` — Transaction history, dues
- `maintenance.js` — Issue reporting and resolution
- `notification.js` - Manages sending Notification of various triggers and events