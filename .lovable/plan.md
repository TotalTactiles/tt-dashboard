

## Problem

Your n8n workflow has the right structure (4 Google Sheets nodes → Merge → Code → Respond to Webhook), but only cashflow data arrives. The issue is in the **Code in JavaScript** node.

When a Merge node in "append" mode combines 4 inputs, all rows get mixed into a single flat list. The Code node has no way to tell which rows came from which sheet — unless it references each upstream node by name.

## Fix: Update the Code in JavaScript Node

Replace the current code in your **Code in JavaScript** node with this:

```javascript
// Reference each Google Sheets node by its exact name
const cashflow = $('Cashflow').all().map(item => item.json);
const quotes = $('Quotes').all().map(item => item.json);
const revenue = $('Revs & COGS').all().map(item => item.json);
const expenses = $('Expenses').all().map(item => item.json);

return [{
  json: {
    cashflow,
    quotes,
    revenue,
    expenses
  }
}];
```

**Important**: The node names in `$('...')` must match exactly what you see on the canvas — `Cashflow`, `Quotes`, `Revs & COGS`, `Expenses`. If any name differs (even by a space), adjust accordingly.

## Why This Works

- `$('Cashflow').all()` pulls items specifically from the "Cashflow" node output, regardless of how the Merge mixed them
- This produces the exact JSON structure the dashboard expects: `{ cashflow: [...], quotes: [...], revenue: [...], expenses: [...] }`

## Alternative (if `$('NodeName')` doesn't work)

If your n8n version doesn't support `$('NodeName')`, you can bypass the Merge entirely:

1. Remove the Merge node
2. Connect all 4 Google Sheets nodes directly into the Code node (it accepts multiple inputs)
3. Use this code instead:

```javascript
const cashflow = $input.all(0).map(item => item.json);  // Input 1
const quotes = $input.all(1).map(item => item.json);     // Input 2
const revenue = $input.all(2).map(item => item.json);    // Input 3
const expenses = $input.all(3).map(item => item.json);   // Input 4

return [{
  json: {
    cashflow,
    quotes,
    revenue,
    expenses
  }
}];
```

## No Code Changes Needed

The dashboard code already handles all four keys correctly. This is purely an n8n workflow fix.

