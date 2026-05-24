import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  WorkflowTemplate, 
  WorkflowInstance, 
  NodeType, 
  Role, 
  WorkflowNode, 
  WorkflowEdge, 
  TaskInstance, 
  NotificationItem, 
  WorkflowHistory 
} from "./src/types.js"; // Standard TS file path

// Ensure secret variables are loaded
dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// In-Memory Data Storage
let templates: WorkflowTemplate[] = [];
let instances: WorkflowInstance[] = [];
let notifications: NotificationItem[] = [];

// Track AI reasoning steps for client audit log
interface AgentLog {
  id: string;
  timestamp: string;
  instanceId: string;
  nodeId: string | null;
  nodeTitle: string;
  promptType: "Automation" | "Decision" | "Audit";
  inputData: any;
  aiResponse: any;
}
let agentLogs: AgentLog[] = [];

// Helper to push system notifications
function sendNotification(role: Role, title: string, message: string, instanceId: string, taskId?: string) {
  const newNotif: NotificationItem = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title,
    message,
    timestamp: new Date().toISOString(),
    role,
    instanceId,
    taskId,
    read: false,
  };
  notifications.unshift(newNotif);
}

// Helper to append history
function addHistory(
  instance: WorkflowInstance,
  nodeId: string | null,
  nodeTitle: string | undefined,
  action: string,
  summary: string,
  performedBy: string
) {
  const historyItem: WorkflowHistory = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    nodeId,
    nodeTitle,
    action,
    summary,
    performedBy,
  };
  instance.history.push(historyItem);
}

// DEFAULT SEED DATA
const defaultTemplate: WorkflowTemplate = {
  id: "temp_marketing",
  name: "PR Campaign & Budget Approval",
  description: "An AI-enhanced pipeline where employees submit PR pitches, the AI generates a budget summary, and branches workflow to corresponding roles based on cost criteria.",
  createdAt: new Date().toISOString(),
  nodes: [
    {
      id: "node_1",
      type: "Task",
      title: "Write PR Campaign Draft",
      description: "Draft a high-level marketing pitch with target details and specified expenditures.",
      assigneeRole: "Employee",
      completionCriteria: "Include campaign description, targets, and estimated budget line items.",
      x: 100,
      y: 160,
    },
    {
      id: "node_2",
      type: "AI_Agent",
      title: "AI Campaign Risk & Budget Summarizer",
      description: "Automated agent that analyzes the submitted text, extracts budget cost, and assesses risk level.",
      assigneeRole: "Admin",
      completionCriteria: "Review employee submissions and synthesize budget factors.",
      x: 340,
      y: 160,
    },
    {
      id: "node_3",
      type: "Decision",
      title: "Budget Threshold Audit Router",
      description: "AI reads summary to direct workflow: Under-Budget goes to Manager, Over-Budget routes to VP Approver.",
      assigneeRole: "Admin",
      completionCriteria: "Evaluate extracted budget against a $5,000 corporate limit.",
      x: 580,
      y: 160,
    },
    {
      id: "node_4",
      type: "Task",
      title: "Manager Campaign Approval",
      description: "Standard Review: Manager reviews the proposal and the AI summarize feedback.",
      assigneeRole: "Manager",
      completionCriteria: "Determine operational feasibility; choose to Approve or Request Revision.",
      x: 820,
      y: 50,
    },
    {
      id: "node_5",
      type: "Task",
      title: "VP Executive Audit",
      description: "High-value review: VP Auditor conducts financial vetting for budgets exceeding threshold.",
      assigneeRole: "Approver",
      completionCriteria: "Determine strategic compliance; choose to Approve or Request Revision.",
      x: 820,
      y: 280,
    },
    {
      id: "node_6",
      type: "Role_Handoff",
      title: "Consolidated Signoff & Integration",
      description: "Administrative closure to file approved campaign and publish details.",
      assigneeRole: "Admin",
      completionCriteria: "Complete the pipeline successfully.",
      x: 1060,
      y: 160,
    },
  ],
  edges: [
    { id: "e1-2", source: "node_1", target: "node_2" },
    { id: "e2-3", source: "node_2", target: "node_3" },
    { id: "e3-4", source: "node_3", target: "node_4", condition: "Under Budget (<= $5,000)" },
    { id: "e3-5", source: "node_3", target: "node_5", condition: "Over Budget (> $5,000)" },
    { id: "e4-6", source: "node_4", target: "node_6", condition: "Approve" },
    { id: "e4-1", source: "node_4", target: "node_1", condition: "Request Revision" },
    { id: "e5-6", source: "node_5", target: "node_6", condition: "Approve" },
    { id: "e5-1", source: "node_5", target: "node_1", condition: "Request Revision" },
  ],
};

