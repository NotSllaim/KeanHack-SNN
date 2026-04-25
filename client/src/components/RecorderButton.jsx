import { Mic, Square } from "lucide-react";
import { useRef, useState } from "react";

export function RecorderButton({ onAudio, disabled }) {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      onAudio(blob);
    };

    recorder.start();
    setRecording(true);
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={disabled}
      className={`inline-flex h-11 items-center gap-2 rounded-md px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
        recording ? "bg-coral" : "bg-meadow"
      }`}
    >
      {recording ? <Square size={17} /> : <Mic size={17} />}
      {recording ? "Stop" : "Speak"}
    </button>
  );
}

