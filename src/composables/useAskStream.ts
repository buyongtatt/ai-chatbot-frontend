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

export function useAskStream() {
  const answer = ref("");
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let controller: AbortController | null = null;
  let imageCount = 0; // Track image count

  async function askStream(question: string, file?: File) {
    imageCount = 0; // Reset counter
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
              // Clean the line to remove any extra characters
              const cleanLine = line.trim();
              if (!cleanLine) continue;

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
                imageCount++; // Increment counter
                console.log(`Processing image #${imageCount}`, msg);

                // Log what the AI said about images
                if (msg.doc_id) {
                  console.log(`Image ${imageCount} doc_id: ${msg.doc_id}`);
                }

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
                      content: `❌ Failed to load image #${imageCount}: ${filename || "unknown"}`,
                      id: `error-${Date.now()}-${Math.random()}`,
                    });
                    continue;
                  }
                } else {
                  // This case shouldn't happen if backend is working correctly
                  console.warn(`Image #${imageCount} has no URL or base64 content!`, msg);
                  messages.value.push({
                    role: "assistant",
                    type: "text",
                    content: `⚠️ Image #${imageCount} missing content data`,
                    id: `warning-${Date.now()}-${Math.random()}`,
                  });
                  continue;
                }

                if (imageUrl) {
                  const newImageMessage = {
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
                } else {
                  console.log(`No URL created for image #${imageCount}`);
                }
              }
            } catch (parseErr) {
              console.error("Bad JSON chunk - attempting recovery:", line, parseErr);

              // Try to extract image data from malformed JSON
              const imageMarkerMatch = line.match(/\[\[IMAGE:(.*?)\]\]/);
              if (imageMarkerMatch) {
                console.log("Found image marker in malformed JSON:", imageMarkerMatch[1]);

                // Create a synthetic image message
                const syntheticMsg = {
                  type: "image",
                  doc_id: imageMarkerMatch[1],
                  content: `⚠️ Image reference found but data incomplete: ${imageMarkerMatch[1]}`,
                };

                // Process as a regular image message but with warning
                messages.value.push({
                  role: "assistant",
                  type: "text",
                  content: `ℹ️ Detected image reference: ${imageMarkerMatch[1]} but data was incomplete`,
                  id: `warning-${Date.now()}-${Math.random()}`,
                });

                continue;
              }

              // Try to recover partial JSON
              const partialRecovery = tryRecoverJSON(line);
              if (partialRecovery) {
                console.log("Partially recovered message:", partialRecovery);
                // Process the recovered message
                continue;
              }

              console.error("Completely failed to parse JSON chunk:", line);
            }
          }
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
  }

  function tryRecoverJSON(partialJson: string): any | null {
    try {
      // Try to find and extract key-value pairs
      const typeMatch = partialJson.match(/"type":\s*"([^"]+)"/);
      const docIdMatch = partialJson.match(/"doc_id":\s*"([^"]+)"/);
      const urlMatch = partialJson.match(/"url":\s*"([^"]+)"/);

      if (typeMatch) {
        const recovered: any = { type: typeMatch[1] };
        if (docIdMatch) recovered.doc_id = docIdMatch[1];
        if (urlMatch) recovered.url = urlMatch[1];
        return recovered;
      }
    } catch (e) {
      console.error("Failed to recover JSON:", e);
    }
    return null;
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
  };
}
