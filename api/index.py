import sys
import os
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('VERCEL', '1')

try:
    from main import app
except Exception as _e:
    traceback.print_exc()
    raise