const securityTemplate: WorkflowTemplate = {
  id: "temp_security",
  name: "IT Security Access Clearance",
  description: "An automated IAM and network privilege approval pipeline. AI scans requested protocols for security policy compliance and routes access clearance dynamically based on privilege levels.",
  createdAt: new Date().toISOString(),
  nodes: [
    {
      id: "node_sec_1",
      type: "Task",
      title: "Submit Port Access Request",
      description: "Specify target databases, required port authorizations, and justification summary.",
      assigneeRole: "Employee",
      completionCriteria: "List specific development ports, production nodes or master server elements.",
      x: 100,
      y: 160,
    },
    {
      id: "node_sec_2",
      type: "AI_Agent",
      title: "AI Ports & Policy Auditor",
      description: "Automated agent that scans privilege requests for high-risk flags (root access, SSH production, untracked IP ranges).",
      assigneeRole: "Admin",
      completionCriteria: "Review request text and output security exposure ratings and recommended gateways.",
      x: 340,
      y: 160,
    },
    {
      id: "node_sec_3",
      type: "Decision",
      title: "Security Risk Evaluator Router",
      description: "AI routes workflow dynamically: Low Risk to Tech Lead Manager, High Risk to VP SecOps Auditor.",
      assigneeRole: "Admin",
      completionCriteria: "Direct pathways based on access to production master databases or ports above standard bounds.",
      x: 580,
      y: 160,
    },
    {
      id: "node_sec_4",
      type: "Task",
      title: "Manager Operational Signoff",
      description: "Line review: Approve development stack clearance and verify standard business requirement.",
      assigneeRole: "Manager",
      completionCriteria: "Analyze risk and choose to approve access or request details revision.",
      x: 820,
      y: 50,
    },
    {
      id: "node_sec_5",
      type: "Task",
      title: "VP SecOps Sovereign Audit",
      description: "Strategic risk review: Executive verification of SSH keys or master production server exposure.",
      assigneeRole: "Approver",
      completionCriteria: "Sovereign authentication; determine organizational policy fit. Choose to Approve or Reject.",
      x: 820,
      y: 280,
    },
    {
      id: "node_sec_6",
      type: "Role_Handoff",
      title: "IAM Provisioning Key Dispatch",
      description: "Automatic IAM token generation and secure server key pairs distribution.",
      assigneeRole: "Admin",
      completionCriteria: "Complete credentials dispatch and record zero-trust access tokens in database.",
      x: 1060,
      y: 160,
    },
  ],
  edges: [
    { id: "esec1-2", source: "node_sec_1", target: "node_sec_2" },
    { id: "esec2-3", source: "node_sec_2", target: "node_sec_3" },
    { id: "esec3-4", source: "node_sec_3", target: "node_sec_4", condition: "Low Risk (Standard Dev/Test Port)" },
    { id: "esec3-5", source: "node_sec_3", target: "node_sec_5", condition: "High Risk (Production Root)" },
    { id: "esec4-6", source: "node_sec_4", target: "node_sec_6", condition: "Approve" },
    { id: "esec4-1", source: "node_sec_4", target: "node_sec_1", condition: "Request Revision" },
    { id: "esec5-6", source: "node_sec_5", target: "node_sec_6", condition: "Approve" },
    { id: "esec5-1", source: "node_sec_5", target: "node_sec_1", condition: "Request Revision" },
  ],
};

