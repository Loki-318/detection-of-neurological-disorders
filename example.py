import base64
import mimetypes
import json
from pathlib import Path

# Change this to your image path
image_path = Path(r"C:\Users\reddy\OneDrive\Pictures\3_S_mouth1.bmp")

# Output files
base64_output_file = "face_input.txt"
json_output_file = "face_request.json"


def get_mime_type(path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(str(path))
    if mime_type:
        return mime_type

    ext = path.suffix.lower()
    if ext == ".bmp":
        return "image/bmp"
    elif ext in [".jpg", ".jpeg"]:
        return "image/jpeg"
    elif ext == ".png":
        return "image/png"
    elif ext == ".gif":
        return "image/gif"
    elif ext == ".webp":
        return "image/webp"
    else:
        return "application/octet-stream"


def image_to_data_url(path: Path) -> str:
    mime_type = get_mime_type(path)

    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")

    return f"data:{mime_type};base64,{encoded}"


def main():
    if not image_path.exists():
        print(f"Image not found: {image_path}")
        return

    data_url = image_to_data_url(image_path)

    with open(base64_output_file, "w", encoding="utf-8") as f:
        f.write(data_url)

    request_body = {
        "image": data_url
    }

    with open(json_output_file, "w", encoding="utf-8") as f:
        json.dump(request_body, f, indent=2)

    preview_len = 150
    preview = data_url[:preview_len] + "...(truncated)"

    print(f"Full Base64 data URL saved to: {base64_output_file}")
    print(f"JSON request body saved to: {json_output_file}")
    print(f"Total string length: {len(data_url)}")

    print("\nPreview of image string:")
    print(preview)

    print("\nSample JSON preview:")
    print(json.dumps({
        "image": data_url[:120] + "...(truncated)"
    }, indent=2))


if __name__ == "__main__":
    main()