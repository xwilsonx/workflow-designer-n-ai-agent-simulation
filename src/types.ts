export type Role = 'Employee' | 'Manager' | 'Approver' | 'Admin';

export type NodeType = 'Task' | 'Decision' | 'AI_Agent' | 'Role_Handoff';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  assigneeRole: Role;
  completionCriteria: string; // Instructions or what needs to be fulfilled
  x: number;
  y: number;
  config?: {
    // For AI Agent
    aiPrompt?: string;
    // For Decision
    decisionPathways?: { condition: string; targetNodeId: string }[];
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string; // e.g. "Approved", "Rejected", or a generic outcome
}

export interface WorkflowVersion {
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  timestamp: string;
  description: string;
  author: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  version?: string;
  versionDescription?: string;
  historyVersions?: WorkflowVersion[];
}

export interface WorkflowHistory {
  id: string;
  timestamp: string;
  nodeId: string | null;
  nodeTitle?: string;
  action: string;
  summary: string;
  performedBy: string; // Role name or 'AI Orchestrator' or 'System'
}

export interface TaskInstance {
  id: string;
  nodeId: string;
  title: string;
  description: string;
  assigneeRole: Role;
  status: 'Pending' | 'Active' | 'Submitted' | 'Processing_AI' | 'Approved' | 'Returned_For_Revision' | 'Completed';
  submittedBy?: Role;
  submittedAt?: string;
  completionData?: {
    reportText?: string;
    fileName?: string;
    fileContent?: string;
    comment?: string;
  };
  aiEvaluation?: {
    thought: string;
    decision: string; // e.g., "approve", "reject", "complete_task"
    nextNodeId?: string;
    assignedRole?: Role;
    suggestedFeedback?: string;
  };
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  templateName: string;
  status: 'active' | 'completed' | 'failed';
  currentNodeId: string | null;
  history: WorkflowHistory[];
  tasks: TaskInstance[];
  contextData: {
    lastComment?: string;
    aiDecision?: string;
    [key: string]: any;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  role: Role;
  instanceId: string;
  taskId?: string;
  read: boolean;
}