const invoiceTemplate: WorkflowTemplate = {
  id: "temp_invoice",
  name: "Vendor Contract & Billing Clearance",
  description: "An enterprise finance and payment clearing pipeline. AI parses total expenditures to audit strategic spending limits against a $25,000 threshold.",
  createdAt: new Date().toISOString(),
  nodes: [
    {
      id: "node_inv_1",
      type: "Task",
      title: "Submit Vendor Invoice",
      description: "Upload supplier fee spreadsheets and outline final transaction currency totals.",
      assigneeRole: "Employee",
      completionCriteria: "Highlight noted supplies, retainer hours or contract software license payments.",
      x: 100,
      y: 160,
    },
    {
      id: "node_inv_2",
      type: "AI_Agent",
      title: "AI Ledger Scanner & Matcher",
      description: "Autonomous agent reads the submitted invoice summary, validates ledger lines, and extracts numerical cost values.",
      assigneeRole: "Admin",
      completionCriteria: "Extract currency amounts and match with active legal agreement guidelines.",
      x: 340,
      y: 160,
    },
    {
      id: "node_inv_3",
      type: "Decision",
      title: "Executive Audit Router",
      description: "AI routes billing: Standard amounts to Accounting Manager, Premium tiers to VP CFO Auditor.",
      assigneeRole: "Admin",
      completionCriteria: "Verify extracted invoice total against standard $25,000 operating budget limitation.",
      x: 580,
      y: 160,
    },
    {
      id: "node_inv_4",
      type: "Task",
      title: "Manager Accounting Clearance",
      description: "General approval: Operational lead authorizes immediate supplier invoice payment.",
      assigneeRole: "Manager",
      completionCriteria: "Determine if deliverables match records; approve or request revision.",
      x: 820,
      y: 50,
    },
    {
      id: "node_inv_5",
      type: "Task",
      title: "VP CFO Treasury Vetting",
      description: "Premium review: Board level strategic auditing of large-tier supplier claims.",
      assigneeRole: "Approver",
      completionCriteria: "strategic validation of executive investments: Approve or Deny transaction.",
      x: 820,
      y: 280,
    },
    {
      id: "node_inv_6",
      type: "Role_Handoff",
      title: "Treasury ACH Payout Complete",
      description: "Generate automated ledger wire transfer and print tracking journal logs.",
      assigneeRole: "Admin",
      completionCriteria: "Fulfill automated payout wire and confirm treasury balance settlement.",
      x: 1060,
      y: 160,
    },
  ],
  edges: [
    { id: "einv1-2", source: "node_inv_1", target: "node_inv_2" },
    { id: "einv2-3", source: "node_inv_2", target: "node_inv_3" },
    { id: "einv3-4", source: "node_inv_3", target: "node_inv_4", condition: "Standard Amount (<= $25,000)" },
    { id: "einv3-5", source: "node_inv_3", target: "node_inv_5", condition: "Premium Amount (> $25,000)" },
    { id: "einv4-6", source: "node_inv_4", target: "node_inv_6", condition: "Approve" },
    { id: "einv4-1", source: "node_inv_4", target: "node_inv_1", condition: "Request Revision" },
    { id: "einv5-6", source: "node_inv_5", target: "node_inv_6", condition: "Approve" },
    { id: "einv5-1", source: "node_inv_5", target: "node_inv_1", condition: "Request Revision" },
  ],
};

templates.push(defaultTemplate);
templates.push(securityTemplate);
templates.push(invoiceTemplate);

// Seed version metadata for all baseline templates dynamically
for (const temp of templates) {
  temp.version = "1.0.0";
  temp.versionDescription = "Initial baseline release";
  temp.historyVersions = [
    {
      version: "1.0.0",
      nodes: JSON.parse(JSON.stringify(temp.nodes)),
      edges: JSON.parse(JSON.stringify(temp.edges)),
      timestamp: new Date().toISOString(),
      description: "Initial baseline release",
      author: "HSBC System Architect"
    }
  ];
}

// Seed template response example
const sampleInstance: WorkflowInstance = {
  id: "inst_demo",
  templateId: "temp_marketing",
  templateName: "PR Campaign & Budget Approval",
  status: "active",
  currentNodeId: "node_1",
  history: [
    {
      id: "hist_init",
      timestamp: new Date().toISOString(),
      nodeId: null,
      action: "Workflow Initialized",
      summary: "PR Campaign & Budget Approval run started successfully. Positioned on step: Write PR Campaign Draft.",
      performedBy: "System",
    },
  ],
  tasks: [
    {
      id: "task_1",
      nodeId: "node_1",
      title: "Write PR Campaign Draft",
      description: "Draft a high-level marketing pitch with target details and specified expenditures.",
      assigneeRole: "Employee",
      status: "Active",
    },
  ],
  contextData: {},
};
instances.push(sampleInstance);
sendNotification("Employee", "Project Started", "Draft PR Campaign task is now active in demo instance.", "inst_demo", "task_1");

