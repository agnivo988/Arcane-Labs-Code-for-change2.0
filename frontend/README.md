# Arcane Engine

Arcane Engine is a dual-mode React + TypeScript application for AI-powered visual creation and live camera scene transformation using Google Gemini.

## Features

### Arcane Studio
- Text-to-image generation
- Prompt-driven image editing
- Two-image fusion workflow
- Downloadable outputs
- Drag-and-drop uploads

### Arcane Engine Live
- Real-time camera stream processing
- Prompt-based scene transformations
- Optimized frame processing for Gemini
- Layered transformation preview

### Platform
- Runtime API key input
- Request queue with throttling
- Error handling via toast notifications

## Stack 
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Google GenAI SDK (`@google/genai`)

## Setup

This guide is for anyone who just cloned the repository and wants to run Arcane Engine on a new machine.
### 1) Prerequisites
- Node.js 18+ (Node.js 20 LTS recommended)
- npm (comes with Node.js)
- A modern browser (Chrome, Edge, or Firefox)
Check your versions:
```bash
node -v
npm -v
```
### 2) Clone and Install
```bash
git clone <your-repo-url>
cd arcaneengine_1.0.2
npm install
```
### 3) Start the App
```bash
npm run dev
```
Vite will print a local URL (usually `http://localhost:5173`). Open it in your browser.
### 4) Add Your Gemini API Key In-App
Arcane Engine uses a runtime key input, so you do not need to create a `.env` file just to start.
1. Open the app in your browser.
2. Paste your Gemini API key into the API key field.
3. Start using Studio or Live mode.
Get a key from Google AI Studio:
https://makersuite.google.com/app/apikey
### 5) Optional Environment Variable
If your account requires a specific Gemini image model, create a `.env` file in the project root:
```bash
VITE_GEMINI_IMAGE_MODEL=your_model_name
```
Then restart the dev server:
```bash
npm run dev
```
### 6) Build for Production
```bash
npm run build
npm run preview
```
### 7) Helpful Commands
```bash
npm run lint
```
### Troubleshooting
- `npm install` fails:
  - delete `node_modules` and `package-lock.json`, then run `npm install` again.
- Port already in use:
  - run `npm run dev -- --port 5174` and open that port in browser.
- App says API key is required:
  - make sure you pasted your key in the app input field.
- Model compatibility error:
  - set `VITE_GEMINI_IMAGE_MODEL` in `.env` and restart the dev server.


