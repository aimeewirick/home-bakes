# HomeBakes — Setup & Deployment Guide

## Project Structure
```
home-bakes/                        ← your GitHub repo root
├── .gitignore
├── render.yaml                    ← tells Render how to deploy
├── README.md
├── app.py                         ← Flask entry point (serves EVERYTHING)
├── requirements.txt
├── firebase_admin_key.json        ← LOCAL ONLY — never pushed to GitHub
├── routes/
│   ├── auth.py
│   ├── recipes.py
│   ├── meal_plans.py
│   ├── shopping_lists.py
│   └── ingredients.py
├── templates/                     ← ALL your HTML pages go here
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── recipes.html               ← Week 3
│   ├── recipe-form.html           ← Week 2
│   ├── recipe-view.html           ← Week 2
│   ├── meal-plans.html            ← Week 4
│   └── shopping-lists.html        ← Week 7
└── static/                        ← ALL your CSS/JS/images go here
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── firebase-init.js       ← your Firebase config lives here
    │   ├── auth.js
    │   └── api.js
    └── images/
        ├── logo.png
        ├── kitchen-hero.jpg
        ├── fridge.png
        ├── recipe-box-icon.png
        ├── meal-plan-icon.png
        └── shopping-list-icon.png
```

### Why this structure?
Flask serves EVERYTHING from one place — your HTML pages from `templates/`
and your CSS/JS/images from `static/`. There is no separate frontend service.
One GitHub repo → one Render service → one URL. Simple.

---

## PART 1 — Firebase Setup

### Step 1 — Create a Firebase Project
1. Go to https://console.firebase.google.com
2. Click **Add project** → name it **HomeBakes** → Create project

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
1. Firebase Console → Project Settings → **Your apps** → Web app
2. Copy the `firebaseConfig` object — your values are already filled into
   `static/js/firebase-init.js` so you don't need to do anything here

### Step 6 — Get Your Service Account Key (for backend)
1. Firebase Console → Project Settings → **Service accounts**
2. Click **Generate new private key** → Download the JSON file
3. Rename it to `firebase_admin_key.json`
4. Place it in the ROOT of your project (same folder as `app.py`)
5. ⚠️ It's in `.gitignore` — it will NEVER be pushed to GitHub

---

## PART 2 — Running Locally

```bash
# From the root of your project (home-bakes/)
pip install -r requirements.txt
python app.py
```

Then open your browser to: **http://localhost:5000**

That's it — Flask serves both the pages AND the API from one place.
No Live Server, no separate frontend server needed.

---

## PART 3 — GitHub Workflow

Your repo: https://github.com/aimeewirick/home-bakes

### Every time you work on the project:
```powershell
# Navigate to your repo
cd "C:\Projects Class Sprin 2026\homebakes\home-bakes"

# Pull latest changes first
git pull origin main

# ... write your code ...

# Save and push when done
git add .
git commit -m "describe what you changed"
git push origin main

# → Render automatically detects the push and redeploys within ~2 minutes
```

---

## PART 4 — Render Setup (One Service Only)

You only need ONE Render service. If you created a second one (static site)
during setup, delete it — you don't need it.

### Render Service Settings:
| Setting | Value |
|---|---|
| Name | `home-bakes` |
| Language | Python 3 |
| Branch | `main` |
| Root Directory | *(leave blank)* |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn app:app` |
| Instance Type | Free |

### Add your Firebase secret:
Render Dashboard → your service → **Environment** tab → Add:

| Key | Value |
|---|---|
| `FIREBASE_CREDENTIALS` | Paste the ENTIRE contents of `firebase_admin_key.json` |

Your live URL: **https://home-bakes-404h.onrender.com**

Test it: https://home-bakes-404h.onrender.com/api/health
Should return: `{"status": "HomeBakes API is running"}`

---

## PART 5 — Add Your Images

Place these in `static/images/`:

| Filename | What it is |
|---|---|
| `logo.png` | The circular HomeBakes logo |
| `kitchen-hero.jpg` | Retro kitchen photo for login page |
| `fridge.png` | Teal retro fridge for home dashboard |
| `recipe-box-icon.png` | Recipe tin (fridge magnet) |
| `meal-plan-icon.png` | Meal plan (fridge magnet) |
| `shopping-list-icon.png` | Shopping list notepad (fridge magnet) |

---

## PART 6 — Adding New Pages (every week)

When you build a new page, do TWO things:

**1. Create the HTML file in `templates/`**
e.g. `templates/recipes.html`

**2. Add a route for it in `app.py`**
```python
@app.route("/recipes.html")
def recipes():
    return send_from_directory("templates", "recipes.html")
```

That's all — Flask will serve it automatically.

---

## Week 1 Completion Checklist

### Firebase
- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Firestore database created in test mode
- [ ] Security rules applied
- [ ] `firebase_admin_key.json` downloaded and placed in project root

### Local Development
- [ ] `pip install -r requirements.txt` completed
- [ ] `python app.py` runs without errors
- [ ] http://localhost:5000 loads the login page
- [ ] Can create a new account (register)
- [ ] Can log in and reach the home/fridge page
- [ ] Logout works and returns to login

### GitHub
- [ ] All files pushed to `main`
- [ ] `firebase_admin_key.json` confirmed NOT in GitHub

### Render
- [ ] Single web service created (NOT a static site)
- [ ] Root Directory left blank
- [ ] Build/Start commands set correctly
- [ ] `FIREBASE_CREDENTIALS` environment variable added
- [ ] https://home-bakes-404h.onrender.com/api/health returns OK
- [ ] Push to GitHub triggers auto-deploy in Render
