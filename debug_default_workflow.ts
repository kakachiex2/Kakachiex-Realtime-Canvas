
import * as fs from 'fs';
import * as path from 'path';
import { convertWorkflowFormat } from './src/utils/comfyUtils';
import { defaultWorkflow } from './src/defaultWorkflow';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('Running conversion on defaultWorkflow...');
  const result = convertWorkflowFormat(defaultWorkflow);
  
  // Verify connections for ReferenceLatent nodes
  // In defaultWorkflow, ReferenceLatent nodes are inside subgraph 6d71... (which is inside 757e...)
  // We look for nodes with class_type 'ReferenceLatent'
  
  const refLatencies = Object.values(result).filter((n: any) => n.class_type === 'ReferenceLatent');
  console.log(`Found ${refLatencies.length} ReferenceLatent nodes.`);
  
  refLatencies.forEach((node: any, idx) => {
      console.log(`RefLatent [${idx}] Inputs:`, JSON.stringify(node.inputs));
  });

  // Also check CFGGuider (Node 86 in defaultWorkflow, likely remapped)
  const guides = Object.values(result).filter((n: any) => n.class_type === 'CFGGuider');
   console.log(`Found ${guides.length} CFGGuider nodes.`);
   guides.forEach((node: any, idx) => {
       console.log(`CFGGuider [${idx}] Inputs:`, JSON.stringify(node.inputs));
   });

} catch (error) {
  console.error('Error:', error);
}
