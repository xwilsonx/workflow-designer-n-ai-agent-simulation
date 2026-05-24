import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Save, 
  Bot, 
  User, 
  Users, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  GitBranch, 
  Activity, 
  FileText, 
  Sparkles, 
  Cpu, 
  History, 
  Layers, 
  ArrowRight, 
  Upload, 
  MessageSquare, 
  Clock, 
  ChevronRight, 
  HelpCircle,
  Inbox,
  X,
  PlusCircle,
  AlertCircle,
  Settings,
  LogOut,
  Key,
  ShieldCheck
} from 'lucide-react';
import { 
  Role, 
  NodeType, 
  WorkflowNode, 
  WorkflowEdge, 
  WorkflowTemplate, 
  WorkflowInstance, 
  TaskInstance, 
  NotificationItem, 
  WorkflowHistory 
} from './types';

export default function App() {
  // SSO Authorization and Persona States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('axiom_sso_logged_in') === 'true';
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Application Data States
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string>("inst_demo");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  
  // Impersonated Role for Simulation View
  const [userRole, setUserRole] = useState<Role>('Employee');
  
  // Selection and Connection State for Canvas
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectionCondition, setConnectionCondition] = useState<string>('');
  
  // Loading & Interactivity UI indicators
  const [activeView, setActiveView] = useState<'designer' | 'tasks' | 'guidance'>('designer');
  const [isSaving, setIsSaving] = useState(false);

  // Version control overlay trigger states
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [commitVersion, setCommitVersion] = useState('1.0.1');
  const [commitDescription, setCommitDescription] = useState('');
  const [commitAuthor, setCommitAuthor] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'aiTelemetry'>('history');
  
  // Local states for Node Builder Form Modal
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeType, setNewNodeType] = useState<NodeType>('Task');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');
  const [newNodeRole, setNewNodeRole] = useState<Role>('Employee');
  const [newNodeCriteria, setNewNodeCriteria] = useState('');

  // Local state for Human Submission Form inside Role views
  const [reportInput, setReportInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [selectedDecisionOption, setSelectedDecisionOption] = useState('');

  // Notification Banner Toast Alert
  const [toastMessage, setToastMessage] = useState<{title: string, msg: string, id: string} | null>(null);
  const lastCheckedNotificationId = useRef<string | null>(null);

  // Initialize and Fetch Initial State
  useEffect(() => {
    fetchInitialState();
    
    // Set up rapid polling interval for simulated real-time telemetry (2.5 seconds)
    const interval = setInterval(() => {
      pollTelemetry();
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Poll for background changes
  const pollTelemetry = async () => {
    try {
      const [instRes, notifRes, logsRes] = await Promise.all([
        fetch("/api/instances"),
        fetch("/api/notifications"),
        fetch("/api/logs")
      ]);

      const updatedInstances: WorkflowInstance[] = await instRes.json();
      const updatedNotifs: NotificationItem[] = await notifRes.json();
      const updatedLogs = await logsRes.json();

      setInstances(updatedInstances);
      setNotifications(updatedNotifs);
      setAgentLogs(updatedLogs);

      // Trigger automatic UI screen feedback toasts for newly arrived notifications
      if (updatedNotifs.length > 0) {
        const latestNotif = updatedNotifs[0];
        // Trigger if new and matches currently impersonated role
        if (latestNotif.id !== lastCheckedNotificationId.current && latestNotif.role === userRole) {
          lastCheckedNotificationId.current = latestNotif.id;
          showToast(latestNotif.title, latestNotif.message);
        }
      }
    } catch (e) {
      console.error("Polling database telemetry failed", e);
    }
  };

  const fetchInitialState = async () => {
    try {
      const [tempRes, instRes, notifRes, logsRes] = await Promise.all([
        fetch("/api/workflows"),
        fetch("/api/instances"),
        fetch("/api/notifications"),
        fetch("/api/logs")
      ]);
      
      const workflowTemplates: WorkflowTemplate[] = await tempRes.json();
      const activeInstances: WorkflowInstance[] = await instRes.json();
      const initialNotifs: NotificationItem[] = await notifRes.json();
      const initialLogs = await logsRes.json();

      setTemplates(workflowTemplates);
      setInstances(activeInstances);
      setNotifications(initialNotifs);
      setAgentLogs(initialLogs);

      if (workflowTemplates.length > 0) {
        // Default select first template in designer canvas
        setSelectedTemplate(workflowTemplates[0]);
      }
    } catch (err) {
      console.error("Initialization fetch error:", err);
    }
  };

  // Helper trigger custom modal toast alerts
  const showToast = (title: string, msg: string) => {
    const freshId = Date.now().toString();
    setToastMessage({ title, msg, id: freshId });
    setTimeout(() => {
      setToastMessage(prev => prev?.id === freshId ? null : prev);
    }, 4500);
  };

  // Reset entire workflow simulation database to seed state
  const resetSimulation = async () => {
    try {
      const response = await fetch('/api/simulation/reset', { method: 'POST' });
      const data = await response.json();
      showToast("Simulation Reset Successful", "Re-entered baseline values and cleared analytics logs.");
      
      // Refresh views
      fetchInitialState();
      setActiveInstanceId("inst_demo");
      setReportInput('');
      setCommentInput('');
      setSelectedDecisionOption('');
    } catch (err) {
      console.error("Failure while resetting application:", err);
    }
  };

  // Save current Template configuration changes
  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedTemplate)
      });
      const saved: WorkflowTemplate = await response.json();
      
      // Update template registry in state
      setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? saved : t));
      showToast("Workflow Design Saved", "Successfully recorded modified nodes & edges layout.");
    } catch (err) {
      console.error("Error saving schema:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Commit current design layout canvas as a new version history point
  const handleCommitVersion = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/workflows/${selectedTemplate.id}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: commitVersion,
          description: commitDescription || "Custom design snapshot",
          author: commitAuthor || userRole,
          nodes: selectedTemplate.nodes,
          edges: selectedTemplate.edges
        })
      });
      const data = await response.json();
      if (data.template) {
        setSelectedTemplate(data.template);
        setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? data.template : t));
        showToast("Workflow Design Committed", `Successfully created new revision snapshot: ${commitVersion}`);
        setShowCommitModal(false);
      } else {
        showToast("Error", data.error || "Failed to commit version.");
      }
    } catch (err) {
      console.error("Failed to save and commit revision:", err);
      showToast("Error", "Network error when committing revision.");
    } finally {
      setIsSaving(false);
    }
  };

  // Run selected template as active instance
  const handleRunTemplate = async () => {
    if (!selectedTemplate) return;
    setIsRunning(true);
    try {
      const response = await fetch(`/api/workflows/${selectedTemplate.id}/run`, { method: 'POST' });
      const newInstance: WorkflowInstance = await response.json();
      
      setInstances(prev => [newInstance, ...prev]);
      setActiveInstanceId(newInstance.id);
      showToast("Laid Instanced Flow", `Active run '${newInstance.id}' initialized successfully!`);
    } catch (err) {
      console.error("Launching workflow run failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  // Submit human action in role portal
  const handleTaskSubmit = async (taskId: string) => {
    if (!activeInstanceId) return;
    setIsSubmittingTask(true);
    try {
      const bodyPayload = {
        reportText: reportInput,
        comment: commentInput,
        decision: selectedDecisionOption
      };

      const response = await fetch(`/api/instances/${activeInstanceId}/task/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const resData = await response.json();
      
      showToast("Task Feedback Sent", "Propagating details onward to AI Orchester loop.");
      
      // Reset input fields
      setReportInput('');
      setCommentInput('');
      setSelectedDecisionOption('');
      
      // Fetch latest instances right away to show progress
      pollTelemetry();
    } catch (err) {
      console.error("Error submitting user step:", err);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Custom visual node drag handler
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // ignore right clicks
    if (!selectedTemplate) return;

    const canvasContainer = e.currentTarget.parentElement;
    if (!canvasContainer) return;

    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const nodeToDrag = selectedTemplate.nodes.find(n => n.id === nodeId);
    if (!nodeToDrag) return;

    const initialX = nodeToDrag.x;
    const initialY = nodeToDrag.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      // Bound nodes constraints inside relative canvas viewports
      const nextX = Math.max(10, Math.min(2000, initialX + dx));
      const nextY = Math.max(10, Math.min(2000, initialY + dy));

      setSelectedTemplate(prev => {
        if (!prev) return null;
        return {
          ...prev,
          nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, x: nextX, y: nextY } : n)
        };
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Canvas Actions: Add nodes
  const submitNewNode = () => {
    if (!selectedTemplate || !newNodeTitle.trim()) return;

    const freshNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: newNodeType,
      title: newNodeTitle,
      description: newNodeDesc,
      assigneeRole: newNodeRole,
      completionCriteria: newNodeCriteria || "Specify parameters to progress.",
      x: 300,
      y: 180,
    };

    setSelectedTemplate(prev => {
      if (!prev) return null;
      return {
        ...prev,
        nodes: [...prev.nodes, freshNode]
      };
    });

    // Reset modals
    setNewNodeTitle('');
    setNewNodeDesc('');
    setNewNodeCriteria('');
    setShowAddNodeModal(false);
    setSelectedNodeId(freshNode.id);
    showToast("Added Node", `Inserted generic '${newNodeType}' element; configure connections next!`);
  };

  // Remove nodes
  const handleDeleteNode = (nodeId: string) => {
    if (!selectedTemplate) return;

    setSelectedTemplate(prev => {
      if (!prev) return null;
      return {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== nodeId),
        // Clean out incoming and outcoming connected paths too
        edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
      };
    });

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    showToast("Deleted Node", `Removed diagram element ${nodeId}`);
  };

  // Connections handler
  const handleInitiateConnection = (sourceId: string) => {
    setConnectingSourceId(sourceId);
    setConnectionCondition('');
    showToast("Linking Node", "Click another target node to wire them together.");
  };

  const handleCompleteConnection = (targetId: string) => {
    if (!selectedTemplate || !connectingSourceId || connectingSourceId === targetId) {
      setConnectingSourceId(null);
      return;
    }

    const newEdge: WorkflowEdge = {
      id: `edge_${connectingSourceId}_${targetId}_${Date.now()}`,
      source: connectingSourceId,
      target: targetId,
      condition: connectionCondition.trim() || undefined
    };

    setSelectedTemplate(prev => {
      if (!prev) return null;
      // Ensure we don't duplicate existing edge layouts
      const exists = prev.edges.some(e => e.source === newEdge.source && e.target === newEdge.target);
      if (exists) return prev;
      return {
        ...prev,
        edges: [...prev.edges, newEdge]
      };
    });

    setConnectingSourceId(null);
    setConnectionCondition('');
    showToast("Nodes Connected", "Successfully completed directional pathway connector.");
  };

  const handleDeleteEdge = (edgeId: string) => {
    if (!selectedTemplate) return;
    setSelectedTemplate(prev => {
      if (!prev) return null;
      return {
        ...prev,
        edges: prev.edges.filter(e => e.id !== edgeId)
      };
    });
    showToast("Connection Removed", "Snapped path logic link.");
  };

  // Get active selected instance details
  const activeInstance = instances.find(i => i.id === activeInstanceId);
  const activeTaskInstance = activeInstance?.tasks.find(
    t => t.nodeId === activeInstance.currentNodeId && (t.status === 'Active' || t.status === 'Pending')
  );

  // SVG Cubic Bezier layout builder for paths
  const calculateEdgePath = (source: WorkflowNode, target: WorkflowNode) => {
    const nodeWidth = 190;
    const nodeHeight = 84;
    
    // Compute socket positions: Source connects via right output, target meets via left input
    const x1 = source.x + nodeWidth;
    const y1 = source.y + nodeHeight / 2;
    const x2 = target.x;
    const y2 = target.y + nodeHeight / 2;
    
    const controlPointOffset = Math.max(60, Math.abs(x2 - x1) * 0.4);
    
    return `M ${x1} ${y1} C ${x1 + controlPointOffset} ${y1}, ${x2 - controlPointOffset} ${y2}, ${x2} ${y2}`;
  };

  if (!isLoggedIn) {
     return (
       <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-between font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
         {/* Particle background accent */}
         <div className="absolute inset-0 bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] [background-size:20px_20px] opacity-25 animate-pulse" />
         
         {/* SSO Top Header */}
         <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/40 backdrop-blur-md relative z-10 select-none">
           <div className="flex items-center space-x-3">
             <div className="bg-[#DB1E26] p-2 rounded-sm text-white font-bold text-sm flex items-center justify-center shadow-lg shadow-[#DB1E26]/20 font-serif translate-x-0.5 rotate-12">
               H
             </div>
             <div>
               <h1 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                 HSBC HEXAFLOW SYSTEM <span className="text-red-400 text-[10px] font-mono font-bold bg-red-500/15 px-1.5 py-0.5 rounded">v4.2</span>
               </h1>
               <p className="text-[9px] text-slate-400 font-mono tracking-tight uppercase">Corporate Decision-Chain & Multi-Agent Simulator</p>
             </div>
           </div>
           
           <div className="flex items-center space-x-2 text-[9px] bg-slate-850/80 border border-slate-850 rounded-full px-3 py-1 text-slate-300 font-mono leading-none">
             <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span>Zero-Trust: Active</span>
           </div>
         </header>

         {/* SSO Main Form Grid */}
         <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
           <div className="max-w-xl w-full text-center space-y-3 mb-8">
             <div className="inline-flex items-center space-x-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-sm text-[10px] font-mono font-bold tracking-wider uppercase">
               <Key className="h-3.5 w-3.5" />
               <span>HSBC Federated SSO Vault Key</span>
             </div>
             <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight font-sans">
               Assumed Workspace Identity Clearance
             </h2>
             <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
               Select an authorized corporate role profile below to provision your workspace simulation permissions.
             </p>
             <div className="text-[10px] font-mono text-slate-500 mt-1">
               Active Session Identity: <span className="text-slate-300 font-semibold underline">bruenbrent2042003@gmail.com</span>
             </div>
           </div>

           {/* Profiles Grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl px-4">
             
             {/* 1. Employee Profile */}
             <button
               onClick={() => {
                 setUserRole('Employee');
                 setIsLoggedIn(true);
                 localStorage.setItem('axiom_sso_logged_in', 'true');
                 showToast("SSO Identity Provisioned", "Logged in securely as Alex Rivera (PR Strategist).");
               }}
               className="bg-[#1E293B]/40 border border-[#334155]/60 hover:border-indigo-500 hover:bg-[#1E293B]/80 text-left p-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/5 group flex flex-col justify-between h-[160px] cursor-pointer"
             >
               <div>
                 <div className="flex items-center justify-between mb-2">
                   <div className="bg-indigo-500/10 p-2 rounded text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                     <User className="h-4 w-4" />
                   </div>
                   <span className="text-[8px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">LEVEL 1</span>
                 </div>
                 <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-indigo-400 transition-colors">Employee Portal</h3>
                 <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                   Alex Rivera (PR Strategist). Draft PR proposals, analyze target expenditures and dispatch tasks.
                 </p>
               </div>
               <div className="text-[9px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2">
                 <span>Drafting Queue</span>
                 <span className="text-indigo-400 font-bold group-hover:translate-x-1 transition-all">Select Profile &rarr;</span>
               </div>
             </button>

             {/* 2. Manager Profile */}
             <button
               onClick={() => {
                 setUserRole('Manager');
                 setIsLoggedIn(true);
                 localStorage.setItem('axiom_sso_logged_in', 'true');
                 showToast("SSO Identity Provisioned", "Logged in securely as Sarah Chen (Ops Director).");
               }}
               className="bg-[#1E293B]/40 border border-[#334155]/60 hover:border-orange-500 hover:bg-[#1E293B]/80 text-left p-4 rounded-xl transition-all shadow-lg hover:shadow-orange-500/5 group flex flex-col justify-between h-[160px] cursor-pointer"
             >
               <div>
                 <div className="flex items-center justify-between mb-2">
                   <div className="bg-orange-500/10 p-2 rounded text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-all">
                     <Users className="h-4 w-4" />
                   </div>
                   <span className="text-[8px] font-mono bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">LEVEL 2</span>
                 </div>
                 <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-orange-400 transition-colors">Manager Portal</h3>
                 <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                   Sarah Chen (Ops Director). Assess financial metrics, route pipeline branches and manage approvals.
                 </p>
               </div>
               <div className="text-[9px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2">
                 <span>Operational Review</span>
                 <span className="text-orange-400 font-bold group-hover:translate-x-1 transition-all">Select Profile &rarr;</span>
               </div>
             </button>

             {/* 3. Executive Auditor Profile */}
             <button
               onClick={() => {
                 setUserRole('Approver');
                 setIsLoggedIn(true);
                 localStorage.setItem('axiom_sso_logged_in', 'true');
                 showToast("SSO Identity Provisioned", "Logged in securely as Elena Rostova (VP Finance).");
               }}
               className="bg-[#1E293B]/40 border border-[#334155]/60 hover:border-emerald-500 hover:bg-[#1E293B]/80 text-left p-4 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/5 group flex flex-col justify-between h-[160px] cursor-pointer"
             >
               <div>
                 <div className="flex items-center justify-between mb-2">
                   <div className="bg-emerald-500/10 p-2 rounded text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                     <CheckCircle2 className="h-4 w-4" />
                   </div>
                   <span className="text-[8px] font-mono bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">LEVEL 3</span>
                 </div>
                 <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-emerald-400 transition-colors">VP Auditor Portfolio</h3>
                 <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                   Elena Rostova (VP Finance). Grant executive budget vetting and strategic override clearance.
                 </p>
               </div>
               <div className="text-[9px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2">
                 <span>Strategic Overrides</span>
                 <span className="text-emerald-400 font-bold group-hover:translate-x-1 transition-all">Select Profile &rarr;</span>
               </div>
             </button>

             {/* 4. Administrator Profile */}
             <button
               onClick={() => {
                 setUserRole('Admin');
                 setIsLoggedIn(true);
                 localStorage.setItem('axiom_sso_logged_in', 'true');
                 showToast("SSO Identity Provisioned", "Logged in securely as Brent Bruen (DevSecOps).");
               }}
               className="bg-[#1E293B]/40 border border-[#334155]/60 hover:border-purple-500 hover:bg-[#1E293B]/80 text-left p-4 rounded-xl transition-all shadow-lg hover:shadow-purple-500/5 group flex flex-col justify-between h-[160px] cursor-pointer"
             >
               <div>
                 <div className="flex items-center justify-between mb-2">
                   <div className="bg-purple-500/10 p-2 rounded text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all">
                     <Settings className="h-4 w-4" />
                   </div>
                   <span className="text-[8px] font-mono bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">SYSADMIN</span>
                 </div>
                 <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-purple-400 transition-colors">Admin Core Panel</h3>
                 <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                   Brent Bruen (SysAdmin). Configure graphic canvas structure, save blueprints and monitor prompt telemetry.
                 </p>
               </div>
               <div className="text-[9px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2">
                 <span>Full Graph Controls</span>
                 <span className="text-purple-400 font-bold group-hover:translate-x-1 transition-all">Select Profile &rarr;</span>
               </div>
             </button>

           </div>
         </main>

         {/* SSO Footer */}
         <footer className="px-6 py-4 border-t border-slate-800 text-center text-slate-500 text-[9px] font-mono select-none">
           Axiom Authentication Core v4.2 • Secure Federated SSO Session Status: OK
         </footer>
       </div>
     );
   }

   return (
     <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans selection:bg-[#DB1E26] selection:text-white">
       
       {/* High Density HSBC Branded Top Navigation Header */}
       <nav className="h-14 bg-[#1A1A1A] border-b border-[#2D2D2D] flex items-center justify-between px-4 z-40 shadow-sm shrink-0 select-none relative">
         <div className="flex items-center space-x-3">
           {/* Clean geometric HSBC Hexagon Logo */}
           <div className="relative h-7 w-10 flex items-center justify-center bg-[#DB1E26] shrink-0 p-1 rounded-sm shadow-inner">
             <svg viewBox="0 0 100 60" className="h-4 w-8 text-white fill-current">
               <polygon points="30,0 70,0 100,30 70,60 30,60 0,30" />
             </svg>
           </div>
           <div>
             <h1 className="text-xs font-black text-white tracking-widest flex items-center gap-1">
               HSBC <span className="text-[#DB1E26] font-normal">/</span> <span className="text-gray-100 font-medium tracking-tight">Axiom Flows</span>
             </h1>
             <p className="text-[7.5px] text-gray-450 font-mono tracking-widest uppercase">Federated Orchestrator Panel</p>
           </div>
         </div>

         {/* High Resolution Segmented Isolated View Switcher */}
         <div className="flex bg-[#2D2D2D] p-1 rounded-sm border border-[#3E3E3E] select-none">
           <button
             onClick={() => {
               setActiveView('designer');
               showToast("Designer Workspace", "Displaying structural workflow diagram nodes & edges canvas.");
             }}
             className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 font-extrabold text-[9px] sm:text-[10px] tracking-wide uppercase transition-all duration-150 cursor-pointer ${
               activeView === 'designer'
                 ? 'bg-[#DB1E26] text-white shadow font-black'
                 : 'text-gray-300 hover:text-white hover:bg-[#3D3D3D]'
             }`}
             style={{ borderRadius: '1px' }}
           >
             <Layers className="h-3.5 w-3.5" />
             <span className="hidden sm:inline">Diagram Designer</span>
             <span className="sm:hidden">Designer</span>
           </button>
           <button
             onClick={() => {
               setActiveView('tasks');
               showToast("Operations Task Portal", "Viewing live simulated employee queue inputs, overrides & real-time telemetry logs.");
             }}
             className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 font-extrabold text-[9px] sm:text-[10px] tracking-wide uppercase transition-all duration-150 cursor-pointer ${
               activeView === 'tasks'
                 ? 'bg-[#DB1E26] text-white shadow font-black'
                 : 'text-gray-300 hover:text-white hover:bg-[#3D3D3D]'
             }`}
             style={{ borderRadius: '1px' }}
           >
             <CheckCircle2 className="h-3.5 w-3.5" />
             <span className="hidden sm:inline">Task Workspace</span>
             <span className="sm:hidden">Tasks</span>
             {instances.reduce((acc, inst) => acc + inst.tasks.filter(t => t.status === 'Active' || t.status === 'Pending').length, 0) > 0 && (
               <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-none select-none ${
                 activeView === 'tasks' ? 'bg-white text-[#DB1E26]' : 'bg-[#DB1E26] text-white'
               }`}>
                 {instances.reduce((acc, inst) => acc + inst.tasks.filter(t => t.status === 'Active' || t.status === 'Pending').length, 0)}
               </span>
             )}
           </button>
         </div>

          {/* Standing Guidance Segment button container */}
          <div className="flex bg-[#2D2D2D] p-1 rounded-sm border border-[#3E3E3E] select-none border-l-0 pl-0 ml-1">
            <button
              onClick={() => {
                setActiveView('guidance');
                showToast("Standing Guidance Manual", "Displaying the comprehensive system instruction manuals by feature.");
              }}
              className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 font-extrabold text-[9px] sm:text-[10px] tracking-wide uppercase transition-all duration-150 cursor-pointer ${
                activeView === 'guidance'
                  ? 'bg-[#DB1E26] text-white shadow font-black'
                  : 'text-gray-300 hover:text-white hover:bg-[#3D3D3D]'
              }`}
              style={{ borderRadius: '1px' }}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">System Guidance</span>
              <span className="sm:hidden">Guidance</span>
            </button>
          </div>

         {/* High Density Perspective Switcher & Reset */}
         <div className="flex items-center space-x-3.5">
           
           {/* Reset Simulation DB widget */}
           <button 
             onClick={resetSimulation}
             className="flex items-center space-x-1.5 text-[9px] bg-transparent border border-[#444444] hover:border-[#DB1E26] hover:bg-[#DB1E26]/10 text-gray-300 font-extrabold px-2.5 py-1 rounded-sm transition-all cursor-pointer"
             title="Reset simulation data to baseline template"
             id="btn_reset_simulation"
           >
             <RotateCcw className="h-3 w-3 text-[#DB1E26]" />
             <span className="hidden lg:inline uppercase">Reset Baseline</span>
           </button>

           <div className="h-4 w-px bg-gray-750" />

           {/* Top-Right Avatar for SSO Switcher */}
           <div className="relative">
             <button 
               onClick={() => setShowProfileMenu(prev => !prev)}
               className="flex items-center space-x-2 focus:outline-none rounded-sm p-1 hover:bg-[#2D2D2D] transition-all select-none border border-transparent hover:border-[#3E3E3E] cursor-pointer text-left"
               title="Axiom Authorized Profile SSO Details"
               id="avatar_dropdown_trigger"
             >
               {/* Dynamic Initial Circle */}
               <div className="relative">
                 <div className={`h-7 w-7 rounded-sm flex items-center justify-center font-bold text-[9px] text-white shadow transition-all ${
                   userRole === 'Employee' ? 'bg-[#DB1E26]' :
                   userRole === 'Manager' ? 'bg-orange-600' :
                   userRole === 'Approver' ? 'bg-emerald-600' : 'bg-purple-600'
                 }`}>
                   {userRole === 'Admin' ? 'AD' : userRole === 'Approver' ? 'ER' : userRole === 'Manager' ? 'SC' : 'AR'}
                 </div>
                 {/* Simulated online signal beacon */}
                 <span className="absolute bottom-0 right-0 block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-[#1A1A1A] animate-pulse" />
               </div>

               {/* Profile Identity Details label */}
               <div className="hidden sm:block text-left pr-1 leading-none">
                 <div className="text-[10px] font-extrabold text-white">
                   {userRole === 'Employee' ? 'Alex Rivera' :
                    userRole === 'Manager' ? 'Sarah Chen' :
                    userRole === 'Approver' ? 'Elena Rostova' : 'Brent Bruen'}
                 </div>
                 <span className="text-[7px] font-mono text-gray-400 uppercase tracking-widest block transform scale-90 -translate-x-[2.5px] mt-0.5">
                   {userRole === 'Approver' ? 'Auditor' : userRole}
                 </span>
               </div>
             </button>

             {/* Profile SSO Selector Dropdown Sheet */}
             {showProfileMenu && (
               <>
                 {/* Click intercept catcher backdrop to close popover */}
                 <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowProfileMenu(false)} />
                 
                 <div className="absolute right-0 mt-1.5 w-64 bg-white border border-gray-200 rounded shadow-xl z-50 overflow-hidden text-left p-3.5 space-y-3.5 animate-in fade-in zoom-in-95 duration-100">
                   
                   {/* Header Authorized Credentials */}
                   <div className="pb-2.5 border-b border-gray-100 select-none">
                     <span className="text-[8px] font-mono text-indigo-600 uppercase tracking-wider font-bold block mb-1">Axiom Cloud SSO Token</span>
                     <div className="flex items-center space-x-2.5">
                       <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                         userRole === 'Employee' ? 'bg-indigo-600' :
                         userRole === 'Manager' ? 'bg-orange-500' :
                         userRole === 'Approver' ? 'bg-emerald-600' : 'bg-purple-600'
                       }`}>
                         {userRole === 'Admin' ? 'AD' : userRole === 'Approver' ? 'ER' : userRole === 'Manager' ? 'SC' : 'AR'}
                       </div>
                       <div>
                         <div className="text-[11px] font-bold text-gray-800 leading-tight">
                           {userRole === 'Employee' ? 'Alex Rivera' :
                            userRole === 'Manager' ? 'Sarah Chen' :
                            userRole === 'Approver' ? 'Elena Rostova' : 'Brent Bruen'}
                         </div>
                         <div className="text-[9px] text-gray-400 font-mono truncate max-w-[150px]" title="bruenbrent2042003@gmail.com">
                           bruenbrent2042003@gmail.com
                         </div>
                       </div>
                     </div>
                     {/* Token status summary badge */}
                     <div className="mt-2 flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-mono leading-none">
                       <span className="flex items-center font-bold"><ShieldCheck className="h-3 w-3 mr-0.5 text-emerald-600" /> Identity Verified</span>
                       <span className="text-[8px] text-emerald-600">JWT SIGN OK</span>
                     </div>
                   </div>

                   {/* Persona hot switcher menu options */}
                   <div className="space-y-1 select-none">
                     <span className="text-[8px] font-mono text-gray-400 uppercase tracking-wider font-bold block px-0.5 mb-1.5">Assume Workspace Persona</span>
                     
                     <button
                       onClick={() => {
                         setUserRole('Employee');
                         setShowProfileMenu(false);
                         showToast("Persona Adjusted", "Assuming Employee profile details (Alex Rivera).");
                       }}
                       className={`flex items-center space-x-2 w-full text-left px-2 py-1 rounded text-xs transition-all cursor-pointer ${userRole === 'Employee' ? 'bg-indigo-50 text-indigo-700 font-bold border-l-2 border-indigo-600' : 'hover:bg-gray-50 text-gray-650'}`}
                     >
                       <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                       <span className="flex-1">💼 Employee (Alex)</span>
                       {userRole === 'Employee' && <span className="text-[8px] text-indigo-600 font-mono font-bold">ACTIVE</span>}
                     </button>

                     <button
                       onClick={() => {
                         setUserRole('Manager');
                         setShowProfileMenu(false);
                         showToast("Persona Adjusted", "Assuming Manager profile details (Sarah Chen).");
                       }}
                       className={`flex items-center space-x-2 w-full text-left px-2 py-1 rounded text-xs transition-all cursor-pointer ${userRole === 'Manager' ? 'bg-orange-50 text-orange-850 font-bold border-l-2 border-orange-500' : 'hover:bg-gray-50 text-gray-650'}`}
                     >
                       <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                       <span className="flex-1">📂 Manager (Sarah)</span>
                       {userRole === 'Manager' && <span className="text-[8px] text-orange-650 font-mono font-bold">ACTIVE</span>}
                     </button>

                     <button
                       onClick={() => {
                         setUserRole('Approver');
                         setShowProfileMenu(false);
                         showToast("Persona Adjusted", "Assuming Executive Auditor details (Elena Rostova).");
                       }}
                       className={`flex items-center space-x-2 w-full text-left px-2 py-1 rounded text-xs transition-all cursor-pointer ${userRole === 'Approver' ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-500' : 'hover:bg-gray-50 text-gray-650'}`}
                     >
                       <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                       <span className="flex-1">🔍 VP Auditor (Elena)</span>
                       {userRole === 'Approver' && <span className="text-[8px] text-emerald-600 font-mono font-bold">ACTIVE</span>}
                     </button>

                     <button
                       onClick={() => {
                         setUserRole('Admin');
                         setShowProfileMenu(false);
                         showToast("Persona Adjusted", "Assuming System Admin profile details (Brent Bruen).");
                       }}
                       className={`flex items-center space-x-2 w-full text-left px-2 py-1 rounded text-xs transition-all cursor-pointer ${userRole === 'Admin' ? 'bg-purple-50 text-purple-700 font-bold border-l-2 border-purple-500' : 'hover:bg-gray-50 text-gray-650'}`}
                     >
                       <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                       <span className="flex-1">⚙️ Administrator (Brent)</span>
                       {userRole === 'Admin' && <span className="text-[8px] text-purple-600 font-mono font-bold">ACTIVE</span>}
                     </button>
                   </div>

                   {/* Return sign out to authentication entry page */}
                   <div className="pt-2 border-t border-gray-100">
                     <button
                       onClick={() => {
                         setIsLoggedIn(false);
                         setShowProfileMenu(false);
                         localStorage.removeItem('axiom_sso_logged_in');
                         showToast("SSO Terminated", "FEDERATED SSO verification keys cleared successfully.");
                       }}
                       className="flex items-center justify-center space-x-1.5 w-full text-center bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs py-1.5 rounded transition-all cursor-pointer"
                     >
                       <LogOut className="h-3.5 w-3.5 text-red-500" />
                       <span>SWITCH SSO PROFILE</span>
                     </button>
                   </div>
                 </div>
               </>
             )}
           </div>
         </div>
       </nav>

       {/* Floating Global New Notification Toast Banner */}
       {toastMessage && (
         <div className="fixed top-16 right-4 bg-white border-l-4 border-indigo-600 shadow-xl p-3.5 rounded border border-gray-200 max-w-sm flex items-start space-x-3 transition-all z-50 animate-bounce active-glow">
           <Bell className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
           <div>
             <span className="text-[9px] font-mono text-indigo-600 font-bold block uppercase tracking-wider">Simulated Message</span>
             <h4 className="text-xs font-semibold text-gray-900">{toastMessage.title}</h4>
             <p className="text-[11px] text-gray-600 mt-0.5">{toastMessage.msg}</p>
           </div>
           <button 
             onClick={() => setToastMessage(null)}
             className="text-gray-400 hover:text-gray-700 transition-all cursor-pointer"
           >
             <X className="h-3.5 w-3.5" />
           </button>
         </div>
       )}

       {/* Core Split Screen Layout */}
       <main className="flex-1 flex flex-col xl:flex-row overflow-hidden bg-[#F8F9FA]">
          {activeView === 'designer' ? (
            <>
         
         {/* Left Side: Drag & Drop Designer Canvas */}
         <section className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden h-[500px] xl:h-[calc(100vh-48px)] min-h-[450px]">
           
           {/* Canvas Sub-Header */}
           <div className="px-4 py-2 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 z-10 shrink-0 select-none shadow-sm h-12">
             <div className="flex items-center space-x-3">
               <div className="flex items-center space-x-1 sm:border-r border-gray-200 pr-3 mr-1">
                 <PlusCircle className="h-4 w-4 text-indigo-600" />
                 <span className="text-[10px] font-mono uppercase font-bold text-gray-700 tracking-wider">Designer Workspace Layout</span>
               </div>
               
               {/* Workflow Template Base SelectorDropdown */}
               <div className="flex items-center space-x-1.5">
                 <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Template Base:</span>
                 <select
                   value={selectedTemplate?.id || ''}
                   onChange={(e) => {
                     const temp = templates.find(t => t.id === e.target.value);
                     if (temp) {
                       setSelectedTemplate(temp);
                       setSelectedNodeId(null);
                       showToast("Template Base Loaded", `Switched design flow baseline model to '${temp.name}'.`);
                     }
                   }}
                   className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[11px] font-bold rounded text-gray-700 py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-all"
                   id="template_selector_dropdown"
                 >
                   {templates.map(t => (
                     <option key={t.id} value={t.id}>
                       {t.name}
                     </option>
                   ))}
                 </select>
               </div>
             </div>

            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowAddNodeModal(true)}
                className="flex items-center space-x-1 text-[11px] bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 text-indigo-700 hover:text-white px-2.5 py-1 rounded transition-all cursor-pointer"
                id="btn_add_node"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="font-semibold">ADD NODE</span>
              </button>

              <button 
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="flex items-center space-x-1 text-[11px] bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 px-2.5 py-1 rounded transition-all cursor-pointer"
                title="Saves node blueprint positions to local registry database"
                id="btn_save_template"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="font-semibold">{isSaving ? 'SAVING...' : 'SAVE BLUEPRINT'}</span>
              </button>

              <button 
                onClick={handleRunTemplate}
                disabled={isRunning}
                className="flex items-center space-x-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded font-semibold shadow-sm transition-all cursor-pointer font-sans"
                title="Spawn an active task-instance run to step simulations"
                id="btn_run_template"
              >
                <Play className="h-3.5 w-3.5" />
                <span>LAUNCH RUN</span>
              </button>
            </div>
          </div>

          {/* Designer Canvas Grid */}
          <div 
            className="flex-1 canvas-grid overflow-auto select-none relative bg-[#F8FAFC]"
            style={{ width: '100%', height: '100%' }}
            id="designer_canvas"
          >
            {/* Edge Drawing Connection Vector Overlay */}
            {selectedTemplate && (
              <svg 
                className="absolute inset-0 pointer-events-none w-full h-full min-w-[2000px] min-h-[1000px]"
                id="canvas_edges_overlay"
              >
                <defs>
                  {/* Directional Arrow Markings */}
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
                  </marker>
                  <marker
                    id="arrow-active"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" />
                  </marker>
                </defs>
 
                {/* Draw saved connections */}
                {selectedTemplate.edges.map((edge) => {
                  const sourceNode = selectedTemplate.nodes.find(n => n.id === edge.source);
                  const targetNode = selectedTemplate.nodes.find(n => n.id === edge.target);
                  
                  if (!sourceNode || !targetNode) return null;
 
                  // Detect if this path relates to current active step highlights
                  const isActiveEdge = activeInstance?.currentNodeId === sourceNode.id;
 
                  return (
                    <g key={edge.id} className="group pointer-events-auto">
                      {/* Clickable Hover Helper Line */}
                      <path 
                        d={calculateEdgePath(sourceNode, targetNode)}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="10"
                        className="cursor-pointer"
                        title="Click details to snap edge"
                      />
                      
                      {/* Main Rendered Path */}
                      <path 
                        d={calculateEdgePath(sourceNode, targetNode)}
                        fill="none"
                        stroke={isActiveEdge ? '#3B82F6' : '#CBD5E1'}
                        strokeWidth={isActiveEdge ? '2' : '1.5'}
                        markerEnd={`url(#${isActiveEdge ? 'arrow-active' : 'arrow'})`}
                        className={`transition-all ${isActiveEdge ? 'pulse-line text-blue-500' : ''}`}
                      />
 
                      {/* Path Label / Condition string */}
                      {edge.condition && (
                        <foreignObject
                          x={(sourceNode.x + targetNode.x) / 2 + 35}
                          y={(sourceNode.y + targetNode.y) / 2 + 10}
                          width="120"
                          height="35"
                          className="overflow-visible"
                        >
                          <div className="bg-white/95 border border-gray-200 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-gray-500 text-center select-none shadow-sm">
                            {edge.condition}
                          </div>
                        </foreignObject>
                      )}
 
                      {/* snapped edge helper button */}
                      <foreignObject
                        x={(sourceNode.x + targetNode.x) / 2 + 10}
                        y={(sourceNode.y + targetNode.y) / 2 + 15}
                        width="30"
                        height="30"
                        className="opacity-0 group-hover:opacity-100 transition-opacity overflow-visible"
                      >
                        <button 
                          onClick={() => handleDeleteEdge(edge.id)}
                          className="bg-red-500 hover:bg-red-600 p-1 rounded text-white shadow shadow-red-500/20 cursor-pointer transition-all"
                          title="Snap Connection"
                        >
                          <Trash2 className="h-3 w-3" />
                         </button>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Draggable Floating Nodes Container */}
            {selectedTemplate && selectedTemplate.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              
              // Telemetry highlighting based on running instance state
              const isCurrentSimulatedStep = activeInstance?.currentNodeId === node.id;
              const matchingTask = activeInstance?.tasks.find(t => t.nodeId === node.id);
              
              // Visual custom status styles
              let borderClass = 'border-gray-200 bg-white';
              let accentIcon = <User className="h-3.5 w-3.5 text-gray-500" />;

              if (node.type === 'AI_Agent') {
                borderClass = 'ai-node';
                accentIcon = <Bot className="h-3.5 w-3.5 text-purple-600" />;
              } else if (node.type === 'Decision') {
                borderClass = 'border-l-4 border-l-orange-500';
                accentIcon = <GitBranch className="h-3.5 w-3.5 text-orange-600" />;
              } else if (node.type === 'Role_Handoff') {
                borderClass = 'border-l-4 border-l-blue-500';
                accentIcon = <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />;
              }

              // Active glowing state
              let glowIntensity = '';
              if (isCurrentSimulatedStep) {
                glowIntensity = 'node-active';
              }

              return (
                <div 
                  key={node.id}
                  className={`absolute node-card w-[180px] rounded border select-none z-20 overflow-hidden ${borderClass} ${isSelected ? 'ring-2 ring-indigo-500/20 border-indigo-500' : ''} ${glowIntensity}`}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  id={`node_card_${node.id}`}
                >
                  {/* Node Drag Header */}
                  <div 
                    onMouseDown={(e) => handleNodeDragStart(node.id, e)}
                    className="px-2.5 py-1 border-b border-gray-100 flex items-center justify-between cursor-move bg-gray-50/90 rounded-t"
                    title="Drag to reposition card"
                  >
                    <div className="flex items-center space-x-1 overflow-hidden">
                      {accentIcon}
                      <span className="text-[9px] font-mono text-gray-500 font-bold tracking-wider uppercase truncate">
                        {node.type === 'AI_Agent' ? 'AI Agent' : node.type === 'Role_Handoff' ? 'Handoff' : node.type}
                      </span>
                    </div>

                    {/* Fast connector trigger */}
                    <div className="flex items-center space-x-1">
                      {connectingSourceId === node.id ? (
                        <span className="text-[8px] font-mono bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded uppercase animate-pulse font-bold">CONNECTING</span>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (connectingSourceId) {
                              handleCompleteConnection(node.id);
                            } else {
                              handleInitiateConnection(node.id);
                            }
                          }}
                          className={`p-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${connectingSourceId ? 'bg-indigo-600 text-white px-1' : 'text-gray-400 hover:text-gray-700'}`}
                          title={connectingSourceId ? "Select Target" : "Connect diagram line"}
                        >
                          {connectingSourceId ? "TARGET" : "LINK"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Node central content body */}
                  <div 
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      if (connectingSourceId) {
                        handleCompleteConnection(node.id);
                      }
                    }}
                    className="p-2.5 cursor-pointer bg-white"
                  >
                    <h4 className="text-xs font-bold text-gray-800 truncate leading-tight mb-0.5">{node.title}</h4>
                    <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed mb-1.5">{node.description}</p>
                    
                    <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-100">
                      <span className="text-[8px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold max-w-[85px] truncate uppercase">
                        {node.assigneeRole === 'Approver' ? 'Auditor' : node.assigneeRole}
                      </span>
                      
                      {/* Telemetry Status Dots */}
                      {isCurrentSimulatedStep && (
                        <span className="flex items-center space-x-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-[8px] font-mono text-blue-600 uppercase font-bold tracking-tight">ACTIVE</span>
                        </span>
                      )}

                      {!isCurrentSimulatedStep && matchingTask?.status === 'Completed' && (
                        <span className="text-[8px] font-mono text-emerald-600 font-bold">DONE ✔</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Canvas Bottom Instruction overlay */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/95 border border-gray-200 rounded p-2 flex items-center justify-between text-[10px] text-gray-500 select-none shadow z-10 shrink-0">
            <span className="flex items-center space-x-1.5">
              <span className="font-mono text-[10px] text-indigo-600 font-bold tracking-tight">TIPS:</span>
              <span>• Drag headers to reposition cards.</span>
              <span>• Click 'LINK' then a target card to map flow pathways.</span>
              <span>• Select node to modify details.</span>
            </span>
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <span className="h-2.5 w-2.5 rounded border border-gray-200 bg-white" />
                <span>Human Task</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="h-2.5 w-2.5 rounded border border-purple-200 bg-purple-50" />
                <span>AI Agent</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="h-2.5 w-2.5 rounded border border-orange-200 bg-orange-50" />
                <span>Decision</span>
              </span>
            </div>
          </div>
        </section>

        {/* Right Side Pane: Split Portal Props Panel */}
        <section className="w-full xl:w-[380px] shrink-0 bg-white flex flex-col h-auto xl:h-[calc(100vh-56px)] overflow-y-auto overflow-x-hidden border-t xl:border-t-0 xl:border-l border-gray-200 props-panel">
          
          {/* Section 1: Detailed Selected Node Properties Editor */}
          <div className="p-4 select-none bg-gray-50/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5 text-indigo-600" /> Node Inspector
              </span>
              {selectedNodeId && (
                <button 
                  onClick={() => setSelectedNodeId(null)}
                  className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center transition-all cursor-pointer"
                  id="btn_close_node_inspector"
                >
                  Deselect
                </button>
              )}
            </div>

            {/* If node is selected, show robust editable fields */}
            {selectedNodeId && selectedTemplate ? (() => {
              const node = selectedTemplate.nodes.find(n => n.id === selectedNodeId);
              if (!node) return <p className="text-slate-500 text-xs">Node configuration unavailable.</p>;

              return (
                <div className="space-y-2.5" id="node_inspector_form">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded font-bold uppercase">{node.type}</span>
                    <span className="font-mono text-[9px] text-gray-400">ID: {node.id}</span>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Title</label>
                    <input 
                      type="text" 
                      value={node.title} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTemplate(prev => prev ? {
                          ...prev,
                          nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, title: val } : n)
                        } : null);
                      }}
                      className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-xs text-gray-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Description</label>
                    <textarea 
                      rows={2}
                      value={node.description} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTemplate(prev => prev ? {
                          ...prev,
                          nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, description: val } : n)
                        } : null);
                      }}
                      className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-xs text-gray-800 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Assignee Role</label>
                      <select 
                        value={node.assigneeRole}
                        onChange={(e) => {
                          const val = e.target.value as Role;
                          setSelectedTemplate(prev => prev ? {
                            ...prev,
                            nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, assigneeRole: val } : n)
                          } : null);
                        }}
                        className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 rounded p-1.5 text-xs text-gray-800 focus:outline-none cursor-pointer"
                      >
                        <option value="Employee">Employee</option>
                        <option value="Manager">Manager</option>
                        <option value="Approver">Executive Auditor (Approver)</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>

                    <div className="flex items-end justify-end">
                      <button 
                        onClick={() => handleDeleteNode(node.id)}
                        className="w-full flex items-center justify-center space-x-1 text-xs bg-red-50 border border-red-150 hover:bg-red-600 text-red-600 hover:text-white py-1.5 rounded cursor-pointer transition-all active:scale-95"
                        id="btn_delete_selected_node"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Card</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">
                      {node.type === 'AI_Agent' ? 'Automation / Parsing Criteria' : 'Completion Criteria / Prompt Goals'}
                    </label>
                    <textarea 
                      rows={2.5}
                      value={node.completionCriteria} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTemplate(prev => prev ? {
                          ...prev,
                          nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, completionCriteria: val } : n)
                        } : null);
                      }}
                      placeholder="Input prompt goals..."
                      className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-xs text-gray-800 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              );
            })() : (
              <div className="border border-gray-200 bg-gray-50/50 rounded p-4 text-center">
                <HelpCircle className="h-5 w-5 text-gray-400 mx-auto mb-1.5" />
                <p className="text-xs text-gray-700 font-semibold leading-relaxed">No diagram item selected</p>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">Select any Node card on the canvas layout to specify prompts, responsible role levels, and transition criteria.</p>
              </div>
            )}
          </div>
        </section>
        </>
      ) : activeView === 'tasks' ? (
        <>
          {/* Left Side: Active User Portal (Isolated and Expanded) */}
          <section className="flex-1 flex flex-col bg-[#F8F9FA] relative overflow-y-auto p-4 md:p-6 lg:p-8 h-auto xl:h-[calc(100vh-56px)] min-h-[450px]">
            <div className="max-w-4xl mx-auto w-full space-y-6">
              
              {/* Consolidated Global Simulation Queue */}
              <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden select-none">
                {/* Header with high contrast red tag accent */}
                <div className="px-4 py-3 bg-[#1A1A1A] text-white flex items-center justify-between border-b border-[#2D2D2D]">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-[#DB1E26]" />
                    <span className="text-[10px] sm:text-[11px] font-black tracking-wider uppercase font-sans">
                      Federated Claims Workspace Queue ({instances.reduce((acc, inst) => acc + inst.tasks.filter(t => t.status === 'Active' || t.status === 'Pending').length, 0)})
                    </span>
                  </div>
                  <span className="text-[9px] bg-[#DB1E26] text-white px-2 py-0.5 font-mono font-bold uppercase rounded-sm">
                    Live Sandbox Queue
                  </span>
                </div>

                {(() => {
                  const allPendingTasks = instances.flatMap(instance => 
                    instance.tasks
                      .filter(t => t.status === 'Active' || t.status === 'Pending')
                      .map(t => ({
                        ...t,
                        instanceId: instance.id,
                        templateName: instance.templateName
                      }))
                  );

                  if (allPendingTasks.length === 0) {
                    return (
                      <div className="text-center p-6 bg-gray-50/40 text-gray-400">
                        <Inbox className="h-5 w-5 mx-auto mb-1 text-gray-300" />
                        <p className="text-xs font-bold font-sans">Queue Empty</p>
                        <p className="text-[10px] mt-0.5 leading-snug font-sans">No pending approval or draft actions are waiting in active instances.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-gray-150 max-h-[220px] overflow-y-auto">
                      {allPendingTasks.map((task) => {
                        const isSelected = activeInstanceId === task.instanceId && userRole === task.assigneeRole;
                        return (
                          <div 
                            key={`${task.instanceId}-${task.id}`} 
                            className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
                              isSelected ? 'bg-indigo-50/50 border-l-2 border-indigo-600' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2 flex-wrap gap-1">
                                <span className="font-mono text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-sm uppercase">
                                  Run: {task.instanceId.slice(0, 8)}
                                </span>
                                <span className="text-[10px] text-gray-400 font-sans tracking-tight">
                                  ({task.templateName})
                                </span>
                                
                                <span className={`text-[8.5px] font-mono uppercase font-bold px-1.5 py-0.2 rounded ${
                                  task.assigneeRole === 'Employee' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                  task.assigneeRole === 'Manager' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                  task.assigneeRole === 'Approver' ? 'bg-emerald-50 text-emerald-850 border border-emerald-100' :
                                  'bg-purple-50 text-purple-750 border border-purple-100'
                                }`}>
                                  {task.assigneeRole}
                                </span>
                              </div>
                              <h5 className="font-bold text-gray-800 tracking-tight">{task.title}</h5>
                              <p className="text-[10.5px] text-gray-500 leading-normal line-clamp-1">{task.description}</p>
                            </div>

                            <button
                              onClick={() => {
                                setActiveInstanceId(task.instanceId);
                                setUserRole(task.assigneeRole);
                                showToast("Workspace Synced", `SSO swapped to [${task.assigneeRole}] to work on run [${task.instanceId.slice(0, 8)}].`);
                              }}
                              className={`px-3 py-1.5 rounded-sm text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-all shrink-0 ${
                                isSelected 
                                  ? 'bg-[#DB1E26] text-white font-black hover:bg-[#b0161d]' 
                                  : 'bg-white border border-gray-300 text-gray-750 hover:border-[#DB1E26] hover:text-[#DB1E26]'
                              }`}
                            >
                              {isSelected ? 'CURRENT ACTIVE' : 'CLAIM & WORK'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Section 2: Active User Portal (IMPERSONATION MODE) */}
          <div className="p-4 flex flex-col h-auto">
            <div className="flex items-center justify-between mb-3.5 select-none">
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-600" /> USER PORTAL: {userRole.toUpperCase()}
              </span>
              <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded font-bold uppercase">Simulator Active</span>
            </div>

            {/* Check if active instanced run is present */}
            {activeInstance ? (() => {
              // Retrieve tasks matching currently impersonated user role that require input
              const tasksForSimRole = activeInstance.tasks.filter(
                t => t.assigneeRole === userRole && (t.status === 'Active' || t.status === 'Pending')
              );

              if (tasksForSimRole.length === 0) {
                return (
                  <div className="border border-gray-200 bg-gray-50/50 p-4 rounded text-center select-none shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-gray-700">Queue Clear</p>
                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                      No pending tasks for simulated level <span className="font-mono text-gray-800 bg-gray-100 px-1 py-0.5 rounded">[{userRole}]</span> in run ID <span className="font-mono text-gray-850 font-bold">[{activeInstance.id.slice(0, 8)}]</span>.
                    </p>
                    {activeInstance.currentNodeId ? (
                      <p className="text-[10px] text-indigo-600 mt-2 font-mono font-semibold">
                        Workflow held on step: {selectedTemplate?.nodes.find(n => n.id === activeInstance.currentNodeId)?.title || activeInstance.currentNodeId}
                      </p>
                    ) : (
                      <p className="text-[10px] text-emerald-600 mt-2 font-mono font-bold">Workflow Completed Successfully! 🎉</p>
                    )}
                  </div>
                );
              }

              // Take the first actionable task for this role
              const currentActionableTask = tasksForSimRole[0];
              const correspondingTemplateNode = selectedTemplate?.nodes.find(n => n.id === currentActionableTask.nodeId);

              // Extract conditions / branch choices outgoing from this task node
              const outgoingPaths = selectedTemplate?.edges.filter(e => e.source === currentActionableTask.nodeId) || [];

              return (
                <div className="border border-gray-200 bg-white p-3.5 rounded space-y-3 shadow-sm" id="active_workspace_task">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] text-indigo-600 uppercase font-mono tracking-wider font-bold">Action Item Assigned</span>
                      <h4 className="text-xs font-bold text-gray-900 mt-0.5">{currentActionableTask.title}</h4>
                      <p className="text-[11px] text-gray-600 mt-1 leading-normal">{currentActionableTask.description}</p>
                    </div>
                  </div>

                  {/* Completion criteria instructions panel */}
                  {correspondingTemplateNode?.completionCriteria && (
                    <div className="bg-[#F8FAFC] p-2.5 rounded border border-gray-100">
                      <span className="text-[8px] font-mono text-indigo-600 font-bold block uppercase tracking-wider mb-0.5 font-sans">Target Guidelines:</span>
                      <p className="text-[10px] text-gray-600 leading-normal font-sans whitespace-pre-wrap">{correspondingTemplateNode.completionCriteria}</p>
                    </div>
                  )}

                  {/* Submission Work Inputs */}
                  <div className="space-y-2.5">
                    {/* Raw context proposal content input */}
                    {userRole === 'Employee' && (
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Proposal Pitch Draft Text</label>
                        <textarea 
                          rows={3.5}
                          value={reportInput}
                          onChange={(e) => setReportInput(e.target.value)}
                          placeholder="Type or paste marketing concepts here. Include budget metrics (e.g., Total budget estimates are $5,800)."
                          className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded p-2 text-xs text-gray-800 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Generic Comment string */}
                    <div>
                      <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">
                        {userRole === 'Employee' ? 'Audit Comments & Notes' : 'Reviewer Action Comments'}
                      </label>
                      <input 
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Provide commentary or guidelines..."
                        className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded p-2 text-xs text-gray-800 focus:outline-none"
                      />
                    </div>

                    {/* Decisions selection block (If branching criteria paths exist) */}
                    {outgoingPaths.length > 0 && (
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1 font-bold">Choose Decision Pathway</label>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          {outgoingPaths.map((path) => {
                            const label = path.condition || "Next Step";
                            const isChosen = selectedDecisionOption === label;
                            return (
                              <button
                                key={path.id}
                                type="button"
                                onClick={() => setSelectedDecisionOption(label)}
                                className={`text-left p-1.5 rounded border text-[11px] leading-tight cursor-pointer transition-all ${isChosen ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Submit handler trigger */}
                    <button
                      onClick={() => handleTaskSubmit(currentActionableTask.id)}
                      disabled={isSubmittingTask || (userRole === 'Employee' && !reportInput.trim()) || (outgoingPaths.length > 0 && !selectedDecisionOption)}
                      className="w-full bg-indigo-600 hover:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs py-2 px-3 rounded flex items-center justify-center space-x-1.5 transition-all cursor-pointer font-sans"
                      id="btn_submit_human_task"
                    >
                      <span>{isSubmittingTask ? 'PROCESSING...' : 'SUBMIT WORK'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })() : (
              <p className="text-[10px] text-gray-400 text-center py-8 bg-gray-50/40 border border-dashed border-gray-200 rounded">Spawn simulation instance run from the top bar first.</p>
            )}
            </div>
            </div>
          </section>

          {/* Right Side: Simulated System Monitors and Logs */}
          <section className="w-full xl:w-[420px] shrink-0 bg-white flex flex-col border-t xl:border-t-0 xl:border-l border-gray-200 h-auto xl:h-[calc(100vh-56px)] overflow-y-auto overflow-x-hidden select-none">
            {/* Section 3: Simulated System Monitors and Logs View Terminal */}
            <div className="flex-1 flex flex-col bg-[#F8FAFC] min-h-[300px]">
            {/* Monitor Navigation Tabs */}
            <div className="flex border-b border-gray-200 bg-white select-none">
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 text-center py-2 font-sans text-[10px] font-bold tracking-wider flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${activeTab === 'history' ? 'border-indigo-600 text-indigo-700 bg-gray-50/30' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
                id="btn_tab_history"
              >
                <History className="h-3.5 w-3.5" />
                <span>EXECUTION LOG</span>
              </button>

              <button 
                onClick={() => setActiveTab('aiTelemetry')}
                className={`flex-1 text-center py-2 font-sans text-[10px] font-bold tracking-wider flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${activeTab === 'aiTelemetry' ? 'border-purple-600 text-purple-700 bg-gray-50/30' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
                id="btn_tab_ai_telemetry"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>AI PROMPT GRAPH ANALYSIS</span>
              </button>
            </div>

            {/* Scrollable Panel content */}
            <div className="flex-1 p-3.5 overflow-y-auto max-h-[380px]">
              
              {/* Tab 1: Workflow instanced run history */}
              {activeTab === 'history' && (
                <div className="space-y-3" id="history_log_panel">
                  {activeInstance && activeInstance.history.length > 0 ? (
                    <div className="relative border-l border-gray-200 ml-2 pl-4 space-y-3.5">
                      {activeInstance.history.map((hist) => {
                        let dotColor = "bg-gray-400";
                        if (hist.performedBy === "AI Orchestrator" || hist.performedBy === "AI Agent") {
                          dotColor = "bg-purple-600 ring-2 ring-purple-100";
                        } else if (hist.action.includes("Feedback") || hist.action.includes("Transition")) {
                          dotColor = "bg-blue-500 ring-2 ring-blue-100";
                        } else if (hist.action.includes("Initialized") || hist.action.includes("Launch")) {
                          dotColor = "bg-emerald-500 ring-2 ring-emerald-100";
                        }
                        return (
                          <div key={hist.id} className="relative group text-xs text-gray-700">
                            {/* History marker dot */}
                            <span className={`absolute -left-[21px] top-1 h-1.5 w-1.5 rounded-full ${dotColor}`} />
                            
                            <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono mb-0.5">
                              <span className="font-bold text-gray-500">{hist.performedBy}</span>
                              <span>{hist.timestamp ? new Date(hist.timestamp).toLocaleTimeString() : ""}</span>
                            </div>

                            <h5 className="font-bold text-gray-800 tracking-tight">{hist.action} {hist.nodeTitle ? `[${hist.nodeTitle}]` : ""}</h5>
                            <p className="text-gray-500 text-[10px] leading-relaxed mt-0.5 font-sans">{hist.summary}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-6">
                      <Clock className="h-5 w-5 mx-auto mb-1 opacity-40" />
                      <p className="text-xs">Timeline registers empty.</p>
                      <p className="text-[10px] text-gray-400 leading-snug">Run a workflow simulation step to observe runtime traces.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Raw AI Prompt and Parsing Analysis */}
              {activeTab === 'aiTelemetry' && (
                <div className="space-y-3" id="ai_telemetry_terminal">
                  {agentLogs.length > 0 ? (
                    agentLogs.filter(log => log.instanceId === activeInstanceId).map((log) => {
                      return (
                        <div key={log.id} className="bg-white border border-gray-200 rounded p-2.5 space-y-2 font-mono text-[9px] text-gray-700 shadow-sm">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1 select-none">
                            <span className="flex items-center space-x-1 text-purple-700 font-bold">
                              <Bot className="h-3.5 w-3.5 text-purple-600" />
                              <span className="font-bold uppercase tracking-wider">Type: {log.promptType}</span>
                            </span>
                            <span className="text-[9px] text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>

                          <div>
                            <span className="text-gray-400 font-bold block uppercase mb-0.5">Activity Location:</span>
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-700 font-sans font-semibold">{log.nodeTitle} (Node: {log.nodeId})</span>
                          </div>

                          <div>
                            <span className="text-gray-400 font-bold block uppercase mb-0.5">Data Input Context Object:</span>
                            <pre className="bg-[#F8FAFC] border border-gray-100 p-1.5 rounded text-gray-600 text-[9px] overflow-x-auto select-all max-h-24">
                              {JSON.stringify(log.inputData, null, 2)}
                            </pre>
                          </div>

                          <div>
                            <span className="text-gray-400 font-bold block uppercase mb-0.5">Gemini Response Log:</span>
                            <pre className="bg-[#F8FAFC] border border-gray-150 p-1.5 rounded text-gray-800 text-[9px] overflow-x-auto max-h-28">
                              {JSON.stringify(log.aiResponse, null, 2)}
                            </pre>
                          </div>

                          {/* highlight reasoning */}
                          {log.aiResponse?.thought && (
                            <div className="bg-purple-50/50 border border-purple-100 p-2 rounded text-[10px] text-purple-800 font-sans leading-relaxed">
                              <strong>Orchestrator Thought:</strong> {log.aiResponse.thought}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-gray-400 py-6">
                      <Cpu className="h-5 w-5 mx-auto mb-1 text-purple-500/50 animate-pulse" />
                      <p className="text-xs">Prompt telemetry dormant.</p>
                      <p className="text-[10px] text-gray-400">Trigger AI decision-gates or handoffs to view live structured logic logs.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
          </section>
        </>
      ) : (
        <section className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6 lg:p-10 select-none max-w-5xl mx-auto w-full">
          {/* Header block with HSBC premium spacing */}
          <div className="border-b border-gray-200 pb-5 mb-8">
            <div className="flex items-center space-x-2.5 bg-red-105 text-[#DB1E26] border border-red-200 px-3 py-1 rounded-sm w-fit text-[10px] font-mono font-bold uppercase tracking-widest mb-3.5">
              <span className="h-2 w-2 rounded-full bg-[#DB1E26] animate-pulse" />
              <span>SYS.MANUAL // LEVEL-A GENERAL CLEARANCE</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight font-sans">
              HSBC HexaFlow Guidance Hub & Feature Manual
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed font-sans">
              Explore the system modules, design methodologies, autonomous routing mechanisms, and federated SSO clearances of the HexaFlow decision-chain simulation sandbox.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Design Workspace */}
            <div className="bg-white border border-gray-200 p-5 rounded-sm shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="bg-indigo-50 text-indigo-750 p-2.5 rounded-sm w-fit animate-pulse">
                <Layers className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider font-sans">
                1. Diagram Designer & Canvas
              </h3>
              <p className="text-xs text-gray-650 leading-relaxed font-sans">
                Build and modify enterprise decision-pathway templates dynamically. Drop custom workflow steps represented as visual node cards.
              </p>
              <ul className="text-[11px] text-gray-500 space-y-1.5 list-disc pl-4 leading-normal font-sans">
                <li><strong className="text-gray-750">Add Nodes:</strong> Standardized Tasks, Routing Decisions, AI Agents, or executive Role Handoff cards.</li>
                <li><strong className="text-gray-750">Link Transitions:</strong> Connect nodes by designating origin and destination cards, alongside conditional labels (e.g., <code className="font-mono bg-gray-100 px-1 font-bold">Approve</code>).</li>
                <li><strong className="text-indigo-650 font-bold">Metadata Customizer:</strong> Click any canvas node to specify target completion criteria instructions and role delegations.</li>
              </ul>
            </div>

            {/* 2. Versioning & Snapshots */}
            <div className="bg-white border border-gray-200 p-5 rounded-sm shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="bg-red-50 text-[#DB1E26] p-2.5 rounded-sm w-fit animate-pulse">
                <History className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider font-sans">
                2. Version Control & Revisions
              </h3>
              <p className="text-xs text-gray-650 leading-relaxed font-sans">
                Manage layout version history. Track updates and instantly restore the workflow configurations to baseline or custom snapshots.
              </p>
              <ul className="text-[11px] text-gray-500 space-y-1.5 list-disc pl-4 leading-normal font-sans">
                <li><strong className="text-gray-750">Commit Layouts:</strong> Enter a specific incremented version target and revision log note to freeze the configuration.</li>
                <li><strong className="text-gray-750">Audit History:</strong> Each template retains a distinct immutable list of published historical snapshots.</li>
                <li><strong className="text-[#DB1E26] font-bold">Instant Rollback:</strong> Swap the revision dropdown to reload corresponding positions, links, and prompts dynamically.</li>
              </ul>
            </div>

            {/* 3. Autonomous AI Orchestration */}
            <div className="bg-white border border-gray-200 p-5 rounded-sm shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="bg-purple-50 text-purple-700 p-2.5 rounded-sm w-fit animate-pulse">
                <Bot className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider font-sans">
                3. Autonomous Agent Simulation
              </h3>
              <p className="text-xs text-gray-655 leading-relaxed font-sans">
                Learn how the background orchestrator processes data streams and routes tasks using Gemini.
              </p>
              <ul className="text-[11px] text-gray-500 space-y-1.5 list-disc pl-4 leading-normal font-sans">
                <li><strong className="text-gray-750">Numerical & Structured Synthesizers:</strong> The AI Agent scans prior task summaries to evaluate risk scores and recommend approval paths.</li>
                <li><strong className="text-gray-750">AI Routing Gateway:</strong> The Decision node queries the model dynamically to direct paths according to extracted budget thresholds.</li>
                <li><strong className="text-purple-750 font-bold">Zero-Trust Peer Audit:</strong> Active human submissions automatically fire background audit tasks to evaluate and suggest corrections.</li>
              </ul>
            </div>

            {/* 4. Federated Queue & Claims */}
            <div className="bg-white border border-gray-200 p-5 rounded-sm shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="bg-orange-50 text-orange-700 p-2.5 rounded-sm w-fit animate-pulse">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider font-sans">
                4. Federated Queue & Claims Workspace
              </h3>
              <p className="text-xs text-gray-655 leading-relaxed font-sans">
                Execute work streams and claim pending tasks across all concurrent instanced simulations.
              </p>
              <ul className="text-[11px] text-gray-500 space-y-1.5 list-disc pl-4 leading-normal font-sans">
                <li><strong className="text-gray-750">Claims Queue:</strong> View a consolidated, split-out dashboard of all pending steps (active/pending status) from all active sessions.</li>
                <li><strong className="text-gray-750">Role Impersonation:</strong> Tap <code className="font-mono bg-gray-100 px-1 font-bold">CLAIM & WORK</code> to auto-select the required instance, swap permissions, and slide the inputs form.</li>
                <li><strong className="text-orange-600 font-bold">Simulated Real-time Monitors:</strong> Audit real-time agent thoughts, history events, and logging queues on the right-hand panel.</li>
              </ul>
            </div>
          </div>

          {/* Quick FAQ Walkthrough block with deep gray visual accents */}
          <div className="mt-8 bg-slate-100/60 border border-gray-200 rounded-sm p-5 space-y-3">
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <HelpCircle className="h-4 w-4 text-gray-500" /> Frequently Asked Operational Questions
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11.5px] text-gray-650 font-sans">
              <div className="space-y-1">
                <p className="font-bold text-gray-800">Q: How do I test the full branching PR budget pipeline?</p>
                <p className="leading-relaxed">A: Go to Task Workspace, claim the employee draft. Submitting a budget under $5,000 routes to Manager. Submitting over $5,000 routes to VP Executive Auditor.</p>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-gray-800">Q: How do changes persist across sessions?</p>
                <p className="leading-relaxed">A: Press "SAVE BLUEPRINT" to save active draft positions, or use "COMMIT" to capture formal revisions inside the template history registry.</p>
              </div>
            </div>
          </div>
        </section>
      )}
      </main>

      {/* FOOTER NOTIFICATION TICKER */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-2.5 flex items-center justify-between text-[11px] text-slate-400 z-10 select-none">
        <div className="flex items-center space-x-2">
          <Activity className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
          <span className="font-mono text-[9px] tracking-wider uppercase font-bold text-gray-400">Stream Status:</span>
          {activeInstance ? (
            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono text-[9px] font-bold">
              {activeInstance.id.slice(0, 8)} ({activeInstance.templateName})
            </span>
          ) : (
            <span className="text-gray-400 text-[9px] font-mono">Dormant</span>
          )}
        </div>
        <div className="flex items-center space-x-3 text-gray-400 text-[9px]">
          <span>Engine: <strong className="text-emerald-600 font-bold">Autonomous Active</strong></span>
          <span>•</span>
          <span>Core Model: <strong className="text-purple-600 font-mono font-bold">gemini-2.5-flash</strong></span>
        </div>
      </footer>

      {/* NODE CREATOR MODAL FORM */}
      {showAddNodeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
          <div className="bg-white border border-gray-200 rounded p-4.5 space-y-3.5 shadow-xl max-w-sm w-full animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gray-900">Add Workflow Diagram Card</h3>
              <button 
                onClick={() => setShowAddNodeModal(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Card Functionality Focus</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Task', 'AI_Agent', 'Decision', 'Role_Handoff'] as NodeType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setNewNodeType(type)}
                      className={`py-1 px-1.5 rounded border text-[10px] text-center leading-snug cursor-pointer transition-all ${newNodeType === type ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-[#F8FAFC] border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                    >
                      {type === 'AI_Agent' ? 'AI Bot' : type === 'Role_Handoff' ? 'Handoff' : type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Node Title</label>
                <input 
                  type="text" 
                  value={newNodeTitle}
                  onChange={(e) => setNewNodeTitle(e.target.value)}
                  placeholder="e.g., Audit Cost Spreadsheet"
                  className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-xs text-gray-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Description</label>
                <input 
                  type="text" 
                  value={newNodeDesc}
                  onChange={(e) => setNewNodeDesc(e.target.value)}
                  placeholder="e.g., Translates draft documents to verify margin totals."
                  className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-xs text-gray-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Responsible Participant Role</label>
                <select 
                  value={newNodeRole}
                  onChange={(e) => setNewNodeRole(e.target.value as Role)}
                  className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 rounded p-1.5 text-xs text-gray-800 focus:outline-none cursor-pointer"
                >
                  <option value="Employee">Employee</option>
                  <option value="Manager">Manager</option>
                  <option value="Approver">Executive Auditor (Approver)</option>
                  <option value="Admin">System Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase text-gray-500 mb-0.5 font-bold">Completion Prompt Guidelines</label>
                <textarea 
                  rows={2}
                  value={newNodeCriteria}
                  onChange={(e) => setNewNodeCriteria(e.target.value)}
                  placeholder="Insert instructions for the evaluator model context..."
                  className="w-full bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-xs text-gray-800 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2.5 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddNodeModal(false)}
                className="flex-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 text-xs py-1.5 rounded transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNewNode}
                disabled={!newNodeTitle.trim()}
                className="flex-1 bg-indigo-600 hover:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs py-1.5 rounded transition-all cursor-pointer"
              >
                Add Node to Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
