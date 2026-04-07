# HomeBakes — Setup & Deployment Guide

## Project Structure
```
home-bakes/                        ← your GitHub repo root
├── .gitignore
├── render.yaml                    ← tells Render how to deploy
├── README.md
├── backend/
│   ├── app.py                     ← Flask entry point
│   ├── requirements.txt
│   ├── firebase_admin_key.json    ← LOCAL ONLY — never pushed to GitHub
│   └── routes/
│       ├── auth.py
│       ├── recipes.py
│       ├── meal_plans.py
│       ├── shopping_lists.py
│       └── ingredients.py
└── frontend/
    ├── index.html                 ← Home (fridge dashboard)
    ├── login.html
    ├── register.html
    ├── recipes.html               ← Week 3
    ├── recipe-view.html           ← Week 2
    ├── recipe-form.html           ← Week 2
    ├── meal-plans.html            ← Week 4
    ├── shopping-lists.html        ← Week 7
    └── static/
        ├── css/style.css
        ├── js/
        │   ├── firebase-init.js   ← PUT YOUR FIREBASE CONFIG HERE
        │   ├── auth.js
        │   └── api.js
        └── images/                ← add your images here
            ├── logo.png
            ├── kitchen-hero.jpg
            ├── fridge.png
            ├── recipe-box-icon.png
            ├── meal-plan-icon.png
            └── shopping-list-icon.png
```

---

## PART 1 — Firebase Setup

### Step 1 — Create a Firebase Project
1. Go to https://console.firebase.google.com
2. Click **Add project** → name it **HomeBakes** → Create project
3. Disable Google Analytics (not needed)

### Step 2 — Enable Authentication
1. Firebase Console → **Authentication** → Get started
2. Click **Email/Password** → Enable → Save

### Step 3 — Create Firestore Database
1. Firebase Console → **Firestore Database** → Create database
2. Choose **Start in test mode** → pick your nearest region → Enable

### Step 4 — Paste Firestore Security Rules
In Firestore → **Rules** tab, replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /ingredients/{id} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    match /recipes/{recipeId} {
      allow read: if resource.data.isPublic == true
                  || request.auth.uid == resource.data.uid;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.uid;
      match /recipe_ingredients/{id} {
        allow read, write: if request.auth.uid ==
          get(/databases/$(database)/documents/recipes/$(recipeId)).data.uid;
      }
    }

    match /meal_plans/{planId} {
      allow read, write: if request.auth.uid == resource.data.uid;
      allow create: if request.auth != null;
      match /days/{dayId} {
        allow read, write: if request.auth.uid ==
          get(/databases/$(database)/documents/meal_plans/$(planId)).data.uid;
      }
    }

    match /shopping_lists/{listId} {
      allow read, write: if request.auth.uid == resource.data.uid;
      allow create: if request.auth != null;
      match /items/{itemId} {
        allow read, write: if request.auth.uid ==
          get(/databases/$(database)/documents/shopping_lists/$(listId)).data.uid;
      }
    }
  }
}
```

### Step 5 — Get Your Firebase Web Config (for frontend)
1. Firebase Console → Project Settings (gear icon) → **Your apps**
2. Click **Add app** → Web (</>)  → Register app
3. Copy the `firebaseConfig` object
4. Open `frontend/static/js/firebase-init.js`
5. Replace the placeholder values with your real config

### Step 6 — Get Your Service Account Key (for backend)
1. Firebase Console → Project Settings → **Service accounts**
2. Click **Generate new private key** → Download the JSON file
3. Rename it to `firebase_admin_key.json`
4. Place it in `backend/`
5. ⚠️ This file is in `.gitignore` — it will NEVER be pushed to GitHub

---

## PART 2 — GitHub Setup

You already have the repo at: https://github.com/aimeewirick/home-bakes

### Clone and add the project files
```bash
# Clone your repo locally
git clone https://github.com/aimeewirick/home-bakes.git
cd home-bakes

# Copy all the project files from the zip into this folder,
# then push them up to GitHub:
git add .
git commit -m "Week 1: project setup, auth, base structure"
git push origin main
```

### Your weekly git workflow (every time you work on it)
```bash
# 1. Before you start — pull any changes
git pull origin main

# 2. Write your code...

# 3. When done — save your work to GitHub
git add .
git commit -m "describe what you did"
git push origin main