// Core Engine: AI Workflow Orchestrator
async function orchestrateWorkflow(instanceId: string) {
  const instance = instances.find((i) => i.id === instanceId);
  if (!instance || instance.status !== "active") return;

  const template = templates.find((t) => t.id === instance.templateId);
  if (!template) return;

  let progressionActive = true;

  while (progressionActive) {
    if (!instance.currentNodeId) {
      instance.status = "completed";
      addHistory(instance, null, "Completed", "Workflow Ended", "No current steps active; workflow set to complete.", "Workflow Engine");
      progressionActive = false;
      break;
    }

    const currentNode = template.nodes.find((n) => n.id === instance.currentNodeId);
    if (!currentNode) {
      progressionActive = false;
      break;
    }

    // Identify corresponding active task
    let activeTask = instance.tasks.find((t) => t.nodeId === currentNode.id && t.status === "Active");
    if (!activeTask) {
      // If none active, instantiate it
      activeTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        nodeId: currentNode.id,
        title: currentNode.title,
        description: currentNode.description,
        assigneeRole: currentNode.assigneeRole,
        status: "Active",
      };
      instance.tasks.push(activeTask);
    }

    // 1. HUMAN ASSIGNED TASKS (Wait for submission)
    if (currentNode.type === "Task") {
      // Stop automatic progression, and alert assignee role
      sendNotification(
        currentNode.assigneeRole,
        `Task Assigned: ${currentNode.title}`,
        `Action required for ${instance.templateName}: ${currentNode.description}`,
        instance.id,
        activeTask.id
      );
      progressionActive = false;
      break;
    }

    // 2. AI AGENT AUTONOMOUS NODES
    if (currentNode.type === "AI_Agent") {
      activeTask.status = "Processing_AI";
      addHistory(
        instance,
        currentNode.id,
        currentNode.title,
        "AI Agent Fired",
        "Autonomous AI Agent has started processing completion text.",
        "AI Agent"
      );

      // Extract preceding task completion data to give as input to the AI Agent
      const previousTasks = instance.tasks.filter((t) => t.status === "Submitted" || t.status === "Approved");
      const latestData = previousTasks[previousTasks.length - 1];
      const submittedContent = latestData ? latestData.completionData?.reportText || "No prior submission details." : "No text input context.";

      // Query Gemini
      const gemini = getGeminiClient();
      if (!gemini) {
        // Fallback if no API key
        const fallbackSummary = `[SIMULATED AI RESPONSE] Automated overview generated for draft. Estimated cost extracted: $3,500. Risk classified: Low. Content quality satisfactory.`;
        activeTask.status = "Completed";
        activeTask.completionData = {
          reportText: fallbackSummary,
          comment: "Gemini API key missing. Simulated fallback summary applied.",
        };
        instance.contextData = {
          ...instance.contextData,
          lastComment: "Simulated fallback completed.",
          aiExtractedCost: 3500,
          aiRiskAssessment: "Low",
          aiSummary: fallbackSummary,
        };
        
        addHistory(
          instance,
          currentNode.id,
          currentNode.title,
          "AI Process Complete (Simulated)",
          "Gemini key absent. Applied placeholder analytics summary.",
          "AI Agent"
        );
      } else {
        try {
          const schema = {
            type: Type.OBJECT,
            properties: {
              thought: { type: Type.STRING, description: "Detailed thought process evaluating raw input text and analyzing constraints." },
              summary: { type: Type.STRING, description: "Actionable executive synthesis of the marketing pitch." },
              extractedCost: { type: Type.NUMBER, description: "Extracted dollar cost found in description. Return -1 if not found." },
              riskAssessment: { type: Type.STRING, description: "Assess risk level: Low, Medium, or High based on size and channels." },
              extractedChannels: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Marketing channels mentioned in draft (e.g., email, billboard, social).",
              },
            },
            required: ["thought", "summary", "extractedCost", "riskAssessment"],
          };

          const response = await gemini.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `Conduct AI Agent analysis on the following user marketing draft:\n"${submittedContent}"\n\nTask guidelines & objectives:\n${currentNode.completionCriteria}`,
            config: {
              responseMimeType: "application/json",
              responseSchema: schema,
            },
          });

          const aiResult = JSON.parse(response.text || "{}");
          
          // Log reasoning
          agentLogs.push({
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            instanceId: instance.id,
            nodeId: currentNode.id,
            nodeTitle: currentNode.title,
            promptType: "Automation",
            inputData: { submittedText: submittedContent, criteria: currentNode.completionCriteria },
            aiResponse: aiResult,
          });

          activeTask.status = "Completed";
          activeTask.completionData = {
            reportText: `## AI Orchestrator Summary\n${aiResult.summary}\n\n**Extracted Budget:** $${aiResult.extractedCost !== -1 ? aiResult.extractedCost.toLocaleString() : "Unknown"}\n**Risk Assessment:** ${aiResult.riskAssessment}\n**Identified Channels:** ${aiResult.extractedChannels?.join(", ") || "None"}`,
            comment: aiResult.thought,
          };

          instance.contextData = {
            ...instance.contextData,
            aiExtractedCost: aiResult.extractedCost,
            aiRiskAssessment: aiResult.riskAssessment,
            aiSummary: aiResult.summary,
            aiChannels: aiResult.extractedChannels || [],
          };

          addHistory(
            instance,
            currentNode.id,
            currentNode.title,
            "Autonomous Task Complete",
            `AI completed summary. Extracted Estimated Budget: $${aiResult.extractedCost}. Risk: ${aiResult.riskAssessment}`,
            "AI Agent"
          );
        } catch (error: any) {
          console.error("AI Agent Node Error:", error);
          addHistory(
            instance,
            currentNode.id,
            currentNode.title,
            "AI Agent Failed",
            `Internal AI processing error: ${error.message || "parsing error"}`,
            "System"
          );
        }
      }

      // Transition to the target node of the only edge originating from this Agent Node
      const outgoingEdge = template.edges.find((e) => e.source === currentNode.id);
      if (outgoingEdge) {
        instance.currentNodeId = outgoingEdge.target;
      } else {
        instance.currentNodeId = null;
      }
    }

    // 3. AI STRATEGIC DECISION / ROUTING NODES
    else if (currentNode.type === "Decision") {
      activeTask.status = "Processing_AI";
      addHistory(
        instance,
        currentNode.id,
        currentNode.title,
        "AI Routing Evaluating",
        "AI Decision engine is evaluating parameters against pathway criteria.",
        "AI Orchestrator"
      );

      // Find outbound connected edges
      const outgoingEdges = template.edges.filter((e) => e.source === currentNode.id);
      const pathwaysConfig = outgoingEdges.map((e) => ({
        edgeId: e.id,
        targetNodeId: e.target,
        conditionLabel: e.condition || "Default branch",
      }));

      const budget = instance.contextData.aiExtractedCost || -1;
      const risk = instance.contextData.aiRiskAssessment || "Unknown";
      const summary = instance.contextData.aiSummary || "No context";

      const gemini = getGeminiClient();
      if (!gemini) {
        // Fallback decision routing: Under threshold of $5k -> go to Node 4, else Node 5
        let matchedTarget = pathwaysConfig[0]?.targetNodeId;
        let matchedCondition = pathwaysConfig[0]?.conditionLabel;

        const evaluatedBudget = budget === -1 ? 3500 : budget;
        if (evaluatedBudget > 5000) {
          const overBudget = pathwaysConfig.find((p) => p.conditionLabel.includes("Over") || p.conditionLabel.includes(">"));
          if (overBudget) {
            matchedTarget = overBudget.targetNodeId;
            matchedCondition = overBudget.conditionLabel;
          }
        } else {
          const underBudget = pathwaysConfig.find((p) => p.conditionLabel.includes("Under") || p.conditionLabel.includes("<"));
          if (underBudget) {
            matchedTarget = underBudget.targetNodeId;
            matchedCondition = underBudget.conditionLabel;
          }
        }

        activeTask.status = "Completed";
        instance.currentNodeId = matchedTarget;
        addHistory(
          instance,
          currentNode.id,
          currentNode.title,
          "Route Directed (Simulated)",
          `Simulated routing selected path: '${matchedCondition}' based on estimated budget of $${evaluatedBudget.toLocaleString()}.`,
          "AI Orchestrator"
        );
      } else {
        try {
          const decisionSchema = {
            type: Type.OBJECT,
            properties: {
              thought: { type: Type.STRING, description: "Deep analysis evaluating cost thresholds, risk scores, and matching with outbound targets." },
              selectedCondition: { type: Type.STRING, description: "The condition label matching the selected pathway." },
              selectedTargetNodeId: { type: Type.STRING, description: "The precise targetNodeId representing the decided path." },
            },
            required: ["thought", "selectedCondition", "selectedTargetNodeId"],
          };

          const response = await gemini.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `Identify the correct branching route.
Context Metrics:
- Estimated Budget Cost: $${budget}
- AI Risk Rating: ${risk}
- Concept Summary: ${summary}

Available Branching Pathways:
${JSON.stringify(pathwaysConfig, null, 2)}

Select the outflow target whose criteria description matches the contextual metrics. Standard limit is $5,000.`,
            config: {
              responseMimeType: "application/json",
              responseSchema: decisionSchema,
            },
          });

          const branchResult = JSON.parse(response.text || "{}");

          agentLogs.push({
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            instanceId: instance.id,
            nodeId: currentNode.id,
            nodeTitle: currentNode.title,
            promptType: "Decision",
            inputData: { budget, risk, pathways: pathwaysConfig },
            aiResponse: branchResult,
          });

          // Move onward to the selected path
          activeTask.status = "Completed";
          
          const validEdge = pathwaysConfig.find(p => p.targetNodeId === branchResult.selectedTargetNodeId);
          if (validEdge) {
            instance.currentNodeId = branchResult.selectedTargetNodeId;
            addHistory(
              instance,
              currentNode.id,
              currentNode.title,
              "AI Branch Pathway Resolved",
              `Guided route to next node: '${validEdge.conditionLabel}' (${branchResult.selectedTargetNodeId}) - Insight: ${branchResult.thought}`,
              "AI Orchestrator"
            );
          } else {
            // Outbound edge error fallback
            instance.currentNodeId = pathwaysConfig[0]?.targetNodeId || null;
            addHistory(
              instance,
              currentNode.id,
              currentNode.title,
              "AI Branch Misaligned",
              "AI selected an invalid pathway. Defaulting to first outbound branch.",
              "System"
            );
          }
        } catch (error: any) {
          console.error("AI Routing Node Error:", error);
          instance.currentNodeId = pathwaysConfig[0]?.targetNodeId || null;
          addHistory(
            instance,
            currentNode.id,
            currentNode.title,
            "Decision Failover Done",
            "Failsafe selection applied due to network routing failure.",
            "System"
          );
        }
      }
    }

    // 4. ROLE HANDOFFS (Immediate transition nodes to wrap up)
    else if (currentNode.type === "Role_Handoff") {
      activeTask.status = "Completed";
      instance.status = "completed";
      instance.currentNodeId = null;
      addHistory(
        instance,
        currentNode.id,
        currentNode.title,
        "Completed Final Handoff",
        "Signoff complete. All roles validated and integrated successfully.",
        "System"
      );
      
      sendNotification("Admin", "Workflow Finalized", `Performance of workflow '${instance.templateName}' completes successfully.`, instance.id);
      progressionActive = false;
      break;
    }
  }
}

