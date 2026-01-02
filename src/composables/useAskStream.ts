import { ref } from "vue";
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

interface ChatMessage {
  role: "user" | "assistant";
  type?: "text" | "file" | "image";
  content?: string;
  url?: string;
  blob?: Blob;
  filename?: string;
}

export function useAskStream() {
  const answer = ref("");
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let controller: AbortController | null = null;

  async function askStream(question: string, file?: File) {
    answer.value = "";
    error.value = null;
    loading.value = true;
    controller = new AbortController();

    try {
      const formData = new FormData();
      formData.append("question", question);
      if (file) formData.append("file", file);

      const resp = await fetch(`${API_BASE}/ask_stream`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.trim());
          for (const line of lines) {
            try {
              const msg = JSON.parse(line) as { type: string; content?: string; url?: string };

              if (msg.type === "text") {
                answer.value += msg.content ?? "";
                const last = messages.value[messages.value.length - 1];
                if (last && last.role === "assistant" && last.type === "text") {
                  last.content = answer.value;
                } else {
                  messages.value.push({
                    role: "assistant",
                    type: "text",
                    content: msg.content ?? "",
                  });
                }
              } else if (msg.type === "file" && msg.url) {
                // Fetch blob so user can download even if URL is not directly accessible
                const fileResp = await fetch(`${API_BASE}${msg.url}`);
                const blob = await fileResp.blob();
                const filename = msg.url.split("/").pop() || "download";
                messages.value.push({
                  role: "assistant",
                  type: "file",
                  filename,
                  blob,
                  content: `📥 ${filename}`,
                });
              } else if (msg.type === "image" && msg.url) {
                messages.value.push({
                  role: "assistant",
                  type: "image",
                  url: msg.url,
                });
              }
            } catch {
              console.error("Bad JSON chunk", line);
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        error.value = "Request aborted by user.";
      } else if (err instanceof Error) {
        error.value = err.message;
      } else {
        error.value = "Unknown error occurred.";
      }
    } finally {
      loading.value = false;
      controller = null;
    }
  }

  function abortStream() {
    if (controller) {
      controller.abort();
      controller = null;
      loading.value = false;
    }
  }

  function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { answer, messages, askStream, abortStream, downloadFile, loading, error };
}
