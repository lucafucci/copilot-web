const express = require('express');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Copilot Web UI running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'input') {
        const userPrompt = data.data;
        console.log('Executing copilot with prompt:', userPrompt);
        
        // Execute copilot in non-interactive mode
        const copilotProcess = spawn('/usr/local/bin/copilot', [
          '-p', userPrompt,
          '--allow-all-tools'
        ], {
          env: {
            ...process.env,
            PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            TERM: 'xterm-256color',
            FORCE_COLOR: '1',
            COPILOT_GITHUB_TOKEN: process.env.COPILOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN
          }
        });

        let stdout = '';
        let stderr = '';

        copilotProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          console.log('Copilot stdout:', output);
          ws.send(JSON.stringify({ 
            type: 'output', 
            data: output 
          }));
        });

        copilotProcess.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          stderr += errorOutput;
          console.error('Copilot stderr:', errorOutput);
          
          if (errorOutput.includes('No authentication') || errorOutput.includes('authenticate')) {
            ws.send(JSON.stringify({ 
              type: 'auth_required',
              message: 'Authentication required. Please set a valid GitHub token with Copilot access in the GH_TOKEN environment variable.'
            }));
          } else {
            ws.send(JSON.stringify({ 
              type: 'error', 
              data: errorOutput 
            }));
          }
        });

        copilotProcess.on('close', (code) => {
          console.log(`Copilot process exited with code ${code}`);
          if (code === 0 && stdout.trim()) {
            ws.send(JSON.stringify({ 
              type: 'complete',
              message: 'Response complete'
            }));
          } else if (code !== 0) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              data: `Copilot exited with code ${code}`
            }));
          }
        });

        copilotProcess.on('error', (error) => {
          console.error('Failed to start copilot:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            data: `Failed to start copilot: ${error.message}`
          }));
        });
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log('WebSocket server ready');
