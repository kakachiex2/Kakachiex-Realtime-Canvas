
import * as fs from 'fs';
import * as path from 'path';
import { convertWorkflowFormat } from './src/utils/comfyUtils';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workflowPath = path.join(__dirname, 'Workflow', 'Realtime_Flux2_klein_9b.json');
const outputPath = path.join(__dirname, 'debug_nodes_dump.json');

try {
  const workflowContent = fs.readFileSync(workflowPath, 'utf8');
  const workflow = JSON.parse(workflowContent);

  console.log('Running conversion...');
  const result = convertWorkflowFormat(workflow); // This runs expandSubgraphs internally (with my logging)
  
  // Wait a bit for stdout (though file write is better)
  
} catch (error) {
  console.error('Error:', error);
}
