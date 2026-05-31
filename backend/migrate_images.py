"""기존 로컬 이미지 → Supabase Storage 마이그레이션"""
import os
import glob
from supabase import create_client
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
sb = create_client(url, key)

BUCKET = "question-images"
IMAGE_DIR = os.path.join(BASE_DIR, "images")

# 버킷 생성 (이미 있으면 무시)
try:
    sb.storage.create_bucket(BUCKET, options={"public": True})
    print(f"버킷 '{BUCKET}' 생성됨")
except Exception as e:
    print(f"버킷 이미 존재하거나 오류: {e}")

# 이미지 업로드 + DB 업데이트
for filepath in sorted(glob.glob(os.path.join(IMAGE_DIR, "q_*.jpg"))):
    filename = os.path.basename(filepath)
    question_id = filename.replace("q_", "").replace(".jpg", "")

    with open(filepath, "rb") as f:
        content = f.read()

    try:
        sb.storage.from_(BUCKET).upload(
            path=filename,
            file=content,
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )
        print(f"  업로드: {filename}")
    except Exception as e:
        print(f"  업로드 실패 {filename}: {e}")
        continue

    public_url = sb.storage.from_(BUCKET).get_public_url(filename)
    sb.table("exam_questions").update({"question_image": public_url}).eq("id", int(question_id)).execute()
    print(f"  DB 업데이트 question_id={question_id} → {public_url}")

print("\n완료!")
