Backend (Terminal 1):

cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload


Frontend (Terminal 2):

cd client
npm install
npm run dev

Open http://localhost:5173