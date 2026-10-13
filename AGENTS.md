<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# STACK37 EOS — AI Agent Responsibility Policy & Operating Governance

**Audience:** Google Antigravity, ChatGPT Codex, ChatGPT (Coordination), Human Engineers  
**Project:** STACK37 EOS / My Business by STACK37  
**Authority:** Chief Executive Officer, STACK37 (Pvt) Ltd  
**Status:** CEO-Approved Permanent Operating Policy  

---

## 1. Permanent Division of Responsibilities

The CEO has established the following strict division of engineering and product ownership:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHIEF EXECUTIVE OFFICER                         │
│                            FINAL AUTHORITY                             │
│  - Product scope & business policies       - UI/UX design approvals    │
│  - Significant technical decisions        - Live database operations   │
│  - Git synchronization authorizations     - Production deployments     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                               CHATGPT                                  │
│               PRODUCT COORDINATION & INDEPENDENT REVIEW                │
│  - Product planning & feature requirements - Development sequencing    │
│  - Reviewing engineering & UI reports      - Identifying scope conflicts│
│  - Clear progress explanations to the CEO                              │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│          GOOGLE ANTIGRAVITY          │ │         CHATGPT CODEX         │
│      BACKEND ENGINEERING OWNER       │ │     UI/UX & FRONTEND OWNER    │
│  - Database & data integrity         │ │  - Product UI/UX design       │
│  - Business rules & calculations     │ │  - STACK37 visual design system│
│  - Auth, authorization & security    │ │  - Frontend pages & layouts   │
│  - Server-side actions & APIs        │ │  - Shared visual components   │
│  - Subscription & payment logic      │ │  - Navigation, tables, forms  │
│  - Backend integrations & RPCs       │ │  - Transactional email visuals│
│  - DB migrations & backend tests     │ │  - Interactions, a11y & tests │
└──────────────────────────────────────┘ └───────────────────────────────┘
```

### Boundary & Collaboration Invariants:
1. **Codex Boundary:** Codex must **NOT** independently change backend business logic, database schemas, RLS policies, security definer RPCs, or server action logic.
2. **Antigravity Boundary:** Antigravity must **NOT** redesign approved UI components, change visual styling standards, or alter visual design tokens without coordination.
3. **Integration Contract Requirement:** Before implementing dependent work, both agents must document integration requirements (input schemas, validation models, return types, error contracts) in the active task record.
4. **Preservation of Uncommitted Changes:** Agents must **NEVER** overwrite, discard, or reset (`git reset`, `git checkout .`) another agent's uncommitted work.
5. **Technical Isolation for Parallel Work:** A task-register entry alone is not a technical lock. When parallel work is necessary, agents must operate on **separate Git branches or worktrees** and follow an approved integration procedure.
6. **Traceability:** Every Git commit and database migration must cite its approved Task ID (`TASK-xxx`).
7. **CEO Authorization Gate:** Absolutely **NO** commits, pushes, live database migrations (`supabase db push`), or production deployments without explicit CEO authorization.

---

## 2. Immediate Sequential Development Priorities

All development must strictly adhere to this sequence. **No new ERP modules (Sales, Purchasing, Inventory, Finance) or Team Management features are authorized** until these priorities are completed and accepted:

1. **Priority 1: Project Control System Stabilization** (`TASK-STAB-001` — Current)
2. **Priority 2: Foundation Stabilization** (`TASK-STAB-002` — Phase 3C.3 review, Migrations 11 & 12 reconciliation, Git sync)
3. **Priority 3: UI/UX Design Approval** (`TASK-STAB-003` — Corporate logo, navy typography, blue/violet theme approval)
4. **Priority 4: Existing Interface Alignment** (`TASK-STAB-004` — Codex aligns existing pages to approved UI/UX design)
5. **Priority 5: Integrated Verification** (`TASK-STAB-005` — Joint backend/frontend end-to-end regression verification)

---

## 3. Mandatory Agent Task Lifecycle & Handoff Protocol

Every agent task must follow this 5-step lifecycle:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 1. READ STATE   │ ──► │ 2. CLAIM TASK   │ ──► │ 3. IMPLEMENT    │ ──► │ 4. RECORD DIFF  │ ──► │ 5. HANDOFF &    │
│ & Instructions  │     │ in TASKS.md     │     │ Within Domain   │     │ in Task History │     │ Await CEO Review│
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Mandatory Pre-Task Execution Protocol (8-Step Pre-Flight Check)
Before touching any code or executing any command, every agent MUST execute these 8 steps in order:
1. **Read AGENTS.md:** Understand operating boundaries, invariants, and policies.
2. **Read PROJECT_STATE.md:** Understand what is completed, uncommitted, and currently active.
3. **Read the assigned task in docs/TASKS.md:** Confirm task ID, assigned owner, approved scope, files affected, and acceptance criteria.
4. **Read relevant product requirements and decisions:** Inspect [docs/PRODUCT_SCOPE.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/PRODUCT_SCOPE.md), [docs/FEATURES.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/FEATURES.md), and [docs/DECISIONS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/DECISIONS.md).
5. **Read applicable design standards:** Inspect [docs/DESIGN_STANDARDS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/DESIGN_STANDARDS.md) (official logo, navy typography, blue/violet theme).
6. **Inspect the current Git status and existing changes:** Run `git status` to verify working tree state and preserve uncommitted changes.
7. **Confirm task authorization & domain ownership:** Verify status is `AUTHORIZED` and matches the agent's domain (Antigravity: Backend; Codex: Frontend/UI).
8. **Claim task & declare file scope:** Transition task to `IN_PROGRESS` in [docs/TASKS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/TASKS.md) with declared file locks before beginning work. Only then begin authorized work.

### Step 3: Implement Within Domain
- Stay strictly within the assigned functional domain (Antigravity: Backend; Codex: Frontend/UI).
- Execute test suites (`npm run test:unit`, `npm run typecheck`). Ensure 0 regressions.
- If visual/frontend, verify responsive presentation down to 375px mobile screens.

### Step 4: Record Changes & Evidence
- Append a detailed entry to the task's history in [docs/TASKS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/TASKS.md):
  - Exact files created or modified.
  - Tests executed and pass counts.
  - Implementation evidence classified honestly (Committed, Locally Tested, Deployed DB, Publicly Deployed, CEO-Accepted).
  - Explicit list of what remains incomplete.
- Update [PROJECT_STATE.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/PROJECT_STATE.md).

### Step 5: Handoff & Stop
- Set task status to `READY_FOR_REVIEW`. (Never mark `ACCEPTED` without CEO sign-off).
- Submit concise executive summary to the CEO and ChatGPT (Product Review).
- **STOP.** Await CEO authorization before proceeding.

---

## 4. Documentation Index

- **Current Status Snapshot:** [PROJECT_STATE.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/PROJECT_STATE.md)
- **Product Scope & Vision:** [docs/PRODUCT_SCOPE.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/PRODUCT_SCOPE.md)
- **Feature Inventory:** [docs/FEATURES.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/FEATURES.md)
- **Development Roadmap:** [docs/ROADMAP.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/ROADMAP.md)
- **Decision Register:** [docs/DECISIONS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/DECISIONS.md)
- **Task Register & Task Histories:** [docs/TASKS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/TASKS.md)
- **Design Standards:** [docs/DESIGN_STANDARDS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/DESIGN_STANDARDS.md)
