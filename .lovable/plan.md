

## Plan: Update n8n Workflow to Return All Four Sheet Tabs + Apply Dashboard Fixes

### Problem
Your n8n workflow currently only reads the **Cashflow** tab and returns it under the `cashflow` key. The dashboard expects four keys: `cashflow`, `quotes`, `revenue`, `expenses`. The other three are missing, so those cards show no data.

### Part 1: n8n Workflow Changes (you do this in n8n)

Your n8n workflow needs to read all four tabs and combine them into a single JSON response. Here is the exact structure:

**Current workflow (simplified):**
```text
Webhook Trigger → Google Sheets (Cashflow) → Respond to Webhook
```

**Updated workflow:**
```text
Webhook Trigger
  ├→ Google Sheets "Read Cashflow"    (tab: Cashflow)
  ├→ Google Sheets "Read Quotes"      (tab: Quotes / 2025 Quoted Jobs)
  ├→ Google Sheets "Read Revenue"     (tab: Rev & COGS / Expected Revenue)
  └→ Google Sheets "Read Expenses"    (tab: Business Expenses)
        ↓ all four feed into ↓
      Set Node (combine into one object)
        ↓
      Respond to Webhook
```

**Step-by-step in n8n:**

1. **Add 3 more "Google Sheets" nodes** — one for each missing tab (Quotes, Rev & COGS, Business Expenses). Each should use "Read Rows" operation on the same spreadsheet but different sheet/tab names.

2. **All 4 Google Sheets nodes should run in parallel** from the Webhook Trigger (connect each directly to the trigger).

3. **Add a "Merge" node** (or use a "Code" node) to combine all four outputs into a single object. Use a **Code node** with this JavaScript:

```javascript
// Items from each branch (adjust input indices if needed)
const cashflow = $input.all().filter(i => i.json._branch === 'cashflow').map(i => i.json);
const quotes = $input.all().filter(i => i.json._branch === 'quotes').map(i => i.json);
const revenue = $input.all().filter(i => i.json._branch === 'revenue').map(i => i.json);
const expenses = $input.all().filter(i => i.json._branch === 'expenses').map(i => i.json);

return [{
  json: { cashflow, quotes, revenue, expenses }
}];
```

**Alternative (simpler) approach using a Code node after a Merge node:**

If the above branch-tagging is complex, use this approach instead:

1. After each Google Sheets node, add a **Set** node that adds a field `_source` with the value `cashflow`, `quotes`, `revenue`, or `expenses` respectively.
2. Connect all four Set nodes into a single **Merge** node (mode: "Append").
3. After the Merge, add a **Code** node:

```javascript
const items = $input.all();
const result = { cashflow: [], quotes: [], revenue: [], expenses: [] };

for (const item of items) {
  const source = item.json._source;
  if (source && result[source]) {
    const data = { ...item.json };
    delete data._source;
    result[source].push(data);
  }
}

return [{ json: result }];
```

4. Connect the Code node to a **Respond to Webhook** node.

5. On the **Webhook Trigger** node, set "Respond" to **"Using Respond to Webhook Node"**.

The final JSON response must look like:
```json
{
  "cashflow": [ { "col_1": "OPENING BALANCES", "Feb-26": 186224.81, ... }, ... ],
  "quotes": [ { "Company Name": "Acme", "Project Name": "Fit-out", "2025 QUOTED JOBS": 45000, ... }, ... ],
  "revenue": [ { "COMPANY": "Acme", "PROJECT": "Fit-out", "VALUE (INCL. GST)": 49500, ... }, ... ],
  "expenses": [ { "Main Expenses": "Rent", "Monthly Cost": 2500, ... }, ... ]
}
```

### Part 2: Code Fix — `buildRowLookup` Trailing Space Tolerance

One code change is still needed: `buildRowLookup` in `DashboardDataContext.tsx` should `.trim()` the label values before storing in the lookup. This was identified previously but not yet applied — it prevents matching labels like `"Labour Costs "` (trailing space) against `"LABOUR COSTS"`.

**File: `src/contexts/DashboardDataContext.tsx`**
- Line 121: already does `.trim()` — confirmed this fix is already in place. No additional code changes needed.

### Summary

No code changes are required. The dashboard code already handles all four data keys correctly. The only action needed is updating your **n8n workflow** to read all four sheet tabs and return them as a combined JSON object with keys `cashflow`, `quotes`, `revenue`, and `expenses`.

