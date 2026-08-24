import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../common/Button';

interface SchemaDiffProps {
  oldSchema: string;
  newSchema: string;
  oldLabel?: string;
  newLabel?: string;
  className?: string;
}

interface DiffSection {
  startLine: number;
  endLine: number;
  type: 'added' | 'removed' | 'unchanged';
}

function parseDiffLines(oldContent: string, newContent: string): DiffSection[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const sections: DiffSection[] = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    const oldLine = oldLines[i];
    const newLine = newLines[j];

    if (oldLine === newLine) {
      sections.push({ startLine: i + 1, endLine: i + 1, type: 'unchanged' });
      i++;
      j++;
    } else if (oldLine !== undefined && (newLine === undefined || oldLine !== newLine)) {
      sections.push({ startLine: i + 1, endLine: i + 1, type: 'removed' });
      i++;
    } else {
      sections.push({ startLine: j + 1, endLine: j + 1, type: 'added' });
      j++;
    }
  }

  return sections;
}

export function SchemaDiff({
  oldSchema,
  newSchema,
  oldLabel = 'Old Version',
  newLabel = 'New Version',
  className,
}: SchemaDiffProps) {
  const [activeSide, setActiveSide] = useState<'old' | 'new'>('old');
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const content = activeSide === 'old' ? oldSchema : newSchema;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSection = (sectionIndex: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionIndex)) {
        next.delete(sectionIndex);
      } else {
        next.add(sectionIndex);
      }
      return next;
    });
  };

  const editorOptions = {
    minimap: { enabled: false },
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    readOnly: true,
    fontSize: 13,
    fontFamily: 'monospace',
    renderLineHighlight: 'none' as const,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    scrollbar: {
      vertical: 'hidden' as const,
      horizontal: 'hidden' as const,
    },
  };

  const getEditorTheme = (type: 'old' | 'new') => ({
    base: 'vs-dark' as const,
    inherit: true,
    rules: [
      { token: '', foreground: 'e0e0e0', background: '000000' },
      { token: 'comment', foreground: '6a9955' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'keyword', foreground: '569cd6' },
    ],
    colors: {
      'editor.background': type === 'old' ? '#000000' : '#050505',
      'editor.foreground': '#e0e0e0',
      'editor.lineHighlightBackground': '#0a0a0a',
    },
  });

  const diffSections = parseDiffLines(oldSchema, newSchema);
  const groupedSections: { type: 'added' | 'removed' | 'unchanged'; lines: number[] }[] = [];
  let currentGroup: { type: 'added' | 'removed' | 'unchanged'; lines: number[] } | null = null;

  diffSections.forEach((section) => {
    if (!currentGroup || currentGroup.type !== section.type) {
      if (currentGroup) groupedSections.push(currentGroup);
      currentGroup = { type: section.type, lines: [section.startLine] };
    } else {
      currentGroup.lines.push(section.startLine);
    }
  });
  if (currentGroup) groupedSections.push(currentGroup);

  return (
    <div className={cn('rounded-xl border border-white/[0.06] bg-black overflow-hidden', className)}>
      <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSide('old')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              activeSide === 'old'
                ? 'bg-primary-500/12 text-primary-400'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            {oldLabel}
          </button>
          <button
            onClick={() => setActiveSide('new')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              activeSide === 'new'
                ? 'bg-primary-500/12 text-primary-400'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            {newLabel}
          </button>
        </div>
        <Button variant="ghost" size="sm" leftIcon={<Copy className="w-3 h-3" />} onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Editor
              height="400px"
              language="json"
              value={activeSide === 'old' ? oldSchema : newSchema}
              options={editorOptions}
              theme="schema-diff"
              beforeMount={(monaco) => {
                monaco.editor.defineTheme('schema-diff', getEditorTheme(activeSide));
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="p-3">
          <p className="text-xs text-white/40 mb-2">Changes Summary</p>
          <div className="flex flex-wrap gap-2">
            {groupedSections.map((group, idx) => {
              const isExpanded = expandedSections.has(idx);
              return (
                <div key={idx}>
                  <button
                    onClick={() => toggleSection(idx)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded text-xs',
                      group.type === 'added' && 'bg-primary-500/8 text-primary-400',
                      group.type === 'removed' && 'bg-red-500/8 text-red-400',
                      group.type === 'unchanged' && 'bg-white/5 text-white/40'
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    {group.type === 'added' && `+${group.lines.length} added`}
                    {group.type === 'removed' && `-${group.lines.length} removed`}
                    {group.type === 'unchanged' && `${group.lines.length} unchanged`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
