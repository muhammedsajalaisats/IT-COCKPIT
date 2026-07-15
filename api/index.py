import sys
import os

# Append the absolute path of the backend directory so internal imports inside main.py resolve correctly
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_path)

from main import app
