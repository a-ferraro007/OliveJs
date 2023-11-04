/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
 




const d = document.getElementById('root')
if(!d) throw new Error('Document not found')
// Render your React component instead
const root = createRoot(d);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);