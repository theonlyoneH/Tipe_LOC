# Tipe-Bakcend

This is the backend for the **Loc8a1** platform, built with **FastAPI**. It handles user authentication, trade lead discovery via vector search, and AI-powered interactions.

## Features
- **FastAPI**: High-performance asynchronous API framework.
- **RAG (Retrieval-Augmented Generation)**: Uses **Pinecone** for vector search and **Google Gemini** for reasoning.
- **Multi-DB Setup**: 
  - **MongoDB**: For user profiles, authentication, and approved leads.
  - **Pinecone**: For semantic search across exporters, importers, and global news.
- **Round Robin AI Keys**: Handles Gemini API rate limits by rotating through multiple keys.
- **JWT Authentication**: Secure user session management.

## Project Structure
```text
backend/
├── main.py              # Main application entry point
├── requirements.txt     # Python dependencies
├── Dockerfile          # Container configuration for deployment
└── .env                # Environment variables (API keys, DB URIs)
```

## Setup & Local Development

### 1. Prerequisites
- Python 3.9+
- MongoDB instance
- Pinecone account & API key
- Google Gemini API key(s)

### 2. Environment Variables
Create a `.env` file in the `backend/` directory:
```env
GEMINI_API_KEYS=key1,key2,key3
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=your_pinecone_index
MONGO_DETAILS=mongodb+srv://...
JWT_SECRET=your_jwt_secret
```

### 3. Installation
```bash
pip install -r requirements.txt
```

### 4. Running the Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Docker Deployment
To run using Docker:
```bash
docker build -t tipe-backend .
docker run -p 7860:7860 tipe-backend
```

## API Endpoints
- `POST /register`: Create a new account.
- `POST /login`: Authenticate and receive a JWT.
- `POST /chat`: AI-powered query with trade-specific vector search context.
- `GET /approved-leads`: Retrieve leads vetted by the user.
