/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */


export interface ComfyNode {
  inputs: Record<string, any>;
  class_type: string;
  _meta?: { title?: string };
}

export type ComfyWorkflow = Record<string, ComfyNode>;

// Regular ComfyUI workflow format (exported via Save, not API format)
interface RegularWorkflowNode {
  id: number;
  type: string;
  title?: string;
  widgets_values?: unknown[];
  inputs?: Array<{ name: string; type: string; link?: number | null }>;
  outputs?: Array<{ name: string; type: string; links?: number[] }>;
}

interface RegularWorkflow {
  nodes: RegularWorkflowNode[];
  links: Array<[number, number, number, number, number, string]>; // [linkId, fromNodeId, fromSlot, toNodeId, toSlot, type]
  definitions?: {
    subgraphs?: SubgraphDefinition[];
  };
  extra?: {
      ue_links?: Array<{ downstream: number; downstream_slot: number; upstream: number; upstream_slot: number; type: string }>;
  }
}

interface SubgraphDefinition {
  id: string; // The UUID type
  nodes: RegularWorkflowNode[];
  links: Array<[number, number, number, number, number, string]>;
  inputNode: { id: number };
  outputNode: { id: number };
  inputs: Array<{ name: string; type: string; linkIds: number[] }>;
  outputs: Array<{ name: string; type: string; linkIds: number[] }>;
}

/**
 * Detect whether the loaded JSON is API format or regular format,
 * and convert regular → API format if needed.
 */
export function convertWorkflowFormat(json: any): ComfyWorkflow {
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch (e) {
      console.error('[ComfyUtils] Failed to parse workflow string:', e);
      return {};
    }
  }

  // Check if it's already API format: keys are numeric IDs with class_type
  const keys = Object.keys(json);
  if (keys.length === 0) return {};
  
  const firstVal = json[keys[0]];
  
  if (firstVal && typeof firstVal === 'object' && 'class_type' in firstVal) {
    // Already API format
    return json as ComfyWorkflow;
  }

  // Check if it's regular format (has "nodes" array)
  // We check for 'nodes' existing and being an array
  if (json.nodes && Array.isArray(json.nodes)) {
    // Flatten subgraphs first (expand group nodes)
    const flattened = expandSubgraphs(json as RegularWorkflow);
    return convertRegularToAPIInternal(flattened);
  }

  // Unknown format — try to use as-is
  console.warn('Unknown ComfyUI workflow format, attempting to use as-is');
  return json as ComfyWorkflow;
}

/**
 * Detects subgraph nodes and expands them into the main workflow.
 * Handles remapping of IDs and links.
 * Ported from SpriteGen-app reference.
 */

