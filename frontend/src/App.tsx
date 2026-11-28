
import { useState } from "react";
import "./App.css";

type Mode = "local" | "online" | "hybrid";

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

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResult[];
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

function App() {
  const [mode, setMode] = useState<Mode>("hybrid");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am A.E.G.I.S. Your intelligent assistant. How can I help you today?",
    },
  ]);

  const [status, setStatus] = useState("ONLINE");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const sendMessage = async (voiceMessage?: string) => {
    const text = (voiceMessage ?? message).trim();

    if (!text || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: text },
    ]);

    setMessage("");
    setLoading(true);
    setStatus("THINKING");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/chat/", {
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
        throw new Error("Backend request failed");
      }

      const data = await response.json();
      const reply = data.assistant_response;

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: reply },
      ]);

      setStatus("SPEAKING");
      speakResponse(reply);
    } catch {
      const errorMessage =
        "I cannot connect to my backend. Please check whether the A.E.G.I.S. server is running.";

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: errorMessage },
      ]);

      setStatus("CONNECTION ERROR");
    } finally {
      setLoading(false);
    }
  };

  const speakResponse = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setStatus("ONLINE");
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
      /male|david|mark|guy|daniel|james|alex|tom/i.test(voice.name)
    );

    const englishVoice =
      preferredVoice ??
      voices.find((voice) => voice.lang.startsWith("en"));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onend = () => setStatus("ONLINE");
    utterance.onerror = () => setStatus("ONLINE");

    window.speechSynthesis.speak(utterance);
  };

const startListening = () => {
  const speechWindow = window as SpeechWindow;

  const SpeechRecognitionClass =
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    alert(
      "Speech recognition is not supported. Please try Google Chrome."
    );
    return;
  }

  const recognition = new SpeechRecognitionClass();

  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();

    if (transcript) {
      void sendMessage(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    setStatus("VOICE ERROR");
    setListening(false);
  };

  recognition.onend = () => {
    setListening(false);
  };

  try {
    setListening(true);
    setStatus("LISTENING");
    recognition.start();
  } catch (error) {
    console.error(error);
    setListening(false);
    setStatus("VOICE ERROR");
  }
};


  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <h1>A.E.G.I.S.</h1>
            <span>INTELLIGENT ASSISTANT</span>
          </div>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          SYSTEM {status}
        </div>
      </header>

      <section className="dashboard">
        <aside className="sidebar">
          <div className="side-label">SYSTEM</div>
          <div className="nav-item active">◈ Dashboard</div>
          <div className="nav-item">◉ AI Assistant</div>
          <div className="nav-item">⌘ Automation</div>
          <div className="nav-item">⚙ Settings</div>

          <div className="sidebar-bottom">
            <span>VERSION 1.0.0</span>
            <span>HYBRID AI ARCHITECTURE</span>
          </div>
        </aside>

        <section className="main-panel">
          <div className="welcome">
            <span className="eyebrow">PERSONAL AI SYSTEM</span>
            <h2>
              Good day, <span>Commander.</span>
            </h2>
            <p>Your intelligent assistant is ready for instructions.</p>
          </div>

          <div className="orb-section">
            <div
              className={`orb ${
                loading || listening ? "thinking" : ""
              }`}
            >
              <div className="orb-core" />
              <div className="orb-ring ring-one" />
              <div className="orb-ring ring-two" />
              <div className="orb-ring ring-three" />
            </div>

            <div className="orb-caption">
              <span className="status-dot" />
              {listening
                ? "LISTENING TO YOUR VOICE"
                : loading
                  ? "PROCESSING REQUEST"
                  : status === "SPEAKING"
                    ? "SPEAKING"
                    : "SYSTEM STANDBY"}
            </div>
          </div>

          <section className="chat-panel">
            <div className="chat-heading">
              <div>
                <h3>Communication Channel</h3>
                <span>INTERACT WITH A.E.G.I.S.</span>
              </div>

              <select
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as Mode)
                }
                aria-label="AI mode"
              >
                <option value="hybrid">HYBRID MODE</option>
                <option value="local">LOCAL MODE</option>
                <option value="online">ONLINE MODE</option>
              </select>
            </div>

            <div className="messages">
              {messages.map((item, index) => (
                <div
                  key={index}
                  className={`message ${item.role}`}
                >
                  <span className="message-label">
                    {item.role === "assistant" ? "A.E.G.I.S." : "YOU"}
                  </span>
                  <p>{item.content}</p>
                </div>
              ))}

              {loading && (
                <div className="message assistant">
                  <span className="message-label">A.E.G.I.S.</span>
                  <p>Processing your request...</p>
                </div>
              )}
            </div>

            <form
              className="input-area"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <button
                type="button"
                className={`mic-button ${listening ? "mic-active" : ""}`}
                onClick={startListening}
                disabled={loading || listening}
                title="Activate microphone"
                aria-label="Activate microphone"
              >
                {listening ? "●" : "🎙"}
              </button>

              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={
                  listening
                    ? "Listening to your voice..."
                    : "Enter your instructions..."
                }
                aria-label="Message"
              />

              <button
                type="submit"
                disabled={loading || !message.trim()}
              >
                {loading ? "..." : "SEND ↗"}
              </button>
            </form>
          </section>

          <footer className="footer">
            A.E.G.I.S. · ARTIFICIALLY ENHANCED GUIDANCE AND INTELLIGENT SUPPORT
          </footer>
        </section>
      </section>
    </main>
  );
}

export default App;
