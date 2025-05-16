# Flashcard Generator

A web application that generates flashcards for any topic using AI and allows users to save their favorite sets.

## Features

- Generate flashcards for any topic using Anthropic's Claude AI
- Study flashcards with a clean, intuitive interface
- Save favorite flashcard sets to your account
- Responsive design for both desktop and mobile

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   REACT_APP_ANTHROPIC_API_KEY=your_anthropic_api_key_here
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key_here
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain_here
   REACT_APP_FIREBASE_DATABASE_URL=your_firebase_database_url_here
   REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id_here
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket_here
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id_here
   REACT_APP_FIREBASE_APP_ID=your_firebase_app_id_here
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Firebase Setup

1. Create a new Firebase project
2. Enable Authentication (Email/Password)
3. Create a Realtime Database
4. Get your Firebase configuration from the project settings
5. Add the configuration values to your `.env` file

## Usage

1. Enter a topic in the home page
2. Click "Generate Flashcards"
3. Study the generated flashcards
4. Save your favorite sets using the save button
5. Access your saved sets from your account

## Technologies Used

- React
- TypeScript
- Material-UI
- Firebase (Authentication, Realtime Database)
- Anthropic Claude AI 