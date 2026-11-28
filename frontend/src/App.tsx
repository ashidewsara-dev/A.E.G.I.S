
import { useEffect, useRef, useState } from "react";
import "./App.css";

type Mode = "local" | "online" | "hybrid";
type AssistantState = "STANDBY" | "LISTENING" | "THINKING" | "SPEAKING" | "ERROR";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
};

type SpeechRecognitionResults = ArrayLike<SpeechRecognitionResult>;

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResults;
  resultIndex: number;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

const API_URL = "http://127.0.0.1:8000/api/chat/";

function App() {
  const [mode, setMode] = useState<Mode>("local");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "A.E.G.I.S. systems online. Local intelligence core connected. Awaiting your instructions, Commander.",
    },
  ]);

  const [assistantState, setAssistantState] =
    useState<AssistantState>("STANDBY");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [provider, setProvider] = useState("ollama");
  const [clock, setClock] = useState(new Date());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const handsFreeRef = useRef(false);
  const loadingRef = useRef(false);

  // Live clock
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Automatically scroll to the latest conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  // Release microphone and speech resources when leaving the page
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      audioStreamRef.current?.getTracks().forEach((track) => track.stop());

      if (audioContextRef.current &&
          audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
    };
  }, []);

  const stopAudioMeter = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;

    if (
      audioContextRef.current &&
      audioContextRef.current.state !== "closed"
    ) {
      void audioContextRef.current.close();
    }

    audioContextRef.current = null;
    setVoiceLevel(0);
  };

  // Read actual microphone volume for the live voice visualizer
  const startAudioMeter = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      audioStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const microphone =
        audioContext.createMediaStreamSource(stream);

      microphone.connect(analyser);

      await audioContext.resume();

      const data = new Uint8Array(analyser.fftSize);

      const updateMeter = () => {
        analyser.getByteTimeDomainData(data);

        let sum = 0;

        for (let i = 0; i < data.length; i++) {
          const sample = (data[i] - 128) / 128;
          sum += sample * sample;
        }

        const rms = Math.sqrt(sum / data.length);
        const level = Math.min(100, Math.round(rms * 180));

        setVoiceLevel(level);

        animationFrameRef.current =
          window.requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (error) {
      console.warn("Live audio meter unavailable:", error);
      // Speech recognition can still work without the visual meter.
    }
  };

  // Text-to-speech response
  const speakResponse = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setAssistantState("STANDBY");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    const preferredVoice = voices.find((voice) =>
      /david|mark|guy|daniel|james|alex|tom/i.test(voice.name)
    );

    const englishVoice = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith("en")
    );

    if (preferredVoice ?? englishVoice) {
      utterance.voice = preferredVoice ?? englishVoice!;
    }

    utterance.onstart = () => {
      setAssistantState("SPEAKING");
    };

    utterance.onend = () => {
      if (handsFreeRef.current) {
        window.setTimeout(() => {
          if (handsFreeRef.current && !loadingRef.current) {
            void startListening();
          }
        }, 500);
      } else {
        setAssistantState("STANDBY");
      }
    };

    utterance.onerror = () => {
      setAssistantState("STANDBY");
    };

    setAssistantState("SPEAKING");
    window.speechSynthesis.speak(utterance);
  };

  // Send messages to the existing FastAPI backend
  const sendMessage = async (voiceMessage?: string) => {
    const text = (voiceMessage ?? message).trim();

    if (!text || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setInterimTranscript("");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: text },
    ]);

    setMessage("");
    setAssistantState("THINKING");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status}`);
      }

      const data = await response.json();

      const reply =
        typeof data.assistant_response === "string"
          ? data.assistant_response
          : "I received an empty response from my intelligence engine.";

      setProvider(data.provider ?? "unknown");

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: reply },
      ]);

      speakResponse(reply);
    } catch (error) {
      console.error("A.E.G.I.S. backend error:", error);

      const errorMessage =
        "I cannot connect to my backend. Please check whether the A.E.G.I.S. server is running.";

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: errorMessage },
      ]);

      setAssistantState("ERROR");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  // Start a microphone session
  const startListening = async () => {
    if (recognitionRef.current || loadingRef.current) return;

    const speechWindow = window as SpeechWindow;

    const SpeechRecognitionClass =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert(
        "Speech recognition is not supported. Please use Google Chrome."
      );
      return;
    }

    const recognition = new SpeechRecognitionClass();

    recognitionRef.current = recognition;

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    setListening(true);
    setAssistantState("LISTENING");
    setInterimTranscript("");

    void startAudioMeter();

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim.trim());

      if (finalTranscript.trim()) {
        recognition.stop();
        void sendMessage(finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      if (event.error !== "no-speech") {
        setAssistantState("ERROR");
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }

      setListening(false);
      stopAudioMeter();

      setAssistantState((current) =>
        current === "LISTENING" ? "STANDBY" : current
      );
    };

    try {
      recognition.start();
    } catch (error) {
      console.error("Microphone start error:", error);
      recognitionRef.current = null;
      setListening(false);
      stopAudioMeter();
      setAssistantState("ERROR");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    setListening(false);
    setInterimTranscript("");
    stopAudioMeter();

    setAssistantState("STANDBY");
  };

  // Hands-free mode automatically listens again after spoken replies
  const toggleHandsFree = () => {
    const nextState = !handsFreeRef.current;

    handsFreeRef.current = nextState;
    setHandsFree(nextState);

    if (nextState) {
      if (!recognitionRef.current && !loadingRef.current) {
        void startListening();
      }
    } else if (recognitionRef.current) {
      stopListening();
    }
  };

  const getGreeting = () => {
    const hour = clock.getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const statusLabel: Record<AssistantState, string> = {
    STANDBY: "SYSTEM STANDBY",
    LISTENING: "LISTENING",
    THINKING: "PROCESSING REQUEST",
    SPEAKING: "VOICE OUTPUT ACTIVE",
    ERROR: "SYSTEM ERROR",
  };

  const isActive =
    assistantState === "LISTENING" ||
    assistantState === "THINKING" ||
    assistantState === "SPEAKING";

  const voiceBars = Array.from({ length: 40 }, (_, index) => {
    const variation =
      0.45 + (Math.sin(index * 0.72) + 1) * 0.25;

    const height =
      assistantState === "LISTENING"
        ? 5 + voiceLevel * variation * 0.65
        : assistantState === "SPEAKING"
          ? 14
          : 4;

    return {
      id: index,
      height: Math.min(68, height),
    };
  });

  return (
    <main className="app-shell">
      <div className="background-grid" />
      <div className="ambient-glow glow-one" />
      <div className="ambient-glow glow-two" />

      {/* TOP SYSTEM BAR */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-symbol">
            <span>A</span>
          </div>

          <div className="brand-details">
            <h1>A.E.G.I.S.</h1>
            <span>ARTIFICIALLY ENHANCED INTELLIGENCE</span>
          </div>
        </div>

        <div className="topbar-center">
          <span className="topbar-line" />
          <span>PERSONAL INTELLIGENCE SYSTEM</span>
          <span className="topbar-line" />
        </div>

        <div className="topbar-right">
          <div className={`system-pill ${assistantState.toLowerCase()}`}>
            <span className="status-light" />
            {statusLabel[assistantState]}
          </div>

          <div className="system-clock">
            {clock.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        {/* LEFT NAVIGATION */}
        <aside className="sidebar">
          <div className="sidebar-heading">COMMAND</div>

          <button className="nav-item active">
            <span className="nav-icon">◈</span>
            <span>Overview</span>
          </button>

          <button className="nav-item">
            <span className="nav-icon">◎</span>
            <span>AI Assistant</span>
          </button>

          <button className="nav-item">
            <span className="nav-icon">⌘</span>
            <span>Automation</span>
          </button>

          <button className="nav-item">
            <span className="nav-icon">◷</span>
            <span>Memory</span>
          </button>

          <button className="nav-item">
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </button>

          <div className="sidebar-bottom">
            <div className="connection-indicator">
              <span className="status-light" />
              LOCAL CORE CONNECTED
            </div>

            <div className="sidebar-version">
              A.E.G.I.S. BUILD 1.0.0
              <br />
              HYBRID ARCHITECTURE
            </div>
          </div>
        </aside>

        {/* MAIN DASHBOARD */}
        <section className="main-content">
          <div className="welcome-section">
            <div>
              <span className="eyebrow">
                <span className="eyebrow-line" />
                PERSONAL AI COMMAND CENTER
              </span>

              <h2>
                {getGreeting()}, <span>Commander.</span>
              </h2>

              <p>
                Your intelligence system is ready. What shall we accomplish today?
              </p>
            </div>

            <div className="welcome-meta">
              <span>NEURAL NETWORK</span>
              <strong>OPERATIONAL</strong>
            </div>
          </div>

          {/* LIVE AI CORE */}
          <section
            className={`command-center state-${assistantState.toLowerCase()}`}
          >
            <div className="command-label">
              <span>01 / NEURAL CORE</span>
              <span className="core-id">AEGIS-CORE-001</span>
            </div>

            <div className="core-visual">
              <div className={`core-orb state-${assistantState.toLowerCase()}`}>
                <div className="orb-outer-ring" />
                <div className="orb-mid-ring" />
                <div className="orb-inner-ring" />
                <div className="orb-particles" />
                <div className="orb-center">
                  <span>A</span>
                </div>
                <div className="orb-crosshair crosshair-one" />
                <div className="orb-crosshair crosshair-two" />
              </div>

              <div className="core-readout readout-left">
                <span>CORE TEMP</span>
                <strong>OPTIMAL</strong>
              </div>

              <div className="core-readout readout-right">
                <span>AI ENGINE</span>
                <strong>QWEN 2.5</strong>
              </div>
            </div>

            <div className="core-state">
              <div className="core-state-title">
                <span className="live-dot" />
                {statusLabel[assistantState]}
              </div>

              <p>
                {assistantState === "LISTENING"
                  ? "A.E.G.I.S. is listening to your voice..."
                  : assistantState === "THINKING"
                    ? "Processing your request through the local intelligence engine..."
                    : assistantState === "SPEAKING"
                      ? "A.E.G.I.S. is delivering its response..."
                      : assistantState === "ERROR"
                        ? "An issue occurred. Check the system connection."
                        : "All systems ready. Awaiting your command."}
              </p>
            </div>

            {/* LIVE AUDIO WAVEFORM */}
            <div className={`voice-visualizer ${assistantState.toLowerCase()}`}>
              <div className="wave-label">
                <span>VOICE FREQUENCY MONITOR</span>
                <span>
                  {assistantState === "LISTENING"
                    ? `INPUT ${voiceLevel}%`
                    : assistantState === "SPEAKING"
                      ? "OUTPUT ACTIVE"
                      : "SIGNAL IDLE"}
                </span>
              </div>

              <div
                className={`wave-bars ${assistantState.toLowerCase()}`}
                aria-label="Live voice activity"
              >
                {voiceBars.map((bar) => (
                  <span
                    key={bar.id}
                    className="wave-bar"
                    style={{
                      height: `${bar.height}px`,
                      animationDelay: `${bar.id * 0.025}s`,
                    }}
                  />
                ))}
              </div>

              <div className="transcript-preview">
                {interimTranscript
                  ? `YOU: ${interimTranscript}`
                  : assistantState === "LISTENING"
                    ? "Speak now. Your voice will appear here..."
                    : assistantState === "SPEAKING"
                      ? "VOICE RESPONSE IN PROGRESS"
                      : "VOICE CHANNEL READY"}
              </div>
            </div>

            {/* VOICE CONTROLS */}
            <div className="voice-controls">
              <button
                className={`primary-voice-button ${
                  listening ? "recording" : ""
                }`}
                onClick={() =>
                  listening ? stopListening() : void startListening()
                }
                disabled={loading}
              >
                <span className="mic-symbol">
                  {listening ? "■" : "🎙"}
                </span>
                {listening ? "STOP LISTENING" : "ACTIVATE MICROPHONE"}
              </button>

              <button
                className={`handsfree-button ${
                  handsFree ? "enabled" : ""
                }`}
                onClick={toggleHandsFree}
                disabled={loading && !handsFree}
              >
                <span className="handsfree-indicator" />
                HANDS-FREE {handsFree ? "ON" : "OFF"}
              </button>
            </div>
          </section>

          {/* COMMUNICATION CHANNEL */}
          <section className="chat-panel">
            <div className="chat-header">
              <div>
                <span className="eyebrow">02 / COMMUNICATION</span>
                <h3>Command Interface</h3>
              </div>

              <div className="mode-control">
                <span>AI MODE</span>
                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as Mode)
                  }
                  aria-label="AI mode"
                >
                  <option value="local">LOCAL</option>
                  <option value="hybrid">HYBRID</option>
                  <option value="online">ONLINE</option>
                </select>
              </div>
            </div>

            <div className="messages">
              {messages.map((item, index) => (
                <div
                  key={index}
                  className={`message-row ${item.role}`}
                >
                  <div className="message-avatar">
                    {item.role === "assistant" ? "A" : "U"}
                  </div>

                  <div className="message-content">
                    <span className="message-label">
                      {item.role === "assistant" ? "A.E.G.I.S." : "COMMANDER"}
                    </span>
                    <p>{item.content}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-row assistant">
                  <div className="message-avatar">A</div>
                  <div className="message-content">
                    <span className="message-label">A.E.G.I.S.</span>
                    <p className="thinking-text">
                      Processing <span>•••</span>
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <form
              className="input-area"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <span className="input-prompt">›</span>

              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Enter a command or ask A.E.G.I.S. anything..."
                aria-label="Message"
              />

              <button
                type="submit"
                className="send-button"
                disabled={loading || !message.trim()}
              >
                {loading ? "..." : "TRANSMIT ↗"}
              </button>
            </form>

            <div className="chat-footer">
              <span>SECURE LOCAL CHANNEL</span>
              <span>ENGINE: {provider.toUpperCase()}</span>
              <span>ENCRYPTED SESSION</span>
            </div>
          </section>

          <footer className="main-footer">
            A.E.G.I.S. · ARTIFICIALLY ENHANCED GUIDANCE AND INTELLIGENT SUPPORT
          </footer>
        </section>

        {/* RIGHT SYSTEM PANEL */}
        <aside className="right-panel">
          <div className="panel-section-title">
            SYSTEM MONITOR
            <span>LIVE</span>
          </div>

          <div className="system-card">
            <div className="card-topline">
              <span>INTELLIGENCE CORE</span>
              <span className="status-light" />
            </div>

            <div className="model-icon">◈</div>
            <h3>QWEN 2.5</h3>
            <p>3B PARAMETER MODEL</p>

            <div className="card-divider" />

            <div className="system-detail">
              <span>AI PROVIDER</span>
              <strong>OLLAMA</strong>
            </div>
            <div className="system-detail">
              <span>EXECUTION</span>
              <strong>LOCAL</strong>
            </div>
            <div className="system-detail">
              <span>CONNECTION</span>
              <strong className="connected-text">CONNECTED</strong>
            </div>
          </div>

          <div className="system-card voice-card">
            <div className="card-topline">
              <span>VOICE INTERFACE</span>
              <span className={`mini-status ${listening ? "active" : ""}`} />
            </div>

            <div className="voice-detail">
              <span>MICROPHONE</span>
              <strong>{listening ? "ACTIVE" : "STANDBY"}</strong>
            </div>

            <div className="voice-detail">
              <span>VOICE OUTPUT</span>
              <strong>
                {assistantState === "SPEAKING" ? "ACTIVE" : "READY"}
              </strong>
            </div>

            <div className="voice-detail">
              <span>HANDS-FREE</span>
              <strong>{handsFree ? "ENABLED" : "DISABLED"}</strong>
            </div>

            <div className="mini-wave">
              {Array.from({ length: 18 }, (_, index) => (
                <span
                  key={index}
                  className={
                    assistantState === "LISTENING" ||
                    assistantState === "SPEAKING"
                      ? "active"
                      : ""
                  }
                  style={{
                    animationDelay: `${index * 0.04}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="system-card activity-card">
            <div className="card-topline">
              <span>SESSION ACTIVITY</span>
            </div>

            <div className="activity-number">
              {messages.filter((item) => item.role === "user").length}
            </div>
            <p>COMMANDS SENT</p>

            <div className="card-divider" />

            <div className="activity-state">
              <span className="status-light" />
              {loading
                ? "PROCESSING COMMAND"
                : listening
                  ? "RECEIVING AUDIO"
                  : assistantState === "SPEAKING"
                    ? "VOICE RESPONSE"
                    : "AWAITING INPUT"}
            </div>
          </div>

          <div className="right-panel-footer">
            <span>AEGIS SYSTEMS</span>
            <span>ALL RIGHTS RESERVED · 2026</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default App;