// REST API ROUTES

// templates CRUD
app.get("/api/workflows", (req, res) => {
  res.json(templates);
});

app.post("/api/workflows", (req, res) => {
  const { name, description, nodes, edges } = req.body;
  if (!name || !nodes || !edges) {
    return res.status(400).json({ error: "Name, nodes, and edges are required." });
  }

  const newTemplate: WorkflowTemplate = {
    id: `temp_${Date.now()}`,
    name,
    description: description || "",
    nodes,
    edges,
    createdAt: new Date().toISOString(),
    version: "1.0.0",
    versionDescription: "Initial baseline release"
  };

  newTemplate.historyVersions = [
    {
      version: "1.0.0",
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: new Date().toISOString(),
      description: "Initial baseline release",
      author: "HSBC System Architect"
    }
  ];

  templates.push(newTemplate);
  res.status(201).json(newTemplate);
});

// Create and commit a new version of an existing template
app.post("/api/workflows/:id/version", (req, res) => {
  const templateId = req.params.id;
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return res.status(404).json({ error: "Workflow template not found." });
  }

  const { version, description, author, nodes, edges } = req.body;
  if (!version || !nodes || !edges) {
    return res.status(400).json({ error: "Version string, nodes, and edges are required." });
  }

  if (!template.historyVersions) {
    template.historyVersions = [];
  }

  const existingIndex = template.historyVersions.findIndex((v) => v.version === version);
  const newVer = {
    version,
    nodes,
    edges,
    timestamp: new Date().toISOString(),
    description: description || "Incremental design commit",
    author: author || "System Architect"
  };

  if (existingIndex >= 0) {
    template.historyVersions[existingIndex] = newVer;
  } else {
    template.historyVersions.push(newVer);
  }

  // Update current active branch
  template.version = version;
  template.versionDescription = description || "Incremental design commit";
  template.nodes = nodes;
  template.edges = edges;

  res.json({ message: "Version successfully committed", template });
});

