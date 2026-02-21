/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { convertWorkflowFormat, type ComfyWorkflow } from '../utils/comfyUtils';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type { ComfyWorkflow };

interface UseComfyReturn {
  status: ConnectionStatus;
  clientId: string | null;
  error: string | null;
  host: string;
  connect: (hostUrl: string) => Promise<void>;
  disconnect: () => void;
  runWorkflow: (baseWorkflow: ComfyWorkflow, imageBlob: Blob, prompt: string, styleBlob?: Blob) => Promise<void>;
  lastImage: string | null;
}

export function useComfy(): UseComfyReturn {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);
  // Default to localhost:8000 for ComfyUI, but this value is less critical now as we use the proxy
  const [comfyHost, setComfyHost] = useLocalStorage<string>("comfy_host_url", "http://127.0.0.1:8000");
  
  const wsRef = useRef<WebSocket | null>(null);
  
  // Clean up WS on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('DISCONNECTED');
  }, []);

  const connect = useCallback(async (hostUrl: string) => {
    if (status === 'CONNECTED' && wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('CONNECTING');
    setError(null);
    setComfyHost(hostUrl);

    try {
      // 1. Check Connection via Proxy
      // We use the Vite proxy path /comfyui-api/system_stats
      const statsRes = await fetch('/comfyui-api/system_stats');

      if (!statsRes.ok) {
         throw new Error(`Failed to connect to ComfyUI. Ensure it is running at http://127.0.0.1:8000.`);
      }
      
      // additional check: ensure it's json and looks like comfy
      try {
          const stats = await statsRes.json();
          if (!stats || !stats.system) { // ComfyUI system_stats has a 'system' object
              throw new Error("Connected to server but it doesn't look like ComfyUI (invalid response).");
          }
      } catch (e) {
         throw new Error("Connected to server but failed to parse response. Is it ComfyUI?");
      }

      // 2. Client ID
      const newClientId = crypto.randomUUID();
      setClientId(newClientId);

      // 3. Connect WebSocket via Proxy
      // We use the Vite proxy path /comfyui-ws
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${wsProtocol}//${host}/comfyui-ws?clientId=${newClientId}`;
      
      console.log('Connecting to Comfy WS:', wsUrl);
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('ComfyUI WebSocket Connected');
        setStatus('CONNECTED');
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'executed' && msg.data?.output?.images) {
             const imgs = msg.data.output.images;
             if (imgs && imgs.length > 0) {
                const img = imgs[0];
                // Construct Proxy View URL
                const viewUrl = `/comfyui-api/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
                setLastImage(viewUrl);
             }
          }
        } catch (e) {
          // ignore binary
        }
      };

      ws.onclose = () => {
        console.log('ComfyUI WebSocket Closed');
        setStatus('DISCONNECTED');
      };

      ws.onerror = (e) => {
        console.error('ComfyUI WebSocket Error', e);
        setStatus('ERROR');
      };

      wsRef.current = ws;

    } catch (e: any) {
      console.error('Comfy Connection Failed:', e);
      setStatus('ERROR');
      setError(e.message);
      disconnect();
    }
  }, [status, setComfyHost, disconnect]);

  const uploadImage = useCallback(async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("image", blob, "sketch.png");
    formData.append("overwrite", "true");

    const resp = await fetch('/comfyui-api/upload/image', {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) throw new Error("Failed to upload image");
    const json = await resp.json();
    return json.name;
  }, []);

  const runWorkflow = useCallback(async (baseWorkflow: ComfyWorkflow, imageBlob: Blob, prompt: string, styleBlob?: Blob) => {
    if (status !== 'CONNECTED' || !clientId) {
      throw new Error("ComfyUI not connected");
    }

    // 1. Upload Images
    const filename = await uploadImage(imageBlob);
    let styleFilename: string | null = null;
    if (styleBlob) {
        styleFilename = await uploadImage(styleBlob);
    }

    // 2. Prepare Workflow (Convert if needed)
    // This handles both API format and Graph format (with subgraphs)
    const workflow = convertWorkflowFormat(baseWorkflow);

    // 3. Heuristic Updates
    // Update LoadImage
    const imageNodes = Object.values(workflow).filter((n: any) => n.class_type === "LoadImage");
    
    // The first image node is always the sketch
    if (imageNodes[0]) {
      (imageNodes[0] as any).inputs.image = filename;
    }
    
    // The second image node is the style reference
    if (imageNodes[1] && styleFilename) {
      (imageNodes[1] as any).inputs.image = styleFilename;
    } else if (imageNodes[1] && !styleFilename) {
       (imageNodes[1] as any).inputs.image = filename;
    }

    // Update Prompt (CLIPTextEncode)
    for (const [key, node] of Object.entries(workflow)) {
      const n = node as any;
      if (n.class_type === "CLIPTextEncode" && typeof n.inputs?.text === "string") {
         if (key === "175") {
             // Inject custom style prompt for the concatenate conditioning node
             n.inputs.text = "Use image 2 as an style render reference.";
         } else if (key === "97" || !n.inputs.text || n.inputs.text === "") {
             // Node 97 is the positive prompt in defaultWorkflow. 
             // Apply the user's prompt to node 97 or any empty text encode to be safe.
             n.inputs.text = prompt;
         }
      }
      
      // Update Seed
      if (n.class_type === "KSampler" || n.class_type === "SamplerCustom") {
        if (n.inputs.seed !== undefined) {
          n.inputs.seed = Math.floor(Math.random() * 1000000000);
        }
      }
    }

    // 4. Queue
    console.log('[useComfy] Sending workflow to ComfyUI:', JSON.stringify(workflow, null, 2));

    const queueResp = await fetch('/comfyui-api/prompt', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId,
      }),
    });

    console.log('[useComfy] Queue response status:', queueResp.status);
    
    if (!queueResp.ok) {
        const errText = await queueResp.text();
        console.error('[useComfy] Queue failed:', errText);
        throw new Error(`Failed to queue prompt: ${queueResp.status} ${errText}`);
    }

  }, [status, clientId, uploadImage]);

  return { status, clientId, error, host: comfyHost, connect, disconnect, runWorkflow, lastImage };
}
