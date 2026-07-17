import { useEffect, useRef, useState } from 'react';
import api from '../api/api';

function pickVoice(voices, preferMale) {
  // Browser voice lists differ by OS, so choose by language/name hints instead
  // of relying on a fixed index.
  const english = voices.filter((voice) => voice.lang.startsWith('en'));
  if (!english.length) return voices[0] || null;
  const hints = preferMale
    ? ['male', 'david', 'daniel', 'alex', 'fred', 'tom', 'aaron', 'arthur']
    : ['female', 'samantha', 'karen', 'victoria', 'moira', 'fiona', 'tessa'];
  return english.find((voice) =>
    hints.some((hint) => voice.name.toLowerCase().includes(hint))
  ) || (preferMale ? english[0] : english[1] || english[0]);
}

function cleanText(text) {
  // Remove markdown and links so spoken output sounds natural.
  return text.replace(/[*`#]/g, '').replace(/\[.*?\]/g, '').replace(/https?:\/\/\S+/g, 'link');
}

function preferredAudioType() {
  // Prefer Opus/WebM because most Chromium browsers support it and the backend
  // validates this format.
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return types.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
}

export default function useInterviewSpeech(onTranscript) {
  // This hook owns all voice input/output state so the Interview component only
  // has to decide when to start recording or speak a response.
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const callbackRef = useRef(onTranscript);

  useEffect(() => {
    // Keep the latest transcript callback without recreating recorder handlers.
    callbackRef.current = onTranscript;
  }, [onTranscript]);

  const releaseMicrophone = () => {
    // Stopping tracks releases the browser microphone indicator and hardware.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => () => {
    // Cleanup covers route changes, refreshes, and component unmounts.
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseMicrophone();
    window.speechSynthesis?.cancel();
  }, []);

  const startListening = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      window.alert('Audio recording is not supported in this browser. Please use text.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Audio constraints improve interview transcription in noisy rooms.
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      const mimeType = preferredAudioType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        // MediaRecorder emits chunks while recording; store them until stop.
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setIsListening(false);
        releaseMicrophone();
        window.alert('The microphone recording failed. Please try again.');
      };
      recorder.onstop = async () => {
        // Stopping recording immediately releases the mic, then uploads the
        // complete audio blob for server-side transcription.
        setIsListening(false);
        releaseMicrophone();
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        if (!audio.size) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          // Preserve a matching extension because providers may inspect both
          // MIME type and filename.
          const extension = audio.type.includes('ogg')
            ? 'ogg'
            : audio.type.includes('mp4')
              ? 'm4a'
              : 'webm';
          formData.append('audio', audio, `answer.${extension}`);
          const response = await api.post('/transcribe', formData);
          if (response.data.transcript) callbackRef.current(response.data.transcript);
        } catch (error) {
          const message =
            error.response?.data?.error || 'Speech transcription failed. Please try again.';
          window.alert(message);
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start(250);
      setIsListening(true);
    } catch (error) {
      releaseMicrophone();
      if (error.name !== 'NotAllowedError') {
        window.alert('Could not access the microphone. Please try again.');
      }
    }
  };

  const toggleListening = () => {
    // A single button toggles between starting capture and stopping for
    // transcription.
    if (isListening) recorderRef.current?.stop();
    else if (!isTranscribing) startListening();
  };

  const stopSpeaking = () => {
    // Cancel any queued utterances so the candidate can regain control quickly.
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const speak = (text, preferMale = true) => {
    if (!window.speechSynthesis) return;
    // Speech synthesis stays local to the browser; only transcription audio is
    // sent to the backend.
    const utterance = new SpeechSynthesisUtterance(cleanText(text));
    utterance.voice = pickVoice(window.speechSynthesis.getVoices(), preferMale);
    utterance.pitch = preferMale ? 0.85 : 1.1;
    utterance.rate = preferMale ? 1.05 : 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return {
    isListening,
    isTranscribing,
    isSpeaking,
    toggleListening,
    speak,
    stopSpeaking,
  };
}
