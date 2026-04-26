import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function RecorderButton({ onAudio, disabled, onLiveTranscript, onRecordingChange }) {
  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
    };
  }, []);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    finalTranscriptRef.current = "";
    onLiveTranscript?.("");
    startLiveTranscription();

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
    onRecordingChange?.(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    recorderRef.current?.stop();
    setRecording(false);
    onRecordingChange?.(false);
  }

  function startLiveTranscription() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !onLiveTranscript) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
        } else {
          interimText += transcript;
        }
      }

      onLiveTranscript(`${finalTranscriptRef.current} ${interimText}`.trim());
    };

    recognition.onerror = () => {};
    recognition.start();
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