// Restore/Rollback to a specific historical template version
app.post("/api/workflows/:id/restore", (req, res) => {
  const templateId = req.params.id;
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return res.status(404).json({ error: "Workflow template not found." });
  }

  const { version } = req.body;
  if (!version) {
    return res.status(400).json({ error: "Version to restore is required." });
  }

  if (!template.historyVersions) {
    return res.status(400).json({ error: "No historical versions exist for this template." });
  }

  const targetVer = template.historyVersions.find((v) => v.version === version);
  if (!targetVer) {
    return res.status(404).json({ error: `Historical version '${version}' not found.` });
  }

  // Revert active template schema details
  template.version = targetVer.version;
  template.versionDescription = targetVer.description;
  template.nodes = targetVer.nodes;
  template.edges = targetVer.edges;

  res.json({ message: `Successfully rolled back layout to version ${version}`, template });
});

// Run Workflow
app.post("/api/workflows/:id/run", async (req, res) => {
  const templateId = req.params.id;
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return res.status(404).json({ error: "Workflow template not found." });
  }

  const firstNode = template.nodes.find((n) => !template.edges.some((e) => e.target === n.id)) || template.nodes[0];
  if (!firstNode) {
    return res.status(400).json({ error: "No starting node found in the flow design." });
  }

  const newInstance: WorkflowInstance = {
    id: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    templateId: template.id,
    templateName: template.name,
    status: "active",
    currentNodeId: firstNode.id,
    history: [
      {
        id: `hist_init_${Date.now()}`,
        timestamp: new Date().toISOString(),
        nodeId: null,
        action: "Instance Launched",
        summary: `Workflow template launched as an active simulation. Initial node focus: ${firstNode.title}`,
        performedBy: "System",
      },
    ],
    tasks: [
      {
        id: `task_${Date.now()}`,
        nodeId: firstNode.id,
        title: firstNode.title,
        description: firstNode.description,
        assigneeRole: firstNode.assigneeRole,
        status: "Active",
      },
    ],
    contextData: {},
  };

  instances.push(newInstance);

  sendNotification(
    firstNode.assigneeRole,
    "New Workflow Run Assigned",
    `First task of run '${template.name}' is pending submission.`,
    newInstance.id
  );

  res.status(201).json(newInstance);
});

