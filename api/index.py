import sys
import os

# Ensure the root of the project is added to sys.path so backend.main can be resolved
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, root_path)

# Ensure the backend folder is added to sys.path so internal imports inside backend.main resolve correctly
backend_path = os.path.join(root_path, "backend")
sys.path.insert(0, backend_path)

from backend.main import app
