// client/src/workspaces/k8s/K8sTerminal.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

/**
 * K8sTerminal - xterm.js based terminal for exec sessions and log viewing
 * 
 * @param {Object} props
 * @param {string} props.connectionId - K8s connection ID
 * @param {string} props.sessionId - Exec session ID (for interactive shell)
 * @param {string} props.logId - Log stream ID (for log viewing)
 * @param {string} props.mode - 'exec' | 'logs'
 * @param {Function} props.onInput - Callback when user types (for exec mode)
 * @param {Function} props.onClose - Callback when terminal is closed
 * @param {string} props.title - Terminal title
 */
export default function K8sTerminal({
  connectionId,
  sessionId,
  logId,
  mode = 'exec',
  onInput,
  onClose,
  title = 'Terminal',
  className = '',
}) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#dcdcaa',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Initial fit
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (_) {}
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input for exec mode
    if (mode === 'exec' && onInput) {
      term.onData((data) => {
        onInput(data);
      });
    }

    // Handle resize
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (_) {}
    };
    window.addEventListener('resize', handleResize);

    // Welcome message
    if (mode === 'logs') {
      term.writeln('\x1b[36m--- Log stream started ---\x1b[0m\r\n');
    } else {
      term.writeln('\x1b[36m--- Terminal session started ---\x1b[0m\r\n');
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [mode, onInput]);

  // Connect to WebSocket for receiving output
  useEffect(() => {
    if (!connectionId) return;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        // Handle exec output
        if (mode === 'exec' && msg.type === 'k8s' && msg.data?.event === 'execOut') {
          if (msg.data.connectionId === connectionId && msg.data.id === sessionId) {
            xtermRef.current?.write(msg.data.data);
          }
        }
        
        // Handle log lines
        if (mode === 'logs' && msg.type === 'k8s' && msg.data?.event === 'logLine') {
          if (msg.data.connectionId === connectionId && msg.data.id === logId) {
            xtermRef.current?.write(msg.data.line);
          }
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      xtermRef.current?.writeln('\x1b[31m--- WebSocket error ---\x1b[0m');
    };

    ws.onclose = () => {
      xtermRef.current?.writeln('\x1b[33m--- Connection closed ---\x1b[0m');
    };

    return () => {
      try { ws.close(); } catch (_) {}
    };
  }, [connectionId, sessionId, logId, mode]);

  // Expose methods to parent
  const write = useCallback((data) => {
    xtermRef.current?.write(data);
  }, []);

  const writeln = useCallback((data) => {
    xtermRef.current?.writeln(data);
  }, []);

  const clear = useCallback(() => {
    xtermRef.current?.clear();
  }, []);

  const fit = useCallback(() => {
    try {
      fitAddonRef.current?.fit();
    } catch (_) {}
  }, []);

  // Expose ref methods
  React.useImperativeHandle(
    React.useRef({ write, writeln, clear, fit }),
    () => ({ write, writeln, clear, fit }),
    [write, writeln, clear, fit]
  );

  return (
    <div className={`flex flex-col bg-[#1e1e1e] rounded overflow-hidden ${className}`}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-[#3d3d3d]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{title}</span>
          {mode === 'exec' && sessionId && (
            <span className="text-xs text-green-400">● Connected</span>
          )}
          {mode === 'logs' && logId && (
            <span className="text-xs text-blue-400">● Streaming</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clear}
            className="text-xs px-2 py-0.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded"
          >
            Clear
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs px-2 py-0.5 text-gray-400 hover:text-red-400 hover:bg-[#3d3d3d] rounded"
            >
              Close
            </button>
          )}
        </div>
      </div>
      
      {/* Terminal content */}
      <div 
        ref={terminalRef} 
        className="flex-1 p-1"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
}

// Lightweight terminal for log viewing only
export function K8sLogViewer({ logs = [], className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <pre 
      ref={containerRef}
      className={`bg-[#1e1e1e] text-[#d4d4d4] text-xs p-2 rounded font-mono overflow-auto ${className}`}
      style={{ minHeight: '200px', maxHeight: '400px' }}
    >
      {logs.length === 0 ? (
        <span className="text-gray-500">No logs yet...</span>
      ) : (
        logs.map((line, i) => (
          <div key={i} className="hover:bg-[#2d2d2d]">
            {line}
          </div>
        ))
      )}
    </pre>
  );
}
