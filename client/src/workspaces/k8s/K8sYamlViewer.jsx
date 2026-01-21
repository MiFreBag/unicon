// client/src/workspaces/k8s/K8sYamlViewer.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, X, Save, Edit2, Download, Maximize2, Minimize2 } from 'lucide-react';

/**
 * K8sYamlViewer - YAML viewer/editor with syntax highlighting
 */
export default function K8sYamlViewer({
  yaml = '',
  resourceName = '',
  resourceType = '',
  namespace = '',
  onApply,
  onClose,
  readOnly = true,
  className = '',
}) {
  const [content, setContent] = useState(yaml);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setContent(yaml);
  }, [yaml]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resourceType}-${resourceName}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleApply = () => {
    if (onApply && content !== yaml) {
      onApply(content);
    }
    setIsEditing(false);
  };

  // Simple YAML syntax highlighting
  const highlightYaml = (text) => {
    return text.split('\n').map((line, i) => {
      let highlighted = line
        // Comments
        .replace(/(#.*)$/, '<span class="text-gray-500">$1</span>')
        // Keys
        .replace(/^(\s*)([a-zA-Z0-9_-]+)(:)/gm, '$1<span class="text-cyan-400">$2</span><span class="text-gray-400">$3</span>')
        // Strings with quotes
        .replace(/"([^"]*)"/g, '<span class="text-green-400">"$1"</span>')
        .replace(/'([^']*)'/g, '<span class="text-green-400">\'$1\'</span>')
        // Booleans
        .replace(/\b(true|false)\b/gi, '<span class="text-yellow-400">$1</span>')
        // Numbers
        .replace(/\b(\d+)\b/g, '<span class="text-purple-400">$1</span>')
        // Special values
        .replace(/\b(null|~)\b/gi, '<span class="text-red-400">$1</span>');
      
      return (
        <div key={i} className="flex">
          <span className="text-gray-600 select-none w-10 text-right pr-3 flex-shrink-0">
            {i + 1}
          </span>
          <span 
            className="flex-1"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      );
    });
  };

  const containerClass = isFullscreen 
    ? 'fixed inset-0 z-50 bg-gray-900' 
    : `${className}`;

  return (
    <div className={`flex flex-col ${containerClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">
            {resourceType}/{resourceName}
          </span>
          {namespace && (
            <span className="text-xs text-gray-500">
              namespace: {namespace}
            </span>
          )}
          {isEditing && (
            <span className="text-xs text-yellow-400 ml-2">• Editing</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {!readOnly && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
          )}
          
          {isEditing && (
            <>
              <button
                onClick={handleApply}
                className="px-2 py-1 text-xs text-green-400 hover:bg-gray-700 rounded flex items-center gap-1"
                title="Apply changes"
              >
                <Save size={12} /> Apply
              </button>
              <button
                onClick={() => { setContent(yaml); setIsEditing(false); }}
                className="px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 rounded"
                title="Cancel"
              >
                Cancel
              </button>
            </>
          )}
          
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          
          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Download YAML"
          >
            <Download size={14} />
          </button>
          
          <button
            onClick={() => setIsFullscreen(f => !f)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded ml-1"
              title="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-900">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-3 bg-gray-900 text-gray-200 font-mono text-xs resize-none focus:outline-none"
            spellCheck={false}
            style={{ tabSize: 2 }}
          />
        ) : (
          <pre className="p-3 font-mono text-xs leading-5 text-gray-200">
            {highlightYaml(content)}
          </pre>
        )}
      </div>
      
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        <span>{content.split('\n').length} lines</span>
        <span>YAML</span>
      </div>
    </div>
  );
}

/**
 * Compact YAML viewer for inline display
 */
export function K8sYamlInline({ yaml = '', maxHeight = '300px' }) {
  const [expanded, setExpanded] = useState(false);
  
  const lines = yaml.split('\n');
  const displayLines = expanded ? lines : lines.slice(0, 20);
  
  return (
    <div className="relative">
      <pre 
        className="p-2 bg-gray-900 rounded text-xs font-mono text-gray-300 overflow-auto"
        style={{ maxHeight: expanded ? 'none' : maxHeight }}
      >
        {displayLines.join('\n')}
      </pre>
      
      {lines.length > 20 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-gray-800 text-gray-400 hover:text-white rounded"
        >
          {expanded ? 'Show less' : `Show all (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}
