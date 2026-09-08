# Active Recall PDF Reader

An AI-powered PDF reader that helps students study using active recall. It asks questions while reading, generates quizzes, flashcards, and summaries to improve learning.

## Features

- Upload PDF files
- AI-generated summaries
- Active recall questions
- Flashcards
- Quiz generation
- Cloud-synced accounts with secure sessions
- MongoDB-backed PDF and study-data storage
- Password changes and account deletion
- Responsive mobile navigation and command palette
- Clean light and dark themes

## Tech Stack

- HTML
- CSS
- JavaScript
- Flask
- MongoDB
- Gemini API

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/your-username/your-repository.git
   ```

2. Open the project folder.

3. Create a Python virtual environment and install the backend dependencies:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

4. Create `.env` in the project root. Keep all secrets there; never put them in
   `config.js` or any browser-side file.

   ```bash
   cp .env.example .env
   ```

   Replace the placeholder with your Gemini API key:

   ```text
   GEMINI_API_KEY=your-gemini-api-key
   MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/ImpactX?retryWrites=true&w=majority
   MONGODB_DB_NAME=ImpactX
   SECRET_KEY=replace-with-a-long-random-secret
   SESSION_COOKIE_SECURE=false
   ```

   Start the app:

   ```bash
   python3 app.py
   ```

5. Open `http://localhost:5001`.

The app provides registration, login, logout, password changes, account
deletion, CSRF-protected sessions, user-scoped study data, and GridFS-backed PDF
storage. Passwords are stored only as Werkzeug password hashes.

For deployment, add all `.env` values yourself to the environment used by your
hosting provider. On Vercel, add `SECRET_KEY` as a persistent environment
variable and set `SESSION_COOKIE_SECURE=true`. Do not let the deployment
generate a new secret per instance. The browser never receives the Gemini or
MongoDB credentials.

## Project Structure

```
pdf-active-recall-app/
├── templates/
│   └── index.html
├── css/
├── js/
├── app.py
├── requirements.txt
├── config.js
├── .env.example
└── README.md
```

## Future Improvements

- Progress tracking
- Spaced repetition
- More AI study tools

## Author

Khushi Gautam
