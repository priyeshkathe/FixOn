import MonacoEditor from '@monaco-editor/react';
import { AlertTriangle, Bookmark, Code, Cpu, Download, FileCode, FileText, FolderOpen, Plus, RefreshCcw, Search, Shield, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppTerminal from '../components/AppTerminal';
import { requestApi } from '../lib/api';

const fileTypeIcon = (name) => {
  if (name.endsWith('.sh')) return 'shell';
  if (name.endsWith('.py')) return 'python';
  if (name.endsWith('.js')) return 'javascript';
  if (name.endsWith('.md')) return 'markdown';
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';
  return 'file';
};

const findNode = (nodes, path) => {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.type === 'folder') {
      const match = findNode(node.children, path);
      if (match) return match;
    }
  }
  return null;
};

const updateTree = (nodes, path, updater) => {
  return nodes.map((node) => {
    if (node.path === path) {
      return updater(node);
    }
    if (node.type === 'folder') {
      return { ...node, children: updateTree(node.children, path, updater) };
    }
    return node;
  });
};

const deleteNode = (nodes, path) => {
  return nodes
    .filter((node) => node.path !== path)
    .map((node) => {
      if (node.type === 'folder') {
        return { ...node, children: deleteNode(node.children, path) };
      }
      return node;
    });
};

const updateDescendantPaths = (nodes, oldPrefix, newPrefix) => {
  return nodes.map((node) => {
    const updatedPath = node.path.replace(oldPrefix, newPrefix);
    if (node.type === 'folder') {
      return {
        ...node,
        path: updatedPath,
        name: node.name,
        children: updateDescendantPaths(node.children, oldPrefix, newPrefix),
      };
    }
    return { ...node, path: updatedPath, name: node.name };
  });
};

const renameEntity = (nodes, path, newName) => {
  return nodes.map((node) => {
    if (node.path === path) {
      const basePath = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      const newPath = `${basePath}${newName}`;
      if (node.type === 'folder') {
        return {
          ...node,
          name: newName,
          path: newPath,
          children: updateDescendantPaths(node.children, `${path}/`, `${newPath}/`),
        };
      }
      return { ...node, name: newName, path: newPath };
    }
    if (node.type === 'folder') {
      return { ...node, children: renameEntity(node.children, path, newName) };
    }
    return node;
  });
};

const duplicateNode = (nodes, path) => {
  const cloneNode = (node, suffix) => {
    const copy = {
      ...node,
      id: `${node.id}-${Date.now()}`,
      name: `${node.name.replace(/\.(?=[^.]+$)/, `${suffix}.`)}`,
      path: node.path.replace(/([^/]+)$/,'$1').replace(node.name, `${node.name.replace(/\.(?=[^.]+$)/, `${suffix}.`)}`),
    };
    if (node.type === 'folder') {
      copy.children = node.children.map((child) => cloneNode(child, suffix));
    }
    return copy;
  };

  let duplicated = false;
  const newTree = nodes.flatMap((node) => {
    if (node.path === path) {
      duplicated = true;
      return [node, cloneNode(node, '-copy')];
    }
    if (node.type === 'folder') {
      const updatedChildren = duplicateNode(node.children, path);
      return [{ ...node, children: updatedChildren }];
    }
    return [node];
  });

  return duplicated ? newTree : nodes;
};

const filterTree = (nodes, query) => {
  if (!query) return nodes;
  return nodes
    .map((node) => {
      if (node.type === 'folder') {
        const children = filterTree(node.children, query);
        if (children.length > 0 || node.name.toLowerCase().includes(query.toLowerCase())) {
          return { ...node, children, open: true };
        }
        return null;
      }
      if (node.name.toLowerCase().includes(query.toLowerCase())) return node;
      return null;
    })
    .filter(Boolean);
};

const createNewFile = (name, content = '', language = 'shell') => ({
  id: `${name}-${Date.now()}`,
  type: 'file',
  name,
  path: name,
  language,
  content,
});

const inferLanguage = (name = '') => {
  if (name.endsWith('.py')) return 'python';
  if (name.endsWith('.js')) return 'javascript';
  if (name.endsWith('.md')) return 'markdown';
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';
  return 'shell';
};

const prepareTree = (node, depth = 0) => {
  if (!node) return null;
  if (node.type === 'folder') {
    return {
      ...node,
      open: depth < 2,
      children: (node.children || []).map((child) => prepareTree(child, depth + 1)).filter(Boolean),
    };
  }

  return {
    ...node,
    language: inferLanguage(node.name),
  };
};

const findFileByName = (nodes, fileName) => {
  for (const node of nodes) {
    if (node.type === 'file' && node.name === fileName) return node;
    if (node.type === 'folder') {
      const match = findFileByName(node.children || [], fileName);
      if (match) return match;
    }
  }
  return null;
};

const findFirstFile = (nodes) => {
  for (const node of nodes) {
    if (node.type === 'file') return node;
    if (node.type === 'folder') {
      const match = findFirstFile(node.children || []);
      if (match) return match;
    }
  }
  return null;
};