# → Render will automatically detect the push and redeploy within ~2 minutes
```

---

## PART 3 — Render Deployment (auto-deploy from GitHub)

### Step 1 — Create a Render Account
Go to https://render.com → Sign up (free) → Connect your GitHub account

### Step 2 — Create a New Web Service
1. Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repo: `aimeewirick/home-bakes`
3. Render will detect the `render.yaml` file automatically and fill in the settings
4. If it asks manually, use these settings:
   - **Root directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app`
   - **Python version:** 3.11

### Step 3 — Add Your Secret Environment Variables
In the Render service dashboard → **Environment** tab, add these two variables:

**Variable 1:**
- Key: `FIREBASE_CREDENTIALS`
- Value: Open your `firebase_admin_key.json` file, select ALL the text,
  and paste the entire JSON as the value. It will look like:
  `{"type": "service_account", "project_id": "...", ...}`

**Variable 2 (add after your frontend is deployed):**
- Key: `RENDER_FRONTEND_URL`
- Value: the URL of your deployed frontend (e.g. `https://home-bakes.onrender.com`)

### Step 4 — Deploy
Click **Deploy** — Render will install dependencies and start your Flask app.
Your API will be live at something like: `https://home-bakes-api.onrender.com`

Test it by visiting: `https://home-bakes-api.onrender.com/api/health`
You should see: `{"status": "HomeBakes API is running"}`

### Step 5 — Update api.js with your Render URL
Open `frontend/static/js/api.js` and update this line:
```javascript
const RENDER_API_URL = "https://home-bakes-api.onrender.com";  // ← your actual URL
```
Then push to GitHub — Render will redeploy automatically.

### Step 6 — Host your Frontend on Render (optional but recommended)
1. Render Dashboard → **New** → **Static Site**
2. Connect the same GitHub repo
3. Set **Root directory:** `frontend`
4. Set **Publish directory:** `.` (just a dot)
5. Deploy — your frontend will be live at a `.onrender.com` URL

---

## PART 4 — Running Locally (for development)

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
# Flask runs at http://localhost:5000
# Test: http://localhost:5000/api/health
```

### Frontend
Use VS Code's **Live Server** extension:
1. Install "Live Server" from the VS Code extensions panel
2. Open `frontend/index.html`
3. Right-click → **Open with Live Server**
4. Runs at: http://127.0.0.1:5500

The `api.js` file automatically uses `localhost:5000` when running locally
and your Render URL when running on the live site.

---

## PART 5 — Add Your Images

Place these in `frontend/static/images/`:

| Filename | What it is |
|---|---|
| `logo.png` | The circular HomeBakes logo from your wireframe |
| `kitchen-hero.jpg` | The retro kitchen photo for the login page |
| `fridge.png` | The teal retro fridge for the home page |
| `recipe-box-icon.png` | The teal recipe tin (fridge magnet) |
| `meal-plan-icon.png` | The weekly meal plan image (fridge magnet) |
| `shopping-list-icon.png` | The notepad shopping list (fridge magnet) |

Export these from your Miro board or source from your own files.
The pages will still work without them (images fail silently).

---

## Week 1 Completion Checklist

### Firebase
- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Firestore database created
- [ ] Security rules applied
- [ ] `firebase-init.js` updated with your web app config
- [ ] `firebase_admin_key.json` downloaded and placed in `backend/`

### GitHub
- [ ] Repo cloned locally
- [ ] Project files added and pushed to `main`
- [ ] `.gitignore` confirmed — `firebase_admin_key.json` is NOT in GitHub

### Local development
- [ ] `pip install -r requirements.txt` completed
- [ ] Flask running at `localhost:5000`
- [ ] `/api/health` returns OK
- [ ] Login page loads in browser
- [ ] Register page loads in browser
- [ ] Can create a new account
- [ ] Can log in and reach the home/fridge page
- [ ] Logout works and returns to login page

### Render (can do this after confirming local works)
- [ ] Render account created and GitHub connected
- [ ] Web service created from `home-bakes` repo
- [ ] `FIREBASE_CREDENTIALS` environment variable set
- [ ] Backend deployed and `/api/health` works at Render URL
- [ ] `RENDER_API_URL` updated in `api.js` and pushed
- [ ] Auto-deploy confirmed — push to GitHub → Render updates automatically