// Get Active instances
app.get("/api/instances", (req, res) => {
  res.json(instances);
});

app.get("/api/instances/:id", (req, res) => {
  const instance = instances.find((i) => i.id === req.params.id);
  if (!instance) {
    return res.status(404).json({ error: "Instance not found" });
  }
  res.json(instance);
});

// Reset simulation instances to seed state
app.post("/api/simulation/reset", (req, res) => {
  const defaultTemp = templates.find(t => t.id === "temp_marketing") || defaultTemplate;
  instances = [
    {
      id: "inst_demo",
      templateId: defaultTemp.id,
      templateName: defaultTemp.name,
      status: "active",
      currentNodeId: "node_1",
      history: [
        {
          id: "hist_init",
          timestamp: new Date().toISOString(),
          nodeId: null,
          action: "Workflow Initialized",
          summary: "PR Campaign & Budget Approval run started successfully. Positioned on step: Write PR Campaign Draft.",
          performedBy: "System",
        },
      ],
      tasks: [
        {
          id: "task_1",
          nodeId: "node_1",
          title: "Write PR Campaign Draft",
          description: "Draft a high-level marketing pitch with target details and specified expenditures.",
          assigneeRole: "Employee",
          status: "Active",
        },
      ],
      contextData: {},
    }
  ];
  notifications = [];
  agentLogs = [];
  
  sendNotification("Employee", "Project Started", "Draft PR Campaign task is now active in demo instance.", "inst_demo", "task_1");
  res.json({ message: "Simulation state reset successful.", instances });
});

