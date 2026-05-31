import sys
import os
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('VERCEL', '1')

_import_error = None
try:
    from main import app
except Exception as _e:
    _import_error = traceback.format_exc()
    from fastapi import FastAPI
    app = FastAPI()

    @app.get("/{path:path}")
    def _error_handler(path: str):
        return {"error": _import_error}