const flattenFilePaths = (nodes, acc = []) => {
  for (const node of nodes) {
    if (node.type === 'file') {
      acc.push(node.path);
    } else if (node.type === 'folder') {
      flattenFilePaths(node.children || [], acc);
    }
  }
  return acc;
};

const ScriptRepo = () => {
  const location = useLocation();
  const queryScriptName = new URLSearchParams(location.search).get('open') || '';
  const preferredScriptName = location.state?.openScript || queryScriptName || localStorage.getItem('unifix_last_saved_script') || '';
  const [repo, setRepo] = useState([]);
  const [workspaceDir, setWorkspaceDir] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [editorValue, setEditorValue] = useState('');
  const [activeTab, setActiveTab] = useState('code');
  const [logs, setLogs] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalSearch, setInternalSearch] = useState('');
  const [terminalStatus, setTerminalStatus] = useState('idle');
  const [isLoadingRepo, setIsLoadingRepo] = useState(true);
  const [terminalSession, setTerminalSession] = useState(null);
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [useElevated, setUseElevated] = useState(false);
  const terminalStatusRef = useRef(terminalStatus);

  useEffect(() => {
    terminalStatusRef.current = terminalStatus;
  }, [terminalStatus]);
  const [terminalError, setTerminalError] = useState('');
  const [validationState, setValidationState] = useState({ status: 'idle', message: '' });
  const [aiDebugFeedback, setAiDebugFeedback] = useState('');
  const [isApplyingAiFix, setIsApplyingAiFix] = useState(false);
  const [runtimeArgs, setRuntimeArgs] = useState('');
  const [autoRunTriggered, setAutoRunTriggered] = useState(false);
  const uploadRef = useRef(null);
  const selectedPathRef = useRef('');
  const reloadTimerRef = useRef(null);
  const handleRunScriptRef = useRef(() => {});

  const selectedFile = useMemo(() => findNode(repo, selectedPath), [repo, selectedPath]);
  const isExecutionBusy = ['starting', 'running', 'stopping', 'restarting'].includes(terminalStatus);
  const isRepoActionLocked = isExecutionBusy || isBatchTesting || isLoadingRepo;

  useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);

  const isSudoRequired = useMemo(() => {
    if (!editorValue) return false;
    const elevatedKeywords = ['sudo ', 'apt-get ', 'apt ', 'yum ', 'dnf ', 'brew install ', 'pacman ', 'systemctl ', 'service '];
    return elevatedKeywords.some(keyword => editorValue.toLowerCase().includes(keyword));
  }, [editorValue]);

  useEffect(() => {
    if (isSudoRequired && !useElevated) {
      setUseElevated(true);
    }
  }, [isSudoRequired, useElevated]);

  const filteredRepo = useMemo(() => filterTree(repo, searchQuery), [repo, searchQuery]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('unifix_terminal_history');
      if (savedHistory) {
        setExecutionHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Failed to restore terminal history', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('unifix_terminal_history', JSON.stringify(executionHistory.slice(0, 20)));
  }, [executionHistory]);

  const loadRepo = async (preferredName) => {
    setIsLoadingRepo(true);

    try {
      let nextRepo = [];
      let workspacePath = '';

      if (window.electronAPI) {
        const repoResult = await window.electronAPI.listRepo();
        workspacePath = repoResult.workspaceDir || repoResult.scriptsDir || '';
        nextRepo = prepareTree(repoResult.tree)?.children || [];
      } else {
        const response = await requestApi({ method: 'get', url: '/scripts' });
        const files = (response.data || []).map((script) => ({
          name: script.name || `${script._id || Date.now()}.sh`,
          type: 'file',
          path: script.name || `${script._id || Date.now()}.sh`,
          extension: script.extension || '',
          absolutePath: script.storagePath || '',
          createdAt: script.createdAt,
          updatedAt: script.updatedAt,
          content: script.content || script.description || '# Script content is not available in browser mode.\n',
          language: inferLanguage(script.name || ''),
        }));
        nextRepo = files;
      }

      setRepo(nextRepo);
      setWorkspaceDir(workspacePath);

      const requestedNode = preferredName
        ? findNode(nextRepo, preferredName) || findFileByName(nextRepo, preferredName)
        : null;
      const fallbackNode = requestedNode || findFirstFile(nextRepo);
      const initialPath = fallbackNode?.path || '';
      setSelectedPath(initialPath);
      if (requestedNode?.name || fallbackNode?.name) {
        const nextName = requestedNode?.name || fallbackNode?.name;
        localStorage.setItem('unifix_last_saved_script', nextName);
      }
      if (fallbackNode?.type === 'file') {
        if (window.electronAPI?.readRepoFile) {
          const readResult = await window.electronAPI.readRepoFile(fallbackNode.absolutePath || fallbackNode.path);
          setEditorValue(readResult.content || '');
        } else {
          setEditorValue(fallbackNode.content || '');
        }
      } else {
        setEditorValue('');
      }
      setLogs([]);
      setTerminalSession(null);
      setTerminalStatus('idle');
      setTerminalError('');
      setValidationState({ status: 'idle', message: '' });
      setAiDebugFeedback('');
    } catch (error) {
      console.error('Failed to load real repository data', error);
      setRepo([]);
      setSelectedPath('');
      setEditorValue('');
      setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: 'Failed to load repository data' }, ...prev]);
    } finally {
      setIsLoadingRepo(false);
    }
  };

  useEffect(() => {
    loadRepo(preferredScriptName);
  }, [preferredScriptName]);

  useEffect(() => {
    const handleScriptSaved = (e) => {
      const savedName = e.detail?.name || '';
      loadRepo(savedName);
    };

    window.addEventListener('unifix-script-saved', handleScriptSaved);
    window.addEventListener('unifix-script-automated-save', handleScriptSaved);
    return () => {
      window.removeEventListener('unifix-script-saved', handleScriptSaved);
      window.removeEventListener('unifix-script-automated-save', handleScriptSaved);
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onRepoEvent) {
      return undefined;
    }

    return window.electronAPI.onRepoEvent(() => {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        loadRepo(selectedPathRef.current || preferredScriptName);
      }, 180);
    });
  }, [preferredScriptName]);

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const shouldRun = new URLSearchParams(location.search).get('run') === 'true';
    if (shouldRun && !isLoadingRepo && selectedFile && !autoRunTriggered) {
      setAutoRunTriggered(true);
      setTimeout(() => {
        handleRunScriptRef.current();
      }, 500);
    }
  }, [location.search, isLoadingRepo, selectedFile, autoRunTriggered]);

  useEffect(() => {
    if (!window.electronAPI?.onTerminalEvent) {
      return undefined;
    }

    return window.electronAPI.onTerminalEvent((event) => {
      if (event.type === 'started') {
        setTerminalSession({ runId: event.runId, scriptPath: event.scriptPath });
        setTerminalStatus('running');
        setTerminalError('');
        setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Started ${event.scriptPath}` }, ...prev]);
        return;
      }

      if (event.type === 'stderr') {
        setTerminalError(event.data?.trim() || 'Runtime error');
        setAiDebugFeedback('');
        return;
      }

      if (event.type === 'error') {
        setTerminalStatus('error');
        setTerminalError(event.data || 'Process crashed');
        setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Process error: ${event.data}` }, ...prev]);
        return;
      }

      if (event.type === 'exit') {
        const finalStatus = event.exitCode === 0 ? 'completed' : event.reason === 'timeout' ? 'timeout' : 'failed';
        setTerminalStatus(finalStatus);
        setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: event.data }, ...prev]);
        setExecutionHistory((prev) => [
          {
            id: Date.now(),
            file: selectedFile?.name || event.scriptPath?.split('/').pop() || 'script',
            status: finalStatus,
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
      }
    });
  }, [selectedFile?.name]);

  const handleFileClick = async (path) => {
    const node = findNode(repo, path);
    if (!node || node.type !== 'file') return;
    setSelectedPath(path);
    if (window.electronAPI?.readRepoFile) {
      try {
        const result = await window.electronAPI.readRepoFile(node.absolutePath || node.path);
        setEditorValue(result.content || '');
      } catch (error) {
        setTerminalError(error?.message || 'Failed to open file');
        setEditorValue('');
      }
    } else {
      setEditorValue(node.content || '');
    }
    localStorage.setItem('unifix_last_saved_script', node.name);
    setRecentFiles((prev) => [path, ...prev.filter((item) => item !== path)].slice(0, 6));
    setActiveTab('code');
  };

  const toggleFolder = (path) => {
    setRepo((prev) => updateTree(prev, path, (node) => ({ ...node, open: !node.open })));
  };

  const handleSaveContent = async () => {
    if (!selectedFile) return;
    setRepo((prev) => updateTree(prev, selectedPath, (node) => ({ ...node, content: editorValue })));

    try {
      if (window.electronAPI) {
        if (selectedFile.absolutePath && window.electronAPI.writeScript) {
          const writeResult = await window.electronAPI.writeScript(selectedFile.absolutePath, editorValue);
          if (!writeResult?.success) {
            throw new Error(writeResult?.error || 'Failed to save script');
          }
        } else {
          const saveResult = await window.electronAPI.saveScript(selectedFile.name, editorValue, { preferWorkspace: true });
          if (!saveResult?.success) {
            throw new Error(saveResult?.error || 'Failed to save script');
          }
          await loadRepo(saveResult.path?.split('/').pop() || selectedFile.name);
        }
      }

      setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Saved ${selectedFile.name}` }, ...prev]);
    } catch (error) {
      setTerminalError(error?.message || 'Save failed');
      setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Save failed for ${selectedFile.name}` }, ...prev]);
    }
  };

  const runValidation = async (scriptPathOrName) => {
    if (!window.electronAPI?.validateScript) {
      return { success: true, supported: false, message: 'Validation is only available in Electron.' };
    }

    setValidationState({ status: 'running', message: 'Checking syntax...' });
    const result = await window.electronAPI.validateScript(scriptPathOrName);

    if (!result?.supported) {
      setValidationState({ status: 'idle', message: result?.message || 'Validation is not available for this file type.' });
      return result;
    }

    if (result?.success) {
      setValidationState({ status: 'success', message: 'Syntax check passed.' });
      return result;
    }

    const message = result?.stderr?.trim() || result?.error || 'Validation failed.';
    setValidationState({ status: 'error', message });
    setTerminalError(message);
    return result;
  };

  const syncSelectedFileToDisk = async () => {
    if (!selectedFile) return;

    if (!window.electronAPI) {
      throw new Error('Interactive terminal is available only in the Electron desktop app.');
    }

    let executablePath = selectedFile.absolutePath || selectedFile.name;
    if (window.electronAPI.writeScript && selectedFile.absolutePath) {
      const writeResult = await window.electronAPI.writeScript(selectedFile.absolutePath, editorValue);
      if (!writeResult?.success) {
        throw new Error(writeResult?.error || 'Failed to update script before execution.');
      }
      executablePath = writeResult.path || executablePath;
    } else {
      const saveResult = await window.electronAPI.saveScript(selectedFile.name, editorValue, { preferWorkspace: true });
      if (!saveResult?.success) {
        throw new Error(saveResult?.error || 'Failed to save script before execution.');
      }
      executablePath = saveResult.path || executablePath;
      await loadRepo(executablePath.split('/').pop());
    }

    return executablePath;
  };

  const handleRunScript = async () => {
    if (!selectedFile || isExecutionBusy) return;

    try {
      setActiveTab('output');
      setTerminalStatus('starting');
      setTerminalError('');
      setAiDebugFeedback('');
      const executablePath = await syncSelectedFileToDisk();
      const validation = await runValidation(executablePath);
      if (validation?.supported && !validation?.success) {
        throw new Error(validation.stderr || validation.error || 'Syntax validation failed.');
      }
      const result = await window.electronAPI.startTerminalSession(executablePath, { 
        timeoutMs: 300000,
        elevated: useElevated,
        runtimeArgs: runtimeArgs.trim() ? runtimeArgs.trim().split(/\s+/) : []
      });
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to start terminal session.');
      }
      setTerminalSession({ runId: result.runId, scriptPath: executablePath });
    } catch (error) {
      const errorMessage = error?.message || 'Execution failed unexpectedly.';
      setTerminalStatus('error');
      setTerminalError(errorMessage);
      setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Execution failed for ${selectedFile.name}` }, ...prev]);
    }
  };

  useEffect(() => {
    handleRunScriptRef.current = handleRunScript;
  });

  const handleValidateScript = async () => {
    if (!selectedFile) return;

    try {
      const executablePath = await syncSelectedFileToDisk();
      await runValidation(executablePath);
    } catch (error) {
      setValidationState({ status: 'error', message: error?.message || 'Validation failed.' });
    }
  };

  const handleStopScript = async () => {
    if (!terminalSession?.runId || !window.electronAPI?.stopTerminalSession) return;
    await window.electronAPI.stopTerminalSession(terminalSession.runId);
    setTerminalStatus('stopping');
  };

  const handleRestartScript = async () => {
    if (!terminalSession?.runId || !window.electronAPI?.restartTerminalSession) return;
    setTerminalStatus('restarting');
    setTerminalError('');
    const result = await window.electronAPI.restartTerminalSession(terminalSession.runId);
    if (!result?.success) {
      setTerminalStatus('error');
      setTerminalError(result?.error || 'Restart failed');
      return;
    }
    setTerminalSession({ runId: result.runId, scriptPath: result.scriptPath });
  };

  const handleSelectWorkspace = async () => {
    if (!window.electronAPI?.selectWorkspace) return;

    try {
      const result = await window.electronAPI.selectWorkspace();
      if (!result?.success || result.canceled) {
        return;
      }
      await loadRepo(preferredScriptName);
      setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Workspace changed to ${result.scriptsDir || result.workspaceDir}` }, ...prev]);
    } catch (error) {
      setTerminalError(error?.message || 'Failed to switch workspace');
    }
  };

  const handleAiFix = async () => {
    if (!selectedFile || !terminalError) return;

    try {
      setIsApplyingAiFix(true);
      const debugResult = await requestApi({
        method: 'post',
        url: '/ai/debug',
        data: { stderr: terminalError },
      });
      setAiDebugFeedback(debugResult.data.feedback || '');

      const looksLikeShell = (() => {
        const firstLine = (editorValue || '').split('\n')[0]?.trim() || '';
        if (firstLine.startsWith('#!') && (firstLine.includes('bash') || firstLine.includes('/sh'))) return true;
        const lower = (editorValue || '').toLowerCase();
        return lower.includes('set -e') || lower.includes('uname -s') || lower.includes('sudo ') || lower.includes('#!/bin/bash');
      })();

      if (!looksLikeShell) {
        setAiDebugFeedback((prev) => `${prev}\n\nNote: AI Fix currently supports shell scripts only. Rename/convert this file to .sh first.`);
        return;
      }

      const enhanceResult = await requestApi({
        method: 'post',
        url: '/ai/enhance-script',
        data: { scriptContent: editorValue },
      });

      if (enhanceResult.data.script) {
        setEditorValue(enhanceResult.data.script);
        setActiveTab('code');
        setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Applied AI fix to ${selectedFile.name}` }, ...prev]);
      }
    } catch (error) {
      setAiDebugFeedback(error?.message || 'AI fix failed.');
    } finally {
      setIsApplyingAiFix(false);
    }
  };

  const handleRename = () => {
    if (!selectedFile) return;
    const newName = window.prompt('Rename file', selectedFile.name);
    if (!newName || newName === selectedFile.name) return;
    if (!window.electronAPI?.renameScript) {
      setRepo((prev) => renameEntity(prev, selectedPath, newName));
      setSelectedPath((prev) => `${prev.includes('/') ? prev.slice(0, prev.lastIndexOf('/') + 1) : ''}${newName}`);
      return;
    }

    window.electronAPI.renameScript(selectedFile.absolutePath || selectedFile.name, newName)
      .then(async (result) => {
        if (!result?.success) {
          throw new Error(result?.error || 'Rename failed');
        }
        const nextName = result.meta?.name || newName;
        await loadRepo(nextName);
        setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Renamed ${selectedFile.name} to ${nextName}` }, ...prev]);
      })
      .catch((error) => {
        setTerminalError(error?.message || 'Rename failed');
      });
  };

  const handleDelete = () => {
    if (!selectedFile) return;
    if (!window.confirm(`Delete ${selectedFile.name}?`)) return;
    if (!window.electronAPI?.deleteScript) {
      setRepo((prev) => deleteNode(prev, selectedPath));
      setSelectedPath('');
      setEditorValue('');
      return;
    }

    window.electronAPI.deleteScript(selectedFile.absolutePath || selectedFile.name)
      .then(async (result) => {
        if (!result?.success) {
          throw new Error(result?.error || 'Delete failed');
        }
        const nextPath = flattenFilePaths(repo).find((path) => path !== selectedPath) || '';
        await loadRepo(nextPath);
        setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Deleted ${selectedFile.name}` }, ...prev]);
      })
      .catch((error) => {
        setTerminalError(error?.message || 'Delete failed');
      });
  };

  const handleDuplicate = () => {
    if (!selectedFile) return;
    if (!window.electronAPI?.duplicateScript) {
      setRepo((prev) => duplicateNode(prev, selectedPath));
      return;
    }

    window.electronAPI.duplicateScript(selectedFile.absolutePath || selectedFile.name)
      .then(async (result) => {
        if (!result?.success) {
          throw new Error(result?.error || 'Duplicate failed');
        }
        const nextName = result.meta?.name || '';
        await loadRepo(nextName);
        setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Duplicated ${selectedFile.name}` }, ...prev]);
      })
      .catch((error) => {
        setTerminalError(error?.message || 'Duplicate failed');
      });
  };

  const handleExport = () => {
    if (!selectedFile || !window.electronAPI?.exportScript) return;
    
    window.electronAPI.exportScript(selectedFile.absolutePath || selectedFile.name, editorValue)
      .then((result) => {
        if (result?.success) {
          setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Exported ${selectedFile.name} to ${result.path}` }, ...prev]);
        } else if (!result?.canceled) {
          setTerminalError(result?.error || 'Export failed');
        }
      })
      .catch((error) => {
        setTerminalError(error?.message || 'Export failed');
      });
  };

  const handleNewFile = async () => {
    const name = window.prompt('New file name', 'new-script.sh');
    if (!name) return;
    const existing = findNode(repo, name);
    if (existing) {
      alert('A file with that name already exists.');
      return;
    }
    const language = name.endsWith('.py') ? 'python' : name.endsWith('.js') ? 'javascript' : name.endsWith('.md') ? 'markdown' : 'shell';
    const newFile = createNewFile(name, `# New ${name}\n`, language);
    if (!window.electronAPI?.createScript) {
      setRepo((prev) => [...prev, newFile]);
      setSelectedPath(name);
      setEditorValue(newFile.content);
      return;
    }

    try {
      const result = await window.electronAPI.createScript(name, newFile.content, { preferWorkspace: true });
      if (!result?.success) {
        throw new Error(result?.error || 'Create failed');
      }
      await loadRepo(result.meta?.name || name);
      setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Created ${result.meta?.name || name}` }, ...prev]);
    } catch (error) {
      setTerminalError(error?.message || 'Create failed');
    }
  };

  const handleUploadScript = () => {
    uploadRef.current?.click();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const name = file.name;
    const language = name.endsWith('.py') ? 'python' : name.endsWith('.js') ? 'javascript' : name.endsWith('.md') ? 'markdown' : 'shell';
    const newFile = createNewFile(name, text, language);
    if (!window.electronAPI?.createScript) {
      setRepo((prev) => [...prev, newFile]);
      setSelectedPath(name);
      setEditorValue(newFile.content);
      setRecentFiles((prev) => [name, ...prev.filter((item) => item !== name)].slice(0, 6));
      event.target.value = null;
      return;
    }

    try {
      const result = await window.electronAPI.createScript(name, text, { preferWorkspace: true });
      if (!result?.success) {
        throw new Error(result?.error || 'Upload failed');
      }
      const nextName = result.meta?.name || name;
      await loadRepo(nextName);
      setRecentFiles((prev) => [nextName, ...prev.filter((item) => item !== nextName)].slice(0, 6));
      setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: `Imported ${nextName}` }, ...prev]);
    } catch (error) {
      setTerminalError(error?.message || 'Upload failed');
    }
    event.target.value = null;
  };

  const runBatchTest = async () => {
    if (isBatchTesting || isExecutionBusy) return;
    setIsBatchTesting(true);
    setTestResults([]);
    
    const allScripts = [];
    const flatten = (nodes) => {
      nodes.forEach(node => {
        if (node.type === 'file' && ['.sh', '.py', '.js', '.ps1'].includes(node.extension)) {
          allScripts.push(node);
        } else if (node.children) {
          flatten(node.children);
        }
      });
    };
    flatten(repo);

    const report = [];
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), event: `Starting batch test for ${allScripts.length} scripts...` }, ...prev]);

    for (let i = 0; i < allScripts.length; i++) {
      const script = allScripts[i];
      setLogs(prev => [{ time: new Date().toLocaleTimeString(), event: `Testing (${i+1}/${allScripts.length}): ${script.name}` }, ...prev]);
      
      await handleFileClick(script.path);
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      await handleRunScriptRef.current();
      
      // Wait for execution to finish (max 30s)
      let timeout = 0;
      while ((terminalStatusRef.current === 'running' || terminalStatusRef.current === 'starting') && timeout < 60) {
        await new Promise(r => setTimeout(r, 500));
        timeout++;
      }
      
      report.push({
        name: script.name,
        path: script.path,
        status: terminalStatusRef.current,
        timestamp: new Date().toISOString()
      });
      
      if (terminalStatusRef.current === 'running') {
        await handleStopScript();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setIsBatchTesting(false);
    setTestResults(report);
    
    if (window.electronAPI?.writeScript) {
      await window.electronAPI.writeScript('test_report.json', JSON.stringify(report, null, 2));
      setLogs(prev => [{ time: new Date().toLocaleTimeString(), event: 'Batch test complete. Report saved to test_report.json' }, ...prev]);
    }
  };

  const handleBackup = () => {
    const backupPayload = {
      generatedAt: new Date().toISOString(),
      files: repo,
    };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script-repo-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), event: 'Repository snapshot exported' }, ...prev]);
  };

  const renderTree = (nodes, depth = 0) => {
    return nodes.map((node) => {
      if (node.type === 'folder') {
        return (
          <div key={node.path} className="space-y-1">
            <button
              type="button"
              onClick={() => toggleFolder(node.path)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 transition-all"
              style={{ paddingLeft: `${depth * 14 + 16}px` }}
            >
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-sky-300" />
                <span>{node.name}</span>
              </div>
              <span className="text-[10px] text-slate-500">{node.children.length}</span>
            </button>
            {node.open && <div className="space-y-1">{renderTree(node.children, depth + 1)}</div>}
          </div>
        );
      }

      const isActive = selectedPath === node.path;
      return (
        <button
          type="button"
          key={node.path}
          onClick={() => handleFileClick(node.path)}
          className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-left transition-all ${
            isActive ? 'bg-sky-500/15 text-sky-200 shadow-lg shadow-sky-500/10' : 'text-slate-300 hover:bg-white/5'
          }`}
          style={{ paddingLeft: `${depth * 14 + 28}px` }}
        >
          <FileText size={16} className={isActive ? 'text-sky-300' : 'text-slate-500'} />
          <span className="truncate">{node.name}</span>
        </button>
      );
    });
  };

  const activeLanguage = selectedFile?.language || 'shell';
  const editorHeight = selectedFile ? 'calc(100vh - 380px)' : '400px';

  return (
    <div className="min-h-screen">
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3 flex flex-col gap-6">
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Scripts Directory</h2>
                <p className="mt-1 text-xs text-slate-500">Browse files and folders inside the main scripts directory</p>
                {workspaceDir ? (
                  <p className="mt-2 break-all text-[11px] text-slate-500">{workspaceDir}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {window.electronAPI?.selectWorkspace ? (
                  <button onClick={handleSelectWorkspace} className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors">
                    Workspace
                  </button>
                ) : null}
                <button onClick={() => loadRepo(preferredScriptName)} className="p-2 rounded-2xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"><RefreshCcw size={16} /></button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Search size={16} className="text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500/30 focus:bg-white/10"
              />
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 pb-1 custom-scrollbar">
              {isLoadingRepo ? (
                <div className="rounded-3xl border border-dashed border-slate-700 bg-white/5 p-6 text-center text-slate-500">
                  Loading real repository data...
                </div>
              ) : filteredRepo.length > 0 ? renderTree(filteredRepo) : (
                <div className="rounded-3xl border border-dashed border-slate-700 bg-white/5 p-6 text-center text-slate-500">
                  No real scripts found yet.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button onClick={handleNewFile} className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500/20 text-sky-200 px-4 py-3 text-sm font-semibold hover:bg-sky-500/30 transition-all">
                <Plus size={16} /> New File
              </button>
              <button onClick={handleUploadScript} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:border-sky-500/30 hover:bg-white/10 transition-all">
                <Upload size={16} /> Upload Script
              </button>
              <input ref={uploadRef} type="file" accept=".sh,.js,.py,.md,.yml,.yaml,.txt" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Recent Files</h3>
              <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{recentFiles.length}</span>
            </div>
            <div className="space-y-2">
              {recentFiles.length ? recentFiles.slice(0, 5).map((path) => (
                <button key={path} onClick={() => handleFileClick(path)} className="w-full text-left rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10 transition-all">
                  {path}
                </button>
              )) : (
                <p className="text-xs leading-relaxed text-slate-500">Open files appear here as you work.</p>
              )}
            </div>
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-9 flex flex-col gap-6 min-h-[80vh]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Script Repository</h1>
                <p className="text-sm text-slate-400 mt-2">A developer workspace for scripts, runtime logs, and repo actions.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:flex 2xl:flex-wrap">
                <button onClick={() => loadRepo(preferredScriptName)} className="btn px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition-all text-sm font-semibold gap-2 inline-flex items-center">
                  <RefreshCcw size={16} /> Refresh
                </button>
                <button 
                  onClick={runBatchTest} 
                  disabled={isBatchTesting || isExecutionBusy || !repo.length}
                  className={`btn px-4 py-3 rounded-2xl border text-sm font-semibold gap-2 inline-flex items-center transition-all ${
                    isBatchTesting || isExecutionBusy
                      ? 'bg-violet-500/10 border-violet-500/30 text-violet-300 animate-pulse' 
                      : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Sparkles size={16} className={isBatchTesting ? 'animate-spin' : ''} /> 
                  {isBatchTesting ? 'Testing...' : isExecutionBusy ? 'Run Locked' : 'Run Batch Test'}
                </button>
                <button onClick={handleBackup} className="btn px-4 py-3 rounded-2xl bg-sky-500 text-white hover:bg-sky-400 transition-all text-sm font-semibold gap-2 inline-flex items-center">
                  <Download size={16} /> Export Repo
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 min-h-0">
            {selectedFile ? (
              <>
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 overflow-hidden shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                  <div className="flex flex-col gap-4 border-b border-white/10 bg-sidebar/50 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-1">{selectedFile.path}</p>
                      <h2 className="text-xl font-semibold text-white">{selectedFile.name}</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap xl:justify-end">
                      <button onClick={handleRename} disabled={isRepoActionLocked} className="btn px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition-all text-sm flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                        <Code size={16} /> Rename
                      </button>
                      <button onClick={handleDuplicate} disabled={isRepoActionLocked} className="btn px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition-all text-sm flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                        <Bookmark size={16} /> Duplicate
                      </button>
                      <button onClick={handleExport} disabled={isRepoActionLocked} className="btn px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition-all text-sm flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                        <Download size={16} /> Export
                      </button>
                      <button onClick={handleDelete} disabled={isRepoActionLocked} className="btn px-4 py-3 rounded-2xl bg-red-500/15 border border-red-500/20 text-red-200 hover:bg-red-500/20 transition-all text-sm flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700">
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>
                  <div className="border-b border-white/10 p-4">
                    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div className="flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 uppercase tracking-[0.24em]">
                        <FileCode size={12} /> {fileTypeIcon(selectedFile.name)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 uppercase tracking-[0.24em]">
                        <Cpu size={12} /> {selectedFile.language}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                        Created: {selectedFile.createdAt ? new Date(selectedFile.createdAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:flex 2xl:flex-wrap 2xl:items-center 2xl:justify-end">
                      <button onClick={handleSaveContent} disabled={isRepoActionLocked} className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-400 transition-all disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300">Save</button>
                      <button onClick={handleValidateScript} disabled={isRepoActionLocked} className="rounded-2xl bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/25 transition-all disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                        Validate
                      </button>
                      <button 
                        onClick={() => setUseElevated(!useElevated)} 
                        disabled={isRepoActionLocked}
                        title="Run with Admin Privileges (sudo / pkexec / powershell)"
                        className={`rounded-2xl p-3 border transition-all flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 ${useElevated ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                      >
                        <Shield size={18} fill={useElevated ? "currentColor" : "none"} />
                        <span className="text-xs font-bold uppercase tracking-wider">{useElevated ? 'Admin ON' : 'Admin'}</span>
                      </button>
                      <button onClick={handleRunScript} disabled={isExecutionBusy} className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${isExecutionBusy ? 'bg-slate-700 text-slate-300 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.3)]'}`}>
                        {isExecutionBusy ? 'Running...' : 'Run Script'}
                      </button>
                    </div>
                    </div>
                  </div>
                  <div className="bg-[#0b1018]">
                    <MonacoEditor
                      theme="vs-dark"
                      language={activeLanguage}
                      value={editorValue}
                      onChange={(value) => setEditorValue(value || '')}
                      height={editorHeight}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        roundedSelection: true,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/80 overflow-hidden shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                  <div className="flex items-center gap-3 border-b border-white/10 bg-sidebar/50 px-5 py-3">
                    {['code', 'output', 'logs'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-semibold transition-all ${activeTab === tab ? 'text-white border-b-2 border-sky-500' : 'text-slate-400 hover:text-white'}`}
                      >
                        {tab === 'code' ? 'Code' : tab === 'output' ? 'Output' : 'Logs'}
                      </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                      <Search size={14} />
                      <span>{internalSearch ? 'Filtered' : 'Search inside file'}</span>
                    </div>
                    <input
                      value={internalSearch}
                      onChange={(e) => setInternalSearch(e.target.value)}
                      placeholder="Search inside..."
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500/30 focus:bg-white/10"
                    />
                  </div>

                  <div className="p-6 min-h-[260px]">
                    {activeTab === 'code' && (
                      <div className="rounded-3xl border border-white/10 bg-black/60 p-6 text-slate-300">
                        <p className="mb-4 text-sm text-slate-400">Editing <span className="text-white">{selectedFile.name}</span>. Use the editor above to adjust script logic, then save or run.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] uppercase text-slate-500 tracking-[0.3em] mb-2">Current search</p>
                            <p className="text-sm text-slate-200">{internalSearch || 'None'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] uppercase text-slate-500 tracking-[0.3em] mb-2">Recent run</p>
                            <p className="text-sm text-slate-200">{executionHistory[0]?.file || 'No runs yet'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] uppercase text-slate-500 tracking-[0.3em] mb-2">Last saved</p>
                            <p className="text-sm text-slate-200">{logs[0]?.time || 'Not saved'}</p>
                          </div>
                        </div>
                        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                          validationState.status === 'success'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                            : validationState.status === 'error'
                              ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                              : 'border-white/10 bg-white/5 text-slate-300'
                        }`}>
                          <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 mb-1">Validation</div>
                          <div>{validationState.message || 'Run Validate or Run Script to perform a syntax check.'}</div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'output' && (
                      <div className="space-y-4">
                        <AppTerminal
                          scriptPath={selectedFile.absolutePath || selectedFile.name}
                          scriptName={selectedFile.name}
                          disabled={!selectedFile || !window.electronAPI || isExecutionBusy}
                          onRun={handleRunScript}
                          onStop={handleStopScript}
                          onRestart={handleRestartScript}
                          session={terminalSession}
                          status={terminalStatus}
                          lastError={terminalError}
                          runtimeArgs={runtimeArgs}
                          setRuntimeArgs={setRuntimeArgs}
                        />
                        {(terminalError || aiDebugFeedback) ? (
                          <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">AI Repair</p>
                                <p className="mt-1 text-sm text-slate-300">Use stderr to diagnose the failure and rewrite the script.</p>
                              </div>
                              <button
                                onClick={handleAiFix}
                                disabled={isApplyingAiFix || !terminalError}
                                className="inline-flex items-center gap-2 rounded-2xl bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-200 transition-all hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                              >
                                <Sparkles size={16} />
                                {isApplyingAiFix ? 'Fixing...' : 'AI Fix Script'}
                              </button>
                            </div>
                            {terminalError ? (
                              <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-rose-300">
                                  <AlertTriangle size={12} />
                                  Last Error
                                </div>
                                <pre className="whitespace-pre-wrap">{terminalError}</pre>
                              </div>
                            ) : null}
                            {aiDebugFeedback ? (
                              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3 text-sm text-violet-100">
                                <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-violet-300">AI Diagnosis</div>
                                <div className="whitespace-pre-wrap">{aiDebugFeedback}</div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {activeTab === 'logs' && (
                      <div className="rounded-3xl border border-white/10 bg-black/60 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] uppercase text-slate-500 tracking-[0.2em] mb-2">Execution history</p>
                            {executionHistory.length ? executionHistory.map((entry) => (
                              <div key={entry.id} className="mb-3">
                                <div className="text-sm text-white font-semibold">{entry.file}</div>
                                <div className="text-[10px] uppercase text-slate-500">{entry.time} • {entry.status}</div>
                              </div>
                            )) : <p className="text-sm text-slate-400">No history available yet.</p>}
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] uppercase text-slate-500 tracking-[0.2em] mb-2">Recent activity</p>
                            {logs.length ? logs.slice(0, 5).map((entry, index) => (
                              <div key={index} className="mb-3 text-sm text-slate-300">
                                <div>{entry.event}</div>
                                <div className="text-[10px] text-slate-500">{entry.time}</div>
                              </div>
                            )) : <p className="text-sm text-slate-400">Start a script to populate logs.</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/80 p-12 text-center shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-sky-500/10 mb-6">
                  <FileText size={32} className="text-sky-300" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-3">No scripts found</h2>
                <p className="text-sm text-slate-400 mb-6">Create your first script or upload an existing one to begin using the workspace.</p>
                <button onClick={handleNewFile} className="rounded-2xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-400 transition-all">Create your first script</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ScriptRepo;
