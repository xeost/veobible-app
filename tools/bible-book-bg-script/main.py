#!/usr/bin/env python3
"""
Entrypoint alias for generate_prompts.py
"""
import sys
from pathlib import Path

# Ensure script directory is in path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from generate_prompts import main

if __name__ == "__main__":
    main()
