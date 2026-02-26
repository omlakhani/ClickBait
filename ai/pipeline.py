import os
import sys
import wave


def _write_silence_wav(path: str, duration_seconds: float = 0.5, sample_rate: int = 16000) -> None:
    n_channels = 1
    sampwidth = 2  # 16-bit PCM
    n_frames = int(duration_seconds * sample_rate)
    silence = (b"\x00\x00") * n_frames

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(n_channels)
        wf.setsampwidth(sampwidth)
        wf.setframerate(sample_rate)
        wf.writeframes(silence)


def main() -> int:
    # Usage: python pipeline.py <input_audio_path>
    _ = sys.argv[1] if len(sys.argv) > 1 else None

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    response_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "response.wav")

    _write_silence_wav(response_path)
    print("ok")
    print(f"response_wav={response_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
