import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import './styles.css';
const router = getRouter();
createRoot(document.getElementById('root')!).render(<RouterProvider router={router}/>);

const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => Promise<void> | void } }).modelContext;
if (context?.registerTool) {
 const lifecycle = new AbortController();
 Promise.resolve(context.registerTool({
  name: 'search_demo_dishes',
  description: 'Open dish search results using the current sample location. Changes the visible page only.',
  inputSchema: {type:'object',properties:{query:{type:'string',maxLength:100}},required:['query'],additionalProperties:false},
  annotations:{readOnlyHint:false},
  async execute(input: unknown) {
   if (!input || typeof input !== 'object' || !('query' in input) || typeof input.query !== 'string' || input.query.length > 100) throw new Error('Provide a query of up to 100 characters.');
   await router.navigate({to:'/explore',search:{q:input.query}});
   return {query:input.query,page:'/explore'};
  }
 }, {signal:lifecycle.signal})).catch(()=>{});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
