# Frontend (Vue + Vite) for FastAPI Backend

## 📖 Project Description

This frontend is a Vue 3 application built with Vite. It connects to the FastAPI backend that provides a streaming Q&A service powered by Ollama. The frontend handles user input, displays streamed responses, and attaches images/files referenced by the backend.

---

## ⚙️ Environment Variables

- **VITE_API_BASE**: Base URL of the backend API.  
  Example:
  ```env
  VITE_API_BASE=http://localhost:8000
  ```

---

## 🛠️ Setup Instructions

1. **Prerequisites**

   - Node.js 18+
   - npm or yarn

2. **Install dependencies**

   ```bash
   npm install
   ```

   or

   ```bash
   yarn install
   ```

3. **Environment file**
   Create a `.env` file at the project root:
   ```env
   VITE_API_BASE=http://localhost:8000
   ```

---

## 🚀 Starting the Project

1. **Run the development server**

   ```bash
   npm run dev
   ```

   or

   ```bash
   yarn dev
   ```

   The app will be available at `http://localhost:5173` by default.

2. **Build for production**

   ```bash
   npm run build
   ```

   or

   ```bash
   yarn build
   ```

3. **Preview production build**
   ```bash
   npm run preview
   ```

---

## 💡 Example Usage

- Enter a question in the frontend UI.
- The frontend sends a request to `POST /ask_stream` on the backend (`VITE_API_BASE`).
- Responses stream back as JSON lines:
  - `{"type":"text","content":"..."}` chunks are displayed progressively.
  - `{"type":"image","url":"...","mime":"image/jpeg"}` or `{"type":"file","url":"...","mime":"application/pdf"}` are rendered as attachments.

---

## 🔍 Operational Notes

- Ensure the backend is running at the same time (`uvicorn app.main:app --reload`).
- The frontend relies on `VITE_API_BASE` to connect; update this if your backend runs on a different host/port.
- Hot‑reload is enabled in dev mode for rapid iteration.
- You can customize components to handle streamed JSON events more elegantly (e.g., progressive rendering, attachment previews).

---
