import json
import urllib.request
import os

def test_upload():
    url = 'http://127.0.0.1:8001/upload'
    file_path = r'c:\Users\Admin\Downloads\ClickBait\uploads\f30a1a2f_test.wav'
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    
    with open(file_path, 'rb') as f:
        file_data = f.read()

    data = []
    data.append(f'--{boundary}'.encode())
    data.append(b'Content-Disposition: form-data; name="file"; filename="f30a1a2f_test.wav"')
    data.append(b'Content-Type: audio/wav')
    data.append(b'')
    data.append(file_data)
    data.append(f'--{boundary}--'.encode())
    data.append(b'')
    
    body = b'\r\n'.join(data)
    
    req = urllib.request.Request(url, data=body)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            print(f"Status: {resp.status}")
            print(f"Transcript: {resp.headers.get('X-Transcript')}")
            print(f"Reply: {resp.headers.get('X-Reply')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_upload()
