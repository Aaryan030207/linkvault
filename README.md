# LinkVault ⚡

A high-performance, full-stack **MERN** (MongoDB, Express, React, Node.js) URL Shortener and real-time Analytics Dashboard.

Transform long URLs into unique **6-character** short links, track redirection clicks in real-time, configure custom expiration dates, generate QR codes, and manage all your links from an analytics dashboard.

---

## ✨ Features

- **Unique 6-Character Codes**: Automatically generates unique 6-character cryptographic alphanumeric codes (or accepts custom 6-character codes).
- **Fast Redirection**: Ultra-fast redirection (`GET /:code`) directly to the original destination URL.
- **Click Tracking**: Tracks total redirection clicks and records the `lastClickedAt` timestamp per link.
- **Optional Link Expiration**: Set link expiration in days (e.g. 1 day, 7 days, 30 days, or custom days). Expired links automatically deactivate and render an expiration notice page.
- **Interactive Dashboard**:
  - Live metrics overview (Total links, Total clicks, Active links, Expired links).
  - Search links by original URL, short URL, or 6-character code.
  - Filter links by status (**All**, **Active**, **Expired**).
  - 1-Click copy to clipboard with instant feedback.
  - Interactive **QR Code** generator for every link.
  - Safe deletion of shortened links.
  - Live backend and MongoDB connection status pill.

---

## 📁 Project Structure

```text
linkvault/
├── server/
│   ├── models/
│   │   └── Url.js         # Mongoose schema (urlCode, originalUrl, clicks, expiresAt, etc.)
│   ├── routes/
│   │   └── url.js         # Express router for shorten, links, stats, and delete
│   ├── .env               # Environment variables (PORT, MONGODB_URI, BASE_URL)
│   ├── index.js           # Server entry point and redirection engine (GET /:code)
│   └── package.json       # Backend dependencies
│
├── client/
│   ├── src/
│   │   ├── api.js         # API integration layer
│   │   ├── App.jsx        # Main UI, shortener form, analytics cards & dashboard
│   │   ├── index.css      # Dark theme styling, glassmorphism & responsive layout
│   │   └── main.jsx       # React DOM entry point
│   ├── index.html         # HTML template
│   ├── vite.config.js     # Vite configuration and proxy setup
│   └── package.json       # Frontend dependencies
│
├── package.json           # Root workspace scripts
└── README.md              # Project documentation & run guide
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)

---

### Step 1: Install Dependencies

Open a terminal in the root `linkvault` directory:

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

*(Alternatively, from the project root you can run: `npm run install:all`)*

---

### Step 2: Configure Environment Variables

The backend environment file is located at `server/.env`:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
BASE_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173
```

---

### Step 3: Run the Application

You will need **two terminal windows**: one for the backend and one for the frontend.

#### Terminal 1 — Start the Backend Server:
```bash
cd server
npm start
```
> Server runs at **http://localhost:5000**  
> Output will confirm: `✅ Connected to MongoDB Atlas successfully.`

#### Terminal 2 — Start the React Client:
```bash
cd client
npm run dev
```
> React client runs at **http://localhost:5173**

Now open your browser and navigate to **[http://localhost:5173](http://localhost:5173)**.

---

## 🔌 API Reference

### 1. Shorten URL
- **Endpoint**: `POST /api/url/shorten`
- **Body**:
  ```json
  {
    "originalUrl": "https://example.com/very/long/article/or/resource",
    "expiryDays": 7,
    "customCode": "myCode"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "URL shortened successfully",
    "data": {
      "urlCode": "PMZMGJ",
      "originalUrl": "https://example.com/very/long/article/or/resource",
      "shortUrl": "http://localhost:5000/PMZMGJ",
      "clicks": 0,
      "expiryDays": 7,
      "expiresAt": "2026-10-30T07:24:48.123Z",
      "createdAt": "2026-10-23T07:24:48.132Z"
    }
  }
  ```

### 2. Redirect to Original URL
- **Endpoint**: `GET /:code`
- **Behavior**:
  - If code is valid & not expired: increments `clicks` count by 1 and redirects (HTTP 302) to `originalUrl`.
  - If expired: returns HTTP 410 with an expiration notice page.
  - If code does not exist: returns HTTP 404.

### 3. Get All Links (Dashboard)
- **Endpoint**: `GET /api/url/links`
- **Response** (`200 OK`): List of all saved links with clicks, creation timestamp, and expiration status.

### 4. Get Summary Statistics
- **Endpoint**: `GET /api/url/stats`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "totalLinks": 12,
      "totalClicks": 84,
      "activeLinks": 10,
      "expiredLinks": 2
    }
  }
  ```

### 5. Delete Short Link
- **Endpoint**: `DELETE /api/url/:code`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "URL deleted successfully",
    "code": "PMZMGJ"
  }
  ```

### 6. Health Check
- **Endpoint**: `GET /api/health`
- **Response** (`200 OK`):
  ```json
  {
    "status": "healthy",
    "database": "connected"
  }
  ```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 6, Lucide React (Icons), QRCode.react, Modern CSS (Glassmorphism, CSS Grid, Custom Properties).
- **Backend**: Node.js, Express 4, Mongoose 8, Dotenv, CORS.
- **Database**: MongoDB Atlas Cluster.
