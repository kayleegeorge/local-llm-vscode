// import {
//   ParsedEvent,
//   ReconnectInterval,
//   createParser,
// } from 'eventsource-parser';
// import { ModelConfig } from '../utils/modelConfig';

// export class OllamaError extends Error {
//   constructor(message: string) {
//     super(message);
//     this.name = 'OllamaError';
//   }
// }

// // TODO: make this a vscode extension config setting: vscode.workspace.getConfiguration("ollama_server") 
// const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';

// // Ollama stream
// export const OllamaStream = async (
//   modelConfig: ModelConfig,
//   systemPrompt: string,
//   prompt: string,
// ) => {
//   let url = `${DEFAULT_OLLAMA_HOST}/api/generate`;
//   const res = await fetch(url, {
//     headers: {
//       'Accept': 'application/json',
//       'Content-Type': 'application/json',
//       'Cache-Control': 'no-cache',
//       'Pragma': 'no-cache',
//     },
//     method: 'POST',
//     body: JSON.stringify({
//       model: modelConfig["modelID"],
//       prompt: prompt,
//       system: systemPrompt,
//       options: modelConfig["options"]
//     }),
//   });

//   const encoder = new TextEncoder();
//   const decoder = new TextDecoder();

//   if (res.status !== 200) {
//     const result = await res.json();
//     if (result.error) {
//       throw new OllamaError(
//         result.error
//       );
//     } 
//   }

//   const responseStream = new ReadableStream({
//     async start(controller) {
//       try {
//         for await (const chunk of res.body as any) {
//           const text = decoder.decode(chunk); 
//           const parsedData = JSON.parse(text); 
//           if (parsedData.response) {
//             controller.enqueue(encoder.encode(parsedData.response)); 
//           }
//         }
//         controller.close();
//       } catch (e) {
//         controller.error(e);
//       }
//     },
//   });
  
//   return responseStream;
// };