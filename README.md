# SalvageOrganizer

A web application to track and organize Copart auction lots with a clean, dark-themed interface.

## Features

- Add Copart lots by URL or lot number
- View detailed lot information including images, vehicle details, and auction status
- Organize lots into categories: Upcoming Auctions, Future Lots, and Recently Played
- Automatically removes lots 5 days after their auction date
- Responsive design that works on desktop and mobile devices
- Dark theme for comfortable viewing

## Prerequisites

- Node.js (v14 or later)
- npm (comes with Node.js)

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend server:
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3001` by default.

### Frontend Setup

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Open `index.html` in your web browser. You can use a simple HTTP server like:
   ```bash
   # Python 3
   python -m http.server 3000
   ```
   Then visit `http://localhost:3000` in your browser.

## Usage

1. **Adding a Lot**:
   - Enter a Copart lot URL (e.g., `https://www.copart.com/lot/60252425/salvage-2022-tesla-model-3-nc-china-grove`) or just the lot number in the input field.
   - Click "Add Lot" or press Enter.

2. **Viewing Lots**:
   - **Upcoming Auctions**: Lots with auctions happening soon (within 7 days)
   - **Future Lots**: Lots with auctions scheduled more than 7 days in the future
   - **Recently Played**: Lots that have already been sold or whose auction date has passed

3. **Viewing Details**:
   - Click the "View" button on any lot card to see detailed information
   - Use the "View on Copart" button to open the original listing

4. **Removing Lots**:
   - Click the trash can icon on any lot card to remove it from your organizer

## Technical Details

- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Backend**: Node.js with Express
- **Data Storage**: Local Storage for persistence
- **Styling**: Custom CSS with Flexbox and Grid

## Notes

- The application uses a backend proxy to fetch data from Copart due to CORS restrictions.
- Some features might be limited by Copart's anti-scraping measures.
- For development, you can use the `npm run dev` command in the backend directory to enable hot-reloading.

## License

This project is open source and available under the [MIT License](LICENSE).
