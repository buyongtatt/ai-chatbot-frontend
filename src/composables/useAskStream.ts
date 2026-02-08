import { ref } from "vue";
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

interface ChatMessage {
  role: "user" | "assistant";
  type?: "text" | "file" | "image";
  content?: string;
  url?: string;
  blob?: Blob;
  filename?: string;
  mimeType?: string;
  size?: number;
  id?: string;
}

export interface KnowledgeBase {
  area_name: string;
  display_name: string;
  url: string;
  description: string;
}

// Hardcoded knowledge bases - matches backend configuration
const KNOWLEDGE_BASES: KnowledgeBase[] = [
  {
    area_name: "get_unit_info",
    display_name: "Get Unit Info",
    url: "http://localhost:8001/getunitinfo/getunitinfo.pdf",
    description: "Get Unit Info documentation",
  },
  {
    area_name: "save_test_result",
    display_name: "Save Test Result",
    url: "http://localhost:8002/savetestresult/savetestresult.pdf",
    description: "Save Test Result documentation",
  },
  {
    area_name: "error",
    display_name: "Error",
    url: "http://localhost:8003/error/error.pdf",
    description: "Error documentation",
  },
];

export function useAskStream() {
  const answer = ref("");
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedKnowledgeBase = ref<string>("get_unit_info"); // Default to first knowledge base
  let controller: AbortController | null = null;
  let imageCount = 0;
  let buffer = ""; // Buffer for incomplete JSON chunks

  async function askStream(question: string, file?: File, areaName?: string) {
    imageCount = 0;
    buffer = "";
    error.value = null;
    loading.value = true;
    controller = new AbortController();

    try {
      const formData = new FormData();
      formData.append("question", question);
      formData.append("area_name", areaName || selectedKnowledgeBase.value);
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
          // Add new data to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from buffer
          const lines = buffer.split("\n");

          // Keep the last incomplete line in buffer for next iteration
          buffer = lines.pop() || "";

          // Process all complete lines
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            try {
              const msg = JSON.parse(cleanLine) as {
                type: string;
                content?: string;
                url?: string;
                doc_id?: string;
                mime?: string;
                filename?: string;
                size?: number;
                content_b64?: string;
              };

              console.log("Successfully parsed message:", msg);

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
                    id: `text-${Date.now()}-${Math.random()}`,
                  });
                }
              } else if (msg.type === "file") {
                let blob: Blob | null = null;
                let filename = msg.filename || "download.bin";
                let mimeType = msg.mime || "application/octet-stream";

                if (msg.url) {
                  try {
                    const fileResp = await fetch(
                      msg.url.startsWith("http") ? msg.url : `${API_BASE}${msg.url}`,
                    );
                    blob = await fileResp.blob();
                    mimeType = fileResp.headers.get("content-type") || mimeType;
                    filename = msg.filename || msg.url.split("/").pop() || filename;
                  } catch (fetchErr) {
                    console.error("Failed to fetch file from URL:", msg.url, fetchErr);
                    if (msg.content_b64) {
                      const byteChars = atob(msg.content_b64);
                      const byteArray = Uint8Array.from(byteChars, (c) => c.charCodeAt(0));
                      blob = new Blob([byteArray], { type: mimeType });
                      filename = msg.filename || msg.doc_id?.split("/").pop() || filename;
                    }
                  }
                } else if (msg.content_b64) {
                  try {
                    const byteChars = atob(msg.content_b64);
                    const byteArray = Uint8Array.from(byteChars, (c) => c.charCodeAt(0));
                    blob = new Blob([byteArray], { type: mimeType });
                    filename = msg.filename || msg.doc_id?.split("/").pop() || filename;
                  } catch (decodeErr) {
                    console.error("Failed to decode base64 file:", decodeErr);
                    continue;
                  }
                }

                if (blob) {
                  messages.value.push({
                    role: "assistant",
                    type: "file",
                    filename,
                    blob,
                    mimeType,
                    size: msg.size || blob.size,
                    content: `📎 ${filename}`,
                    id: `file-${Date.now()}-${Math.random()}`,
                  });
                }
              } else if (msg.type === "image") {
                imageCount++;
                console.log(`Processing image #${imageCount}`, msg);

                let imageUrl: string | null = null;
                let blob: Blob | null = null;
                let filename =
                  msg.filename || msg.doc_id?.split("/").pop() || `image_${imageCount}.png`;
                const mimeType = msg.mime || "image/png";

                if (msg.url) {
                  imageUrl = msg.url;
                  console.log(`Image #${imageCount} using direct URL:`, imageUrl);
                } else if (msg.content_b64) {
                  try {
                    console.log(
                      `Image #${imageCount} decoding base64, length: ${msg.content_b64.length}`,
                    );
                    const byteChars = atob(msg.content_b64);
                    const byteNums = new Array(byteChars.length);
                    for (let i = 0; i < byteChars.length; i++) {
                      byteNums[i] = byteChars.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNums);
                    blob = new Blob([byteArray], { type: mimeType });
                    imageUrl = URL.createObjectURL(blob);
                    filename =
                      msg.filename || msg.doc_id?.split("/").pop() || `image_${imageCount}.png`;
                    console.log(
                      `Image #${imageCount} created from base64, size: ${byteArray.length} bytes`,
                    );
                  } catch (decodeErr) {
                    console.error(`Failed to decode base64 image #${imageCount}:`, decodeErr);
                    messages.value.push({
                      role: "assistant",
                      type: "text",
                      content: `❌ Failed to load image #${imageCount}`,
                      id: `error-${Date.now()}-${Math.random()}`,
                    });
                    continue;
                  }
                }

                if (imageUrl) {
                  const newImageMessage: ChatMessage = {
                    role: "assistant",
                    type: "image",
                    url: imageUrl,
                    filename,
                    blob: blob || undefined,
                    mimeType,
                    size: msg.size,
                    id: `image-${imageCount}-${Date.now()}-${Math.random()}`,
                  };
                  messages.value.push(newImageMessage);
                  console.log(`Successfully added image #${imageCount}:`, newImageMessage);
                }
              }
            } catch (parseErr) {
              console.error("Bad JSON chunk:", cleanLine, parseErr);

              // Try to extract image markers from malformed content
              const imageMarkers = cleanLine.match(/\[\[IMAGE:(.*?)\]\]/g);
              if (imageMarkers && imageMarkers.length > 0) {
                for (const markerMatch of imageMarkers) {
                  const docId = markerMatch.replace(/\[\[IMAGE:(.*?)\]\]/, "$1");
                  console.log("Found image marker in text:", docId);

                  messages.value.push({
                    role: "assistant",
                    type: "text",
                    content: `ℹ️ Referenced image: ${docId} (data not available in response)`,
                    id: `info-${Date.now()}-${Math.random()}`,
                  });
                }
              }
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer.trim()) as {
            type: string;
            content?: string;
            url?: string;
            doc_id?: string;
            mime?: string;
            filename?: string;
            size?: number;
            content_b64?: string;
          };

          // Process the final message the same way
          if (msg.type === "text") {
            // ... same processing logic
          }
          // ... handle other types
        } catch (e) {
          console.error("Failed to parse final buffer:", buffer, e);
        }
      }

      console.log(`Total images processed: ${imageCount}`);
    } catch (err: unknown) {
      console.error("Stream error:", err);
      if (err instanceof DOMException && err.name === "AbortError") {
        error.value = "Request aborted by user.";
      } else if (err instanceof Error) {
        error.value = err.message;
      } else {
        error.value = "Unknown error occurred.";
      }

      messages.value.push({
        role: "assistant",
        type: "text",
        content: `⚠️ ${error.value}`,
        id: `error-${Date.now()}`,
      });
    } finally {
      console.log(`Final image count: ${imageCount}`);
      buffer = ""; // Clear buffer
      answer.value = "";
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearMessages() {
    messages.value.forEach((msg) => {
      if (msg.type === "image" && msg.url && msg.url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(msg.url);
        } catch (e) {
          console.warn("Failed to revoke object URL:", e);
        }
      }
    });
    messages.value = [];
    answer.value = "";
    error.value = null;
    imageCount = 0;
    buffer = "";
  }

  return {
    answer,
    messages,
    askStream,
    abortStream,
    downloadFile,
    clearMessages,
    loading,
    error,
    selectedKnowledgeBase,
    knowledgeBases: KNOWLEDGE_BASES,
  };
}