// Submit Task (Human Interaction & AI quality audit)
app.post("/api/instances/:id/task/:taskId/submit", async (req, res) => {
  const { id, taskId } = req.params;
  const { reportText, comment, decision } = req.body; // text payload, action choice
  
  const instance = instances.find((i) => i.id === id);
  if (!instance) {
    return res.status(404).json({ error: "Workflow instance not found." });
  }

  const task = instance.tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: "Task instance not found." });
  }

  const template = templates.find((t) => t.id === instance.templateId);
  if (!template) {
    return res.status(404).json({ error: "Workflow template not found." });
  }

  const currentNode = template.nodes.find((n) => n.id === task.nodeId);
  if (!currentNode) {
    return res.status(404).json({ error: "Task node template missing." });
  }

  // Record submission details
  task.status = "Submitted";
  task.submittedBy = task.assigneeRole;
  task.submittedAt = new Date().toISOString();
  task.completionData = {
    reportText: reportText || "",
    comment: comment || "",
  };

  addHistory(
    instance,
    currentNode.id,
    currentNode.title,
    "Feedback Submitted",
    `${task.assigneeRole} completed the task with feedback ${decision ? `['${decision}']` : ""}. Comment: ${comment || "None"}`,
    task.assigneeRole
  );

  // AI Quality Audit check if user submitted text and a Gemini key is available
  const gemini = getGeminiClient();
  if (gemini && reportText && currentNode.type === "Task") {
    try {
      const auditSchema = {
        type: Type.OBJECT,
        properties: {
          thought: { type: Type.STRING, description: "Detailed reviewer reasoning checking user's draft text content against prompt requirements." },
          passedAudit: { type: Type.BOOLEAN, description: "True if criteria is realistically met or detailed constructive suggestions are doable." },
          constructiveFeedback: { type: Type.STRING, description: "Clear praise or specific missing elements." },
        },
        required: ["thought", "passedAudit", "constructiveFeedback"],
      };

      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Audit human task draft for role ${task.assigneeRole}.
Task Name: ${task.title}
Target criteria: ${currentNode.completionCriteria}
User's submission:
"${reportText}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: auditSchema,
        },
      });

      const auditResult = JSON.parse(response.text || "{}");
      task.aiEvaluation = {
        thought: auditResult.thought,
        decision: auditResult.passedAudit ? "approve" : "review_warnings",
        suggestedFeedback: auditResult.constructiveFeedback,
      };

      agentLogs.push({
        id: `audit_log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        instanceId: instance.id,
        nodeId: currentNode.id,
        nodeTitle: currentNode.title,
        promptType: "Audit",
        inputData: { reportText, target: currentNode.completionCriteria },
        aiResponse: auditResult,
      });

      addHistory(
        instance,
        currentNode.id,
        currentNode.title,
        "AI Peer Audit Formed",
        `Quality Audit completed. Passed: ${auditResult.passedAudit ? "Yes" : "With Caveats"}. Audit: ${auditResult.constructiveFeedback}`,
        "AI Orchestrator"
      );
    } catch (auditError) {
      console.error("Task Audit Failure:", auditError);
    }
  }

  // Determine transition routing based on edge template design
  // E.g. Manager selects "Approve" -> progress forwards. "Request Revision" -> progress back to Employee draft
  let nextNodeId: string | null = null;
  const outgoingEdges = template.edges.filter((e) => e.source === task.nodeId);

  if (decision) {
    // Exact filter match based on decision condition
    const matchingEdge = outgoingEdges.find((e) => e.condition?.toLowerCase() === decision.toLowerCase());
    if (matchingEdge) {
      nextNodeId = matchingEdge.target;
    } else {
      // Default to first outgoing edge if mismatch
      nextNodeId = outgoingEdges[0]?.target || null;
    }
  } else {
    nextNodeId = outgoingEdges[0]?.target || null;
  }

  // Update instance and fire background orchestrator loop
  instance.currentNodeId = nextNodeId;
  res.json({ message: "Task submitted. Processing workflow simulation.", instance });

  // Run the background cycle automatically as the state engine
  setTimeout(() => {
    orchestrateWorkflow(instance.id).catch((err) => {
      console.error("Orchestrator Failure:", err);
    });
  }, 100);
});

// Notifications API
app.get("/api/notifications", (req, res) => {
  res.json(notifications);
});

app.post("/api/notifications/clear", (req, res) => {
  notifications = [];
  res.json({ success: true });
});

app.get("/api/logs", (req, res) => {
  res.json(agentLogs);
});

// Server configuration & asset serving

async function startServer() {
  // Mount Vite middleware in development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production builds
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