function expandSubgraphs(workflow: RegularWorkflow): RegularWorkflow {
  if (!workflow.definitions?.subgraphs || workflow.definitions.subgraphs.length === 0) {
    return workflow;
  }

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // Clone to avoid mutating original
  const main = JSON.parse(JSON.stringify(workflow)) as RegularWorkflow;
  const subgraphs = new Map(main.definitions!.subgraphs!.map(s => [s.id, s]));

  // Track max IDs for generating unique ones (+padding for safety)
  let maxNodeId = main.nodes.reduce((max, n) => Math.max(max, n.id), 0) + 1000;
  let maxLinkId = main.links.reduce((max, l) => Math.max(max, l[0]), 0) + 1000;

  // Link map for quick lookup: linkId -> [fromNode, fromSlot, toNode, toSlot, type]
  // We'll rebuild this as we go
  
  let changed = true;
  let iterations = 0;
  while (changed) {
    if (iterations++ > 100) {
      console.error('[ComfyUIClient] Infinite recursion matching subgraphs? Breaking.');
      break;
    }

    changed = false;
    const newNodes: RegularWorkflowNode[] = [];
    const newLinks = [...main.links];

    let expandedOne = false;

    for (const node of main.nodes) {
      if (!expandedOne && UUID_PATTERN.test(node.type) && subgraphs.has(node.type)) {
        // Found a subgraph node to expand!
        expandedOne = true;
        changed = true;
        const def = subgraphs.get(node.type)!;
        
        // Maps for remapping internal IDs to new unique IDs
        const nodeIdMap = new Map<number, number>();
        const linkIdMap = new Map<number, number>();

        // 1. Instantiate internal nodes
        const internalNodes: RegularWorkflowNode[] = JSON.parse(JSON.stringify(def.nodes));
        internalNodes.forEach(internalNode => {
          // Special Input/Output nodes are "virtual" - we don't add them, we just map their links
          if (internalNode.id !== def.inputNode.id && internalNode.id !== def.outputNode.id) {
             maxNodeId++;
             const newId = maxNodeId;
             nodeIdMap.set(internalNode.id, newId);
             internalNode.id = newId;
             newNodes.push(internalNode);
          }
        });

        // 2. Instantiate internal links
        // We first simply remap IDs to the new node IDs
        def.links.forEach((link: any) => {
          // Normalize link: some workflows use object format for links inside definitions
          let oldLinkId, fromId, fromSlot, toId, toSlot, type;
          
          if (Array.isArray(link)) {
            [oldLinkId, fromId, fromSlot, toId, toSlot, type] = link;
          } else {
            // Object format: { id, origin_id, origin_slot, target_id, target_slot, type }
            oldLinkId = link.id;
            fromId = link.origin_id;
            fromSlot = link.origin_slot;
            toId = link.target_id;
            toSlot = link.target_slot;
            type = link.type;
          }
          
          // If connection involves Input/Output nodes, we handle later
          const fromIsInput = fromId === def.inputNode.id;
          const toIsOutput = toId === def.outputNode.id;
          
          if (!fromIsInput && !toIsOutput) {
             // purely internal link
             maxLinkId++;
             const newLinkId = maxLinkId;
             
             // Ensure we have mappings (orphan check)
             const newFromId = nodeIdMap.get(fromId);
             const newToId = nodeIdMap.get(toId);
             
             if (newFromId !== undefined && newToId !== undefined) {
               linkIdMap.set(oldLinkId, newLinkId);
               newLinks.push([
                 newLinkId,
                 newFromId, fromSlot,
                 newToId, toSlot,
                 type
               ]);
             }
          }
        });

        // 2.5. Update internal node inputs to point to the NEW link IDs
        // This is crucial for nested subgraphs: the node has input.link = OLD_ID,
        // but we just created a new link with NEW_ID. We must update the node to point to NEW_ID.

        newNodes.forEach(n => {
            // Only strictly check nodes we just added (heuristically, ones that have inputs with old IDs)
            // But newNodes contains instantiated nodes from this pass.
            if (n.inputs) {
                n.inputs.forEach(input => {
                    if (input.link && linkIdMap.has(input.link)) {
                        const newLinkId = linkIdMap.get(input.link)!;
                        input.link = newLinkId;
                    }
                });
            }
        });

        // 3. Connect External Inputs to Internal Destinations
        // Subgraph Node inputs (external links) -> Def Inputs -> Internal Nodes
        if (node.inputs) {
          node.inputs.forEach(input => {
             if (input.link) {
               const defInput = def.inputs.find(i => i.name === input.name);
               if (defInput) {
                 // defInput.linkIds contains links starting from InputNode inside subgraph
                 defInput.linkIds.forEach((internalLinkId) => {
                   // Find the internal link definition to know the target
                   // Normalize link check
                   const internalLinkRaw = def.links.find((l: any) => (Array.isArray(l) ? l[0] : l.id) === internalLinkId);
                   if (internalLinkRaw) {
                     // Normalize access
                     let targetIdRaw, targetSlot, type;
                     if (Array.isArray(internalLinkRaw)) {
                       [, , , targetIdRaw, targetSlot, type] = internalLinkRaw;
                     } else {
                       const lObj = internalLinkRaw as any;
                       targetIdRaw = lObj.target_id;
                       targetSlot = lObj.target_slot;
                       type = lObj.type;
                     }

                     const targetNodeId = nodeIdMap.get(targetIdRaw);
                     
                     // Create new link: External Source -> New Target Node
                     const externalLink = main.links.find(l => l[0] === input.link);
                     if (externalLink) {
                        if (targetNodeId !== undefined) {
                            newLinks.push([
                            externalLink[0], // Reuse external link ID
                            externalLink[1], externalLink[2], // From Source
                            targetNodeId, targetSlot, // To Target
                            type
                            ]);
                            
                            // CRITICAL FIX: Update the internal node's input to point to this external link ID
                            const targetNode = newNodes.find(n => n.id === targetNodeId);
                            if (targetNode && targetNode.inputs && targetNode.inputs[targetSlot]) {
                                // console.log(`[ComfyUI] Fixing subgraph input: Node ${targetNode.id} input ${targetSlot} -> Link ${externalLink[0]}`);
                                targetNode.inputs[targetSlot].link = externalLink[0];
                            } else if (targetNode && targetNode.inputs) {
                                // Fallback: Try to find input by old internal link ID? 
                                // This happens when input array order doesn't match slots (rare in Comfy)
                                const inp = targetNode.inputs.find(i => i.link === internalLinkId);
                                if (inp) {
                                    inp.link = externalLink[0];
                                }
                            }
                        }
                     }
                   }
                 });
               }
             }
          });
        }

        // 4. Connect Internal Sources to External Outputs
        // Internal Source -> Def Outputs -> Subgraph Node outputs (external links)
        if (node.outputs) {
           // We need to find external links that START from this node
           const externalLinksFromNode = main.links.filter(l => l[1] === node.id);
           
           externalLinksFromNode.forEach(extLink => {
              const [lId, _sId, sSlot, tId, tSlot, type] = extLink;
              // Which output name does sSlot correspond to?
              const outputDef = node.outputs?.[sSlot];
              if (outputDef) {
                 // Find corresponding subgraph def output
                 const defOutput = def.outputs.find(o => o.name === outputDef.name);
                 if (defOutput && defOutput.linkIds.length > 0) {
                    // There should be a link going TO the OutputNode
                    const internalLinkId = defOutput.linkIds[0];
                    const internalLinkRaw = def.links.find((l: any) => (Array.isArray(l) ? l[0] : l.id) === internalLinkId);
                    
                    if (internalLinkRaw) {
                       let sourceIdRaw, sourceSlot;
                       if (Array.isArray(internalLinkRaw)) {
                         [, sourceIdRaw, sourceSlot] = internalLinkRaw;
                       } else {
                         const lObj = internalLinkRaw as any;
                         sourceIdRaw = lObj.origin_id;
                         sourceSlot = lObj.origin_slot;
                       }

                       const sourceNodeId = nodeIdMap.get(sourceIdRaw);
                       
                       if (sourceNodeId !== undefined) {
                          // Update the external link to point FROM the new internal source
                           const index = newLinks.findIndex(l => l[0] === lId);
                           if (index !== -1) {
                              newLinks[index] = [
                                lId,
                                sourceNodeId, sourceSlot,
                                tId, tSlot,
                                type
                              ];
                           }
                       }
                    }
                 }
              }
           });
        }

      } else {
        newNodes.push(node);
      }
    }
    
    main.nodes = newNodes;
    // main.links = newLinks; // We need to filter dead links?
    // The reference implementation re-filters links based on node existence
    main.links = newLinks.filter(l => {
       const fromExists = newNodes.some(n => n.id === l[1]);
       const toExists = newNodes.some(n => n.id === l[3]);
       return fromExists && toExists;
    });
  }
  
  main.links = main.links.filter(l => {
     const fromExists = main.nodes.some(n => n.id === l[1]);
     const toExists = main.nodes.some(n => n.id === l[3]);
     return fromExists && toExists;
  });

  // Write main.nodes to a debug file


  return main;
}

