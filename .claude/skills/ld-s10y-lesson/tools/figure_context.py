#!/usr/bin/env python3
"""Compatibility entry point for ld-s10y-image context generation."""

from pathlib import Path
import runpy


TARGET = (
    Path(__file__).resolve().parents[4]
    / ".agents"
    / "skills"
    / "ld-s10y-image"
    / "scripts"
    / "build_context.py"
)
runpy.run_path(str(TARGET), run_name="__main__")
