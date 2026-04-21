# backend

FastAPI service. Populated by `3rd_prompt.md` (shell) and `4th_prompt.md` (AI integration).

Stack: Python 3.11+, FastAPI, Pydantic, Anthropic SDK (Messages API — no LangChain).

Run:
```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