/**
 * Convert regular ComfyUI workflow format to API format.
 */
function convertRegularToAPIInternal(regular: RegularWorkflow): ComfyWorkflow {
  const api: ComfyWorkflow = {};

  const SKIP_NODE_TYPES = new Set([
    'MarkdownNote', 'Note', 'PrimitiveNode', 'Reroute',
  ]);

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const linkMap = new Map<number, { fromNodeId: number; fromSlot: number }>();
  for (const link of regular.links || []) {
    const [linkId, fromNodeId, fromSlot] = link;
    linkMap.set(linkId, { fromNodeId, fromSlot });
  }

  // Helper to trace back Reroute nodes to find the real source
  function resolveSource(nodeId: number, slot: number): [string, number] | null {
     let currentId = nodeId;
     let currentSlot = slot;
     const seen = new Set<number>();

     while (true) {
        if (seen.has(currentId)) return null; // cycle
        seen.add(currentId);

        const node = regular.nodes.find(n => n.id === currentId);
        if (!node) return null;

        if (!SKIP_NODE_TYPES.has(node.type) && !UUID_PATTERN.test(node.type)) {
           // It's a real node
           return [String(currentId), currentSlot];
        }

        // It's a skipped node (e.g. Reroute)
        // Find input link
        if (node.inputs && node.inputs.length > 0) {
           // Reroutes usually have 1 input, maybe generic name or matches slot?
           // Reroute inputs are often weird. Usually they describe the connection.
           // Let's assume input 0 is what we want for now, or find the link that feeds this node?
           // ACTUALLY, we are tracing BACKWARDS.
           // We are at 'node' (Reroute), we want to know what feeds it.
           // We need to look at its inputs.
           const input = node.inputs[0]; // Reroute has 1 input
           if (input && input.link) {
              const linkInfo = linkMap.get(input.link);
              if (linkInfo) {
                 currentId = linkInfo.fromNodeId;
                 currentSlot = linkInfo.fromSlot;
                 continue;
              }
           }
        }
        return null; // Dead end
     }
  }

  for (const node of regular.nodes) {
    if (SKIP_NODE_TYPES.has(node.type)) continue;
    if (UUID_PATTERN.test(node.type)) continue;

    const inputs: Record<string, any> = {};
    
    // Convert input connections
    if (node.inputs) {
      for (const input of node.inputs) {
        if (input.link != null) {
          const linkInfo = linkMap.get(input.link);
          if (linkInfo) {
            const realSource = resolveSource(linkInfo.fromNodeId, linkInfo.fromSlot);
            if (realSource) {
               inputs[input.name] = realSource;
            }
          }
        }
      }
    }

    // Extract widget values
    if (node.widgets_values && node.widgets_values.length > 0) {
      // Common text nodes
      const textNodeTypes = [
        'CLIPTextEncode', 'CLIPTextEncodeSDXL', 'CLIPTextEncodeFlux',
        'String', 'Text Multiline', 'CR Text',
      ];
      if (textNodeTypes.includes(node.type)) {
        const textVal = node.widgets_values.find(v => typeof v === 'string');
        if (textVal !== undefined) inputs['text'] = textVal;
      }

      // Loader nodes
      const stringVals = node.widgets_values.filter(v => typeof v === 'string');
      // Numbers
      const numVals = node.widgets_values.filter(v => typeof v === 'number');

      if (node.type === 'UnetLoaderGGUF' && stringVals[0]) {
          inputs['unet_name'] = stringVals[0];
      } else if (node.type === 'CLIPLoader' && stringVals.length >= 2) {
          inputs['clip_name'] = stringVals[0];
          inputs['type'] = stringVals[1];
      } else if (node.type === 'VAELoader' && stringVals[0]) {
          inputs['vae_name'] = stringVals[0];
      } else if (node.type === 'CheckpointLoaderSimple' && stringVals[0]) {
          inputs['ckpt_name'] = stringVals[0];
      } else if (node.type === 'LoraLoaderModelOnly' && stringVals[0]) {
          inputs['lora_name'] = stringVals[0];
          if (numVals[0] !== undefined) inputs['strength_model'] = numVals[0];
      } else if (node.type === 'DualCLIPLoaderGGUF' && stringVals.length >= 3) {
          inputs['clip_name1'] = stringVals[0];
          inputs['clip_name2'] = stringVals[1];
          inputs['type'] = stringVals[2];
      }
      
      // Generic fallback: Try to map widget names? 
      // API format usually expects widget values to be mapped to specific input names.
      // But for many nodes, if we don't know the name, we might lose it.
      // However, for standard nodes, the inputs are often enough.
      // Wait, KSampler settings like steps, cfg, seed are WIDGETS. They MUST be mapped.
      
      if (node.type === 'KSamplerSelect' && node.widgets_values[0]) {
         inputs['sampler_name'] = node.widgets_values[0];
      }
      if (node.type === 'RandomNoise') {
         inputs['noise_seed'] = node.widgets_values[0];
      }
      if (node.type === 'Flux2Scheduler') {
          if (numVals[0] !== undefined) inputs['steps'] = numVals[0];
          // width/height might be inputs or widgets depending on config
          if (node.inputs?.find(i => i.name === 'width')?.link) { /* linked */ }
          else if (numVals[1] !== undefined) inputs['width'] = numVals[1];
          
          if (node.inputs?.find(i => i.name === 'height')?.link) { /* linked */ }
          else if (numVals[2] !== undefined) inputs['height'] = numVals[2];
      }
      if (node.type === 'EmptyFlux2LatentImage') {
         // This node often has width, height, batch_size as widgets
         // But checking the file, they seem to be widgets
         if (numVals[0] !== undefined) inputs['width'] = numVals[0];
         if (numVals[1] !== undefined) inputs['height'] = numVals[1];
         if (numVals[2] !== undefined) inputs['batch_size'] = numVals[2];
      }
      if (node.type === 'CFGGuider') {
         if (numVals[0] !== undefined) inputs['cfg'] = numVals[0];
      }
      if (node.type === 'SaveImage' && stringVals[0]) {
         inputs['filename_prefix'] = stringVals[0];
      }
      if (node.type === 'LoadImage') {
        // LoadImage widgets: [image_filename, choose_upload?]
        // The API expects 'image' input to be the filename string
        if (stringVals[0]) inputs['image'] = stringVals[0];
      }
      
      if (node.type === 'ImageScaleToTotalPixels') {
           // widgets: [upscale_method (str), megapixels (float), resolution_steps (int)]
           // We use the raw array by index to be safe about order
           if (node.widgets_values[0] !== undefined) inputs['upscale_method'] = node.widgets_values[0];
           if (node.widgets_values[1] !== undefined) inputs['megapixels'] = node.widgets_values[1];
           if (node.widgets_values[2] !== undefined) inputs['resolution_steps'] = node.widgets_values[2];
      }
      
      if (node.type === 'ImageResizeKJv2') {
           // widgets: [width, height, upscale_method, keep_proportion, pad_color, crop_position, divisible_by, device]
           if (node.widgets_values[0] !== undefined) inputs['width'] = node.widgets_values[0];
           if (node.widgets_values[1] !== undefined) inputs['height'] = node.widgets_values[1];
           if (node.widgets_values[2] !== undefined) inputs['upscale_method'] = node.widgets_values[2];
           if (node.widgets_values[3] !== undefined) inputs['keep_proportion'] = node.widgets_values[3];
           if (node.widgets_values[4] !== undefined) inputs['pad_color'] = node.widgets_values[4];
           if (node.widgets_values[5] !== undefined) inputs['crop_position'] = node.widgets_values[5];
           if (node.widgets_values[6] !== undefined) inputs['divisible_by'] = node.widgets_values[6];
           if (node.widgets_values[7] !== undefined) inputs['device'] = node.widgets_values[7];
      }

      if (node.type === 'SpriteGenInject') {
           // widgets: [prompt (str)]
           if (node.widgets_values[0] !== undefined) inputs['prompt'] = node.widgets_values[0];
      }
    }

    api[String(node.id)] = {
      class_type: node.type,
      inputs,
      _meta: { title: node.title || node.type },
    };
  }
  
  // Extra: UE Links
  if (regular.extra?.ue_links) {
     const ueLinks = regular.extra.ue_links;
     ueLinks.forEach((ue: any) => {
        const targetNodeId = String(ue.downstream);
        const sourceNodeId = Number(ue.upstream); // upstream can be string in JSON, convert to number for lookup
        const targetNode = api[targetNodeId];
        
        if (targetNode) {
           const realSource = resolveSource(sourceNodeId, ue.upstream_slot);
           
           if (realSource) {
                if (targetNode.class_type === 'SaveImage' && ue.downstream_slot === 0) {
                    targetNode.inputs['images'] = realSource;
                }
                else if (ue.type === 'IMAGE' && !targetNode.inputs['image'] && !targetNode.inputs['images']) {
                    // guess
                    if (targetNode.class_type === 'PreviewImage') targetNode.inputs['images'] = realSource;
                    else targetNode.inputs['image'] = realSource;
                }
           }
        }
     });
  }

  return api;
}
