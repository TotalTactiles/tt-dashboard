

## n8n Workflow Setup Guide -- Step by Step

### Your Current Workflow (from screenshot)

The node layout is correct:
```text
Webhook (POST)
  ├─► Cashflow (Google Sheets)  ──► Input 1 ─┐
  ├─► Quotes (Google Sheets)    ──► Input 2 ─┤
  ├─► Revs & COGS (Google Sheets) ► Input 3 ─┼─► Merge (append) ─► Code in JavaScript ─► Respond to Webhook
  └─► Expenses (Google Sheets)  ──► Input 4 ─┘
```

### Fixing the Error

The "Unused Respond to Webhook node" error means the node exists but n8n does not see it as reachable in the execution chain. Common causes:

1. **The connection line between "Code in JavaScript" and "Respond to Webhook" is missing or broken.** Delete the Respond to Webhook node, add a new one, and re-draw the connection from Code output to Respond to Webhook input.
2. **The Webhook node's "Respond" setting is wrong.** Open the Webhook node settings and set **"Respond"** to **"Using 'Respond to Webhook' Node"** (not "Immediately" or "When Last Node Finishes").

---

### Step-by-Step Configuration

#### Step 1: Webhook Node
- **HTTP Method**: POST
- **Path**: `google-sheets` (or whatever your current path is)
- **Respond**: **"Using 'Respond to Webhook' Node"** (this is critical)

#### Step 2: Four Google Sheets Nodes
Each reads one tab. Configure them as:

| Node Name | Sheet / Tab Name | Operation |
|-----------|-----------------|-----------|
| Cashflow | Cashflow | Read: sheet |
| Quotes | Quotes | Read: sheet |
| Revs & COGS | Expected Revenue (or Revenue & COGS) | Read: sheet |
| Expenses | Business Expenses | Read: sheet |

- All four connect FROM the Webhook node output
- Each connects TO a different input on the Merge node (Input 1-4)

#### Step 3: Merge Node
- **Mode**: Append
- **Number of Inputs**: 4
- Connect: Cashflow → Input 1, Quotes → Input 2, Revs & COGS → Input 3, Expenses → Input 4

#### Step 4: Code in JavaScript Node

This is the most important part. The dashboard expects a **single JSON object** with keys `quotes`, `cashflow`, `revenue`, and `expenses`. Paste this code:

```javascript
// The Merge node appends all items from all 4 inputs into one array.
// Each item retains its input index. We need to separate them.

const allItems = $input.all();

// Separate by which input they came from (0-indexed)
const cashflowItems = [];
const quotesItems = [];
const revenueItems = [];
const expensesItems = [];

// Since Merge "append" mode concatenates inputs in order,
// we need to identify items by their source.
// Best approach: tag items in each Google Sheets node OR use inputIndex.

// If using Merge node with "append" mode, items come with 
// metadata about their source. Use $input.all() from each input:

const input1 = $('Cashflow').all().map(i => i.json);
const input2 = $('Quotes').all().map(i => i.json);
const input3 = $('Revs & COGS').all().map(i => i.json);
const input4 = $('Expenses').all().map(i => i.json);

return [{
  json: {
    cashflow: input1,
    quotes: input2,
    revenue: input3,
    expenses: input4
  }
}];
```

**Important**: The node names in `$('Cashflow')`, `$('Quotes')`, `$('Revs & COGS')`, and `$('Expenses')` must match the **exact names** of your Google Sheets nodes as shown on the canvas. If your node is named differently (e.g. "Revs & COGS" vs "Revenue & COGS"), update the string accordingly.

#### Step 5: Respond to Webhook Node
- **Respond With**: JSON
- **Response Body**: `{{ $json }}` (the entire output from Code node)
- Make sure it is connected FROM the Code in JavaScript node output

#### Step 6: Activate and Test
1. Make sure all connections (lines) are drawn correctly -- especially Code → Respond to Webhook
2. Click **Save** in the workflow editor
3. Toggle the workflow **Active** (top-right switch)
4. Go to the dashboard Settings page and click **Save & Test**

---

### Expected Response Format

When the webhook fires, the dashboard receives and maps data like this:

```json
{
  "cashflow": [
    { "month": "Jul", "openingBalance": 45000, "totalIncome": 62000, ... },
    ...
  ],
  "quotes": [
    { "quoteNumber": "QT-2025-001", "company": "Apex", "value": 42500, "status": "won", ... },
    ...
  ],
  "revenue": [
    { "company": "Apex", "project": "Office Fitout", "valueExclGST": 42500, ... },
    ...
  ],
  "expenses": [
    { "name": "Rent", "monthlyCost": 3200, "yearlyCost": 38400, ... },
    ...
  ]
}
```

The column names from your Google Sheets will become the JSON keys. The dashboard code in `useDataSources.ts` spreads the response directly into `liveData`, so the keys `quotes`, `cashflow`, `revenue`, `expenses` must match exactly.

---

### Troubleshooting Checklist

1. **"Unused Respond to Webhook"** -- Webhook node "Respond" must be set to "Using 'Respond to Webhook' Node", and the Respond to Webhook node must be connected in the execution chain
2. **Empty data** -- Check that each Google Sheets node returns data by clicking "Execute Node" individually
3. **Wrong key names** -- The `$('NodeName')` references in the Code node must exactly match your node display names
4. **Workflow inactive** -- The toggle in the top-right must be ON for production URLs to work

No code changes are needed on the dashboard side. Once the n8n workflow returns the correct JSON shape, the existing `useDataSources.ts` hook will map the data into the dashboard components automatically.

