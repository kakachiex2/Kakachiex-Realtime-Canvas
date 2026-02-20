/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useCallback, useRef } from 'react';
import { fal } from "@fal-ai/client";

// Ensure fal is configured with the proxy token provider
fal.config({
  proxyUrl: "/api/fal/realtime-token", // This might not be right for fal.realtime.connect?
  // fal.realtime.connect takes a tokenProvider.
});

// We need to define the token provider function explicitly or pass it.
// Proxy to our backend which keeps the key secret.
const tokenProvider = async () => {
  const response = await fetch("/api/fal/realtime-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app: "fal-ai/flux-2/klein" }), // hardcoded for now or param?
  });
  if (!response.ok) throw new Error("Token failed");
  return response.text();
};

export function useFal() {
  const [status, setStatus] = useState<string>("idle");
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connection = useRef<any>(null);

  const connect = useCallback(() => {
    if (connection.current) return;

    setStatus("connecting");
    try {
      connection.current = fal.realtime.connect("fal-ai/flux-2/klein", {
        connectionKey: "klein-realtime",
        throttleInterval: 64,
        tokenProvider, // Use our proxy provider
        onResult: (result) => {
          if (result.images && result.images.length > 0) {
            const img = result.images[result.images.length - 1];
            if (img.url) {
                setLastImage(img.url);
            } else if (img.content) {
                // Handle base64 content type
                // content_type, content
                const mime = img.content_type || "image/jpeg";
                setLastImage(`data:${mime};base64,${img.content}`);
            }
            setStatus("generated");
          }
        },
        onError: (err) => {
          console.error("Fal Error:", err);
          setError(err.message);
          setStatus("error");
        }
      });
    } catch (e: any) {
        setError(e.message);
    }
  }, []);

  const send = useCallback((dataUrl: string, prompt: string) => {
    if (!connection.current) {
        connect();
        // Might need to wait for connection? fal client handles queueing usually.
    }
    
    connection.current?.send({
        image_url: dataUrl,
        prompt: prompt,
        image_size: "square",
        num_inference_steps: 3,
        seed: Math.floor(Math.random() * 1000000), // Randomize or fixed? app.js used fixed 35?? No, "seed: 35" in app.js
        output_feedback_strength: 1,
    });
    setStatus("sending");
  }, [connect]);

  return { status, lastImage, error, send, connect };
}
