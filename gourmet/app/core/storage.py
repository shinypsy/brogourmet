import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# UNC 경로(예: \\192.168.0.250\imgfile)도 허용
COMMUNITY_IMAGE_DIR = Path(os.getenv("COMMUNITY_IMAGE_DIR", str(Path(__file__).resolve().parents[2] / "uploads")))
