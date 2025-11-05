import { useState, useRef, useCallback, useEffect } from "react";
import { IconButton } from "./button";
import { Path } from "../constant";
import { useNavigate } from "react-router-dom";
import Locale from "../locales";
import styles from "./reader.module.scss";

import ReturnIcon from "../icons/return.svg";
import BookIcon from "../icons/book.svg";
import SpeakIcon from "../icons/speak.svg";
import SpeakStopIcon from "../icons/speak-stop.svg";
import LoadingIcon from "../icons/three-dots.svg";
import CloseIcon from "../icons/close.svg";

import { createTTSPlayer } from "../utils/audio";
import { MsEdgeTTS, OUTPUT_FORMAT } from "../utils/ms_edge_tts";
import { useAppConfig } from "../store";
import { DEFAULT_TTS_ENGINE } from "../constant";
import { showToast } from "./ui-lib";

// Dynamic import for react-reader to avoid SSR issues
import dynamic from "next/dynamic";

const ReactReader = dynamic(
  () => import("react-reader").then((mod) => mod.ReactReader),
  { ssr: false },
);

enum ReadingStatus {
  Idle = "idle",
  Loading = "loading",
  Playing = "playing",
  Paused = "paused",
  Error = "error",
}

export function Reader() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const [book, setBook] = useState<File | null>(null);
  const [bookUrl, setBookUrl] = useState<string>("");
  const [location, setLocation] = useState<string | number>(0);
  const [status, setStatus] = useState<ReadingStatus>(ReadingStatus.Idle);
  const [isEpub, setIsEpub] = useState(false);
  const [textContent, setTextContent] = useState<string>("");
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ttsPlayerRef = useRef<ReturnType<typeof createTTSPlayer> | null>(null);
  const renditionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize TTS player lazily
  useEffect(() => {
    if (!ttsPlayerRef.current) {
      ttsPlayerRef.current = createTTSPlayer();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bookUrl) {
        URL.revokeObjectURL(bookUrl);
      }
      if (ttsPlayerRef.current) {
        ttsPlayerRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [bookUrl]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file) return;

      setStatus(ReadingStatus.Loading);
      setBook(file);

      // Revoke previous URL if exists
      if (bookUrl) {
        URL.revokeObjectURL(bookUrl);
      }

      const url = URL.createObjectURL(file);
      setBookUrl(url);

      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".epub")) {
        setIsEpub(true);
        setStatus(ReadingStatus.Idle);
      } else if (fileName.endsWith(".txt")) {
        // Read text file
        setIsEpub(false);
        try {
          const text = await file.text();
          setTextContent(text);
          setStatus(ReadingStatus.Idle);
        } catch (error) {
          console.error("Failed to read text file:", error);
          setStatus(ReadingStatus.Error);
          showToast(Locale.Reader.LoadError);
        }
      } else if (fileName.endsWith(".pdf")) {
        // For PDF, we'll show a message that it's not fully supported yet
        setIsEpub(false);
        setTextContent(
          "PDF support coming soon. Please use EPUB or TXT format for now.",
        );
        setStatus(ReadingStatus.Idle);
        showToast(
          "PDF format is not fully supported yet. Please use EPUB or TXT.",
        );
      } else {
        setStatus(ReadingStatus.Error);
        showToast(Locale.Reader.LoadError);
      }
    },
    [bookUrl],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const extractTextFromEpub = useCallback(async () => {
    if (!renditionRef.current) {
      showToast("Reader not initialized");
      return "";
    }

    try {
      // Get current chapter text
      const contents = renditionRef.current.getContents();
      if (contents && contents.length > 0) {
        const text = contents[0].document.body.textContent || "";
        return text;
      }
      return "";
    } catch (error) {
      console.error("Failed to extract text from EPUB:", error);
      return "";
    }
  }, []);

  const speakText = useCallback(
    async (text: string) => {
      if (!text || !config.ttsConfig.enable) {
        showToast("Please enable TTS in settings first");
        return;
      }

      setStatus(ReadingStatus.Playing);

      try {
        // Stop any existing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        if (config.ttsConfig.engine === "Edge-TTS") {
          // Use Microsoft Edge TTS
          const tts = new MsEdgeTTS();
          await tts.setMetadata(
            config.ttsConfig.voice,
            OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
          );

          const result = await tts.toArrayBuffer(text);
          const audioBlob = new Blob([result], { type: "audio/mp3" });
          const audioUrl = URL.createObjectURL(audioBlob);

          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.playbackRate = config.ttsConfig.speed || 1.0;

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setStatus(ReadingStatus.Idle);
            setCurrentSentenceIndex(-1);
            audioRef.current = null;
          };

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            setStatus(ReadingStatus.Error);
            showToast("Failed to play audio");
            audioRef.current = null;
          };

          await audio.play();
        } else if (config.ttsConfig.engine === DEFAULT_TTS_ENGINE) {
          // OpenAI TTS would require API integration
          showToast(
            "OpenAI TTS requires backend API integration. Please use Edge-TTS from settings.",
          );
          setStatus(ReadingStatus.Idle);
        } else {
          showToast(
            "Unsupported TTS engine. Please configure TTS in settings.",
          );
          setStatus(ReadingStatus.Idle);
        }
      } catch (error) {
        console.error("TTS error:", error);
        setStatus(ReadingStatus.Error);
        showToast("Failed to play audio");
      }
    },
    [config.ttsConfig],
  );

  const handlePlay = useCallback(async () => {
    let text = "";

    if (isEpub) {
      text = await extractTextFromEpub();
    } else {
      text = textContent;
    }

    if (!text) {
      showToast("No text to read");
      return;
    }

    // Read the full text (removing demo limitation)
    await speakText(text);
  }, [isEpub, textContent, extractTextFromEpub, speakText]);

  const handleStop = useCallback(() => {
    if (ttsPlayerRef.current) {
      ttsPlayerRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setStatus(ReadingStatus.Idle);
    setCurrentSentenceIndex(-1);
  }, []);

  const handleClose = useCallback(() => {
    if (bookUrl) {
      URL.revokeObjectURL(bookUrl);
    }
    setBook(null);
    setBookUrl("");
    setTextContent("");
    setIsEpub(false);
    setStatus(ReadingStatus.Idle);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [bookUrl]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles["header-title"]}>
          <BookIcon className={styles.icon} />
          <span>{Locale.Reader.Title}</span>
        </div>
        <div className={styles["header-actions"]}>
          {book && (
            <IconButton
              icon={<CloseIcon />}
              text={Locale.UI.Close}
              onClick={handleClose}
            />
          )}
          <IconButton
            icon={<ReturnIcon />}
            text={Locale.Chat.Actions.ChatList}
            onClick={() => navigate(Path.Home)}
          />
        </div>
      </div>

      {!book ? (
        <div className={styles["upload-area"]}>
          <div
            className={styles["upload-box"]}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <BookIcon className={styles["upload-icon"]} />
            <div className={styles["upload-title"]}>
              {Locale.Reader.Upload.Title}
            </div>
            <div className={styles["upload-subtitle"]}>
              {Locale.Reader.Upload.SubTitle}
            </div>
            <IconButton
              text={Locale.Reader.Upload.Button}
              type="primary"
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub,.txt,.pdf,.mobi"
              onChange={handleFileChange}
            />
          </div>
        </div>
      ) : status === ReadingStatus.Loading ? (
        <div className={styles.loading}>
          <LoadingIcon className={styles["loading-icon"]} />
          <div>{Locale.Reader.Status.Loading}</div>
        </div>
      ) : status === ReadingStatus.Error ? (
        <div className={styles["error-message"]}>
          <CloseIcon className={styles["error-icon"]} />
          <div>{Locale.Reader.LoadError}</div>
        </div>
      ) : (
        <>
          <div className={styles["reader-content"]}>
            {isEpub ? (
              <div className={styles["reader-wrapper"]}>
                <ReactReader
                  url={bookUrl}
                  location={location}
                  locationChanged={(loc: string) => setLocation(loc)}
                  getRendition={(rendition: any) => {
                    renditionRef.current = rendition;
                  }}
                />
              </div>
            ) : (
              <div
                className={`${styles["text-content"]} ${
                  status === ReadingStatus.Playing ? styles.reading : ""
                }`}
              >
                {textContent}
              </div>
            )}
          </div>

          <div className={styles.controls}>
            <div className={styles["control-buttons"]}>
              {status === ReadingStatus.Playing ? (
                <IconButton
                  icon={<SpeakStopIcon />}
                  text={Locale.Reader.Controls.Stop}
                  type="primary"
                  onClick={handleStop}
                />
              ) : (
                <IconButton
                  icon={<SpeakIcon />}
                  text={Locale.Reader.Controls.Play}
                  type="primary"
                  onClick={handlePlay}
                />
              )}
            </div>

            <div className={styles["control-group"]}>
              <span className={styles["control-label"]}>
                {Locale.Reader.Controls.Speed}:
              </span>
              <span>{config.ttsConfig.speed?.toFixed(1)}x</span>
            </div>

            <div className={styles["control-group"]}>
              <span className={styles["control-label"]}>
                {Locale.Reader.Controls.Voice}:
              </span>
              <span>{config.ttsConfig.voice}</span>
            </div>

            <div className={styles["control-group"]}>
              <span className={styles["control-label"]}>
                {Locale.Reader.Status.Title}: {status}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
