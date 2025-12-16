(function () {
  const STORAGE_KEY = "ai-finance-tracker:v1";

  /**
   * Types:
   * tx: { id, description, category, amount, date, type }
   * type is 'income' or 'expense'
   */

  const form = document.getElementById("tx-form");
  const descriptionInput = document.getElementById("description-input");
  const amountInput = document.getElementById("amount-input");
  const categorySelect = document.getElementById("category-select");
  const dateInput = document.getElementById("date-input");
  const txListEl = document.getElementById("transactions-list");
  const txCountLabel = document.getElementById("tx-count-label");
  const netEl = document.getElementById("stat-net");
  const savingsEl = document.getElementById("stat-savings");
  const discretionaryEl = document.getElementById("stat-discretionary");
  const discretionaryPctEl = document.getElementById(
    "stat-discretionary-pct"
  );
  const netSummaryEl = document.getElementById("stat-net-summary");
  const savingsSummaryEl = document.getElementById("stat-savings-summary");
  const spanSummaryLabel = document.getElementById("span-summary-label");
  const aiStreamEl = document.getElementById("ai-stream");
  const aiTagsEl = document.getElementById("ai-tags");
  const demoFillBtn = document.getElementById("demo-fill-btn");
  const refreshAiBtn = document.getElementById("refresh-ai-btn");
  const clearBtn = document.getElementById("clear-btn");
  const chartCanvas = document.getElementById("chart");
  const ctx = chartCanvas.getContext("2d");

  let transactions = [];

  function toISODateOnly(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function initDate() {
    dateInput.value = toISODateOnly(new Date());
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          transactions,
        })
      );
    } catch (err) {
      console.error("Failed to persist transactions", err);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.transactions)) {
        transactions = parsed.transactions;
      }
    } catch (err) {
      console.warn("Failed to parse previous data, resetting.", err);
      transactions = [];
    }
  }

  function formatCurrency(value) {
    const n = Number(value) || 0;
    return "£" + n.toFixed(2);
  }

  function computeSummary() {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - 30);

    let income = 0;
    let essentials = 0;
    let lifestyle = 0;
    let debt = 0;

    const ESSENTIAL_CATEGORIES = new Set([
      "housing",
      "groceries",
      "transport",
      "health",
      "debt",
    ]);

    for (const tx of transactions) {
      const d = new Date(tx.date);
      if (d < cutoff) continue;

      if (tx.type === "income") {
        income += tx.amount;
      } else {
        if (tx.category === "debt") {
          debt += tx.amount;
        }

        if (ESSENTIAL_CATEGORIES.has(tx.category)) {
          essentials += tx.amount;
        } else {
          lifestyle += tx.amount;
        }
      }
    }

    const totalExpenses = essentials + lifestyle + debt;
    const net = income - totalExpenses;
    const savingsRate = income > 0 ? Math.max(0, net) / income : 0;
    const discretionary = lifestyle;
    const discretionaryPct = totalExpenses > 0 ? (lifestyle / totalExpenses) * 100 : 0;

    return {
      income,
      essentials,
      lifestyle,
      debt,
      totalExpenses,
      net,
      savingsRate,
      discretionary,
      discretionaryPct,
    };
  }

  let chartState = null;

  function renderChart() {
    const rect = chartCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const summary = computeSummary();
    const income = summary.income;
    const essentials = summary.essentials;
    const lifestyle = summary.lifestyle;

    const total = income + essentials + lifestyle || 1;
    const maxVal = Math.max(income, essentials + lifestyle, 1);

    const padding = { top: 16, bottom: 26, left: 20, right: 20 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // grid lines
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padding.top + (chartHeight * i) / steps;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const colWidth = chartWidth / 3;
    const barWidth = Math.min(44, colWidth * 0.7);

    function drawBar(idx, value, colorFrom, colorTo, label) {
      const xCenter = padding.left + colWidth * idx + colWidth / 2;
      const h = (chartHeight * value) / (maxVal || 1);
      const y = padding.top + (chartHeight - h);

      const r = 8;
      ctx.save();
      const gradient = ctx.createLinearGradient(
        xCenter,
        y,
        xCenter,
        y + h
      );
      gradient.addColorStop(0, colorFrom);
      gradient.addColorStop(1, colorTo);
      ctx.fillStyle = gradient;

      const x = xCenter - barWidth / 2;
      const w = barWidth;
      const bottom = y + h;

      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, bottom);
      ctx.lineTo(x, bottom);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "rgba(15,23,42,0.85)";
      ctx.fillRect(x, bottom - 8, w, 8);
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(226,232,240,0.85)";
      ctx.font = "10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      const textY = Math.max(padding.top + 12, y - 6);
      ctx.fillText(formatCurrency(value), xCenter, textY);

      ctx.fillStyle = "rgba(148,163,184,0.9)";
      ctx.fillText(
        label,
        xCenter,
        padding.top + chartHeight + 13
      );

      ctx.restore();
    }

    drawBar(
      0,
      income,
      "#22c55e",
      "#4ade80",
      "Income"
    );
    drawBar(
      1,
      essentials,
      "#38bdf8",
      "#6366f1",
      "Essentials"
    );
    drawBar(
      2,
      lifestyle,
      "#fb7185",
      "#f97316",
      "Lifestyle"
    );

    chartState = { income, essentials, lifestyle, total };
  }

  function renderTransactions() {
    txListEl.innerHTML = "";

    if (transactions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ai-message";
      empty.textContent =
        "No activity yet. Log recurring bills, then variable spends like eating out or shopping.";
      txListEl.appendChild(empty);
      txCountLabel.textContent = "0 tracked";
      return;
    }

    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    });

    for (const tx of sorted) {
      const row = document.createElement("div");
      row.className =
        "transaction-row" + (tx.type === "expense" ? " expense" : "");

      const main = document.createElement("div");
      main.className = "transaction-main";

      const title = document.createElement("div");
      title.className = "transaction-title";
      title.textContent = tx.description;

      const meta = document.createElement("div");
      meta.className = "transaction-meta";
      const categoryLabel = categoryToLabel(tx.category);
      meta.textContent = categoryLabel + " · " + formatter.format(new Date(tx.date));

      main.appendChild(title);
      main.appendChild(meta);

      const amount = document.createElement("div");
      amount.className =
        "transaction-amount " +
        (tx.type === "income" ? "income" : "expense");
      amount.textContent =
        (tx.type === "expense" ? "-" : "+") + formatCurrency(tx.amount);

      const badge = document.createElement("div");
      badge.className = "transaction-badge";
      badge.textContent = tx.type === "income" ? "Income" : "Expense";

      const actions = document.createElement("div");
      actions.className = "transaction-actions";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn-secondary";
      deleteBtn.style.paddingInline = "8px";
      deleteBtn.style.fontSize = "11px";
      deleteBtn.textContent = "Remove";
      deleteBtn.addEventListener("click", () => {
        transactions = transactions.filter((t) => t.id !== tx.id);
        saveState();
        renderAll();
      });

      actions.appendChild(deleteBtn);

      row.appendChild(main);
      row.appendChild(amount);
      row.appendChild(badge);
      row.appendChild(actions);

      txListEl.appendChild(row);
    }

    txCountLabel.textContent =
      sorted.length === 1
        ? "1 transaction"
        : sorted.length + " transactions";
  }

  function categoryToLabel(category) {
    switch (category) {
      case "income":
        return "Income";
      case "housing":
        return "Housing";
      case "groceries":
        return "Groceries";
      case "transport":
        return "Transport";
      case "subscriptions":
        return "Subscriptions";
      case "eating_out":
        return "Eating out";
      case "shopping":
        return "Shopping";
      case "health":
        return "Health & fitness";
      case "debt":
        return "Debt";
      case "other":
      default:
        return "Other";
    }
  }

  function renderSummary() {
    const summary = computeSummary();

    netEl.textContent = formatCurrency(summary.net);
    savingsEl.textContent = Math.round(summary.savingsRate * 100) + "%";
    discretionaryEl.textContent = formatCurrency(summary.discretionary);
    discretionaryPctEl.textContent =
      Math.round(summary.discretionaryPct) + "%";

    // Net cash flow label
    if (transactions.length === 0) {
      netSummaryEl.textContent = "Log a few items to begin.";
      spanSummaryLabel.textContent = "Healthy runway";
    } else if (summary.net > 0 && summary.savingsRate >= 0.2) {
      netSummaryEl.textContent =
        "You&apos;re running a surplus – consider auto-moving this to savings.";
      spanSummaryLabel.textContent = "Healthy runway";
    } else if (summary.net > 0 && summary.savingsRate < 0.2) {
      netSummaryEl.textContent =
        "Surplus is modest – nudging 3–5% more into savings would strengthen your buffer.";
      spanSummaryLabel.textContent = "Could be stronger";
    } else if (summary.net < 0) {
      netSummaryEl.textContent =
        "Spending exceeds income – look for 1–2 categories to cut by 15–20%.";
      spanSummaryLabel.textContent = "Net negative";
    } else {
      netSummaryEl.textContent =
        "You&apos;re roughly break-even – guard against lifestyle creep.";
      spanSummaryLabel.textContent = "Tight balance";
    }

    if (summary.savingsRate >= 0.3) {
      savingsSummaryEl.textContent =
        "Excellent savings discipline – you&apos;re on track to build serious runway.";
    } else if (summary.savingsRate >= 0.2) {
      savingsSummaryEl.textContent =
        "Solid savings rate. If sustainable, this compounds well over time.";
    } else if (summary.savingsRate > 0.05) {
      savingsSummaryEl.textContent =
        "You&apos;re saving something. Try earmarking the next 5% of income for goals.";
    } else if (summary.savingsRate > 0) {
      savingsSummaryEl.textContent =
        "Savings are very light – anchoring to even 10% could reduce money stress.";
    } else {
      savingsSummaryEl.textContent =
        "No savings yet in the last 30 days. Start with a tiny, automatic amount.";
    }
  }

  function generateAIInsights() {
    const summary = computeSummary();
    aiStreamEl.innerHTML = "";

    function pushMessage(html) {
      const div = document.createElement("div");
      div.className = "ai-message";
      div.innerHTML = html;
      aiStreamEl.appendChild(div);
    }

    if (transactions.length === 0) {
      pushMessage(
        "<strong>Nothing to analyse yet.</strong> Add your salary, rent or mortgage, groceries, and a couple of lifestyle spends. I&apos;ll then estimate your savings rate and where overspend is likely creeping in."
      );
      aiTagsEl.innerHTML = "";
      aiTagsEl.appendChild(tagElement("Start with fixed costs"));
      aiTagsEl.appendChild(tagElement("Then track lifestyle"));
      aiTagsEl.appendChild(tagElement("Aim for 20% savings"));
      return;
    }

    const {
      income,
      essentials,
      lifestyle,
      debt,
      totalExpenses,
      net,
      savingsRate,
    } = summary;

    const lifestyleShare =
      totalExpenses > 0 ? (lifestyle / totalExpenses) * 100 : 0;
    const debtShare = totalExpenses > 0 ? (debt / totalExpenses) * 100 : 0;

    // 1. Cash flow synopsis
    let tone;
    if (net > 0 && savingsRate >= 0.2) {
      tone = "You&apos;re running a healthy surplus with a strong savings rate.";
    } else if (net > 0 && savingsRate < 0.2) {
      tone =
        "You do have a surplus, but a relatively small slice is going to savings.";
    } else if (net < 0) {
      tone =
        "You&apos;re in a net negative position over the last month – spending is outpacing income.";
    } else {
      tone = "You&apos;re hovering around break-even with little margin.";
    }

    pushMessage(
      "<strong>Cash flow overview.</strong> " +
        tone +
        " In the last 30 days you logged " +
        formatCurrency(income) +
        " of income versus " +
        formatCurrency(totalExpenses) +
        " of outflows, leaving " +
        formatCurrency(net) +
        " after everything."
    );

    // 2. Lifestyle & discretionary habits
    if (lifestyleShare >= 45) {
      pushMessage(
        "<strong>Lifestyle is doing the heavy lifting.</strong> Around " +
          Math.round(lifestyleShare) +
          "% of spending is going into discretionary categories like eating out, shopping, and other lifestyle items. Pick the 2 biggest ones and trial a 25% cap for the next month – don&apos;t cut them to zero, just intentionally reduce volume."
      );
    } else if (lifestyleShare >= 25) {
      pushMessage(
        "<strong>Balanced but flexible.</strong> Roughly " +
          Math.round(lifestyleShare) +
          "% of recent spend is discretionary. That&apos;s workable – you can likely free up 5–10% of income by tightening just eating out and impulse shopping while keeping quality of life intact."
      );
    } else if (lifestyleShare > 0) {
      pushMessage(
        "<strong>Lifestyle spend is quite lean.</strong> Only about " +
          Math.round(lifestyleShare) +
          "% of expenses are discretionary. If this feels sustainable, you could re-route some of that margin into a &quot;fun&quot; sinking fund to avoid burnout while still hitting goals."
      );
    } else {
      pushMessage(
        "<strong>No lifestyle categories logged yet.</strong> Once you add things like eating out, shopping, and entertainment, I&apos;ll show you how they stack up versus fixed costs."
      );
    }

    // 3. Debt focus
    if (debtShare >= 25) {
      pushMessage(
        "<strong>Debt is a major line item.</strong> About " +
          Math.round(debtShare) +
          "% of your outflows are going to debt repayments. Consider whether you can temporarily divert some lifestyle spend into accelerating the highest-interest balance – even a small overpayment every month shortens the payoff timeline."
      );
    } else if (debtShare > 0) {
      pushMessage(
        "<strong>Debt is present but contained.</strong> Debt repayments make up about " +
          Math.round(debtShare) +
          "% of spending. Keeping this below ~15–20% of income protects your flexibility; if it ever creeps much higher, revisit new borrowing and aim to pay down one balance aggressively."
      );
    }

    // 4. Concrete nudge
    const targetSavingsRate = 0.2;
    if (income > 0 && savingsRate < targetSavingsRate) {
      const desiredSavings = income * targetSavingsRate;
      const gap = desiredSavings - Math.max(0, net);
      if (gap > 0) {
        pushMessage(
          "<strong>Actionable nudge.</strong> To reach a 20% savings rate you&apos;d want roughly " +
            formatCurrency(desiredSavings) +
            " going into savings; you&apos;re short by about " +
            formatCurrency(gap) +
            ". Easiest experiment: cap eating out and shopping at a combined weekly envelope, and automatically move that freed-up amount on payday."
        );
      } else {
        pushMessage(
          "<strong>Actionable nudge.</strong> You&apos;re at or above a 20% savings rate. Lock this in by automating a transfer right after income hits, so lifestyle spending adjusts to what&apos;s left rather than the other way round."
        );
      }
    } else if (income > 0 && savingsRate >= targetSavingsRate) {
      pushMessage(
        "<strong>You&apos;re doing the important things right.</strong> With a savings rate around " +
          Math.round(savingsRate * 100) +
          "%, the biggest win now is consistency. You could optionally raise the target by 2–3% during higher-income months while still keeping room for enjoyment."
      );
    }

    // tags
    aiTagsEl.innerHTML = "";
    if (net < 0) {
      aiTagsEl.appendChild(tagElement("Net negative month"));
      aiTagsEl.appendChild(tagElement("Cut 1–2 big categories"));
    } else if (net > 0 && savingsRate >= 0.2) {
      aiTagsEl.appendChild(tagElement("Healthy surplus"));
      aiTagsEl.appendChild(tagElement("Automate transfers"));
    } else {
      aiTagsEl.appendChild(tagElement("Guard against lifestyle creep"));
      aiTagsEl.appendChild(tagElement("Build buffer"));
    }

    if (lifestyleShare >= 30) {
      aiTagsEl.appendChild(tagElement("Lifestyle dominates spend"));
    }
    if (debtShare >= 20) {
      aiTagsEl.appendChild(tagElement("Debt-heavy budget"));
    }
    if (aiTagsEl.children.length === 0) {
      aiTagsEl.appendChild(tagElement("Steady progress"));
    }
  }

  function tagElement(text) {
    const span = document.createElement("span");
    span.className = "ai-tag";
    span.textContent = text;
    return span;
  }

  function renderAll() {
    renderTransactions();
    renderSummary();
    renderChart();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const description = descriptionInput.value.trim();
    const amountRaw = amountInput.value;
    const amount = Number(amountRaw);
    const category = categorySelect.value;
    const date = dateInput.value || toISODateOnly(new Date());

    if (!description || !amount || !category) {
      return;
    }

    const type = category === "income" ? "income" : "expense";

    const tx = {
      id: "tx_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      description,
      category,
      amount,
      date,
      type,
    };

    transactions.push(tx);
    saveState();

    descriptionInput.value = "";
    amountInput.value = "";
    if (categorySelect.value !== "income") {
      categorySelect.value = "";
    }

    renderAll();
    generateAIInsights();
  });

  demoFillBtn.addEventListener("click", () => {
    if (
      transactions.length > 0 &&
      !confirm(
        "This will add sample income and expenses on top of your existing data. Continue?"
      )
    ) {
      return;
    }

    const today = new Date();
    function daysAgo(n) {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return toISODateOnly(d);
    }

    const demoTxs = [
      {
        description: "Salary",
        category: "income",
        amount: 3200,
        date: daysAgo(2),
      },
      {
        description: "Freelance project",
        category: "income",
        amount: 600,
        date: daysAgo(10),
      },
      {
        description: "Rent",
        category: "housing",
        amount: 1200,
        date: daysAgo(1),
      },
      {
        description: "Groceries – weekly shop",
        category: "groceries",
        amount: 85,
        date: daysAgo(3),
      },
      {
        description: "Groceries – top up",
        category: "groceries",
        amount: 32,
        date: daysAgo(7),
      },
      {
        description: "Gym membership",
        category: "health",
        amount: 40,
        date: daysAgo(5),
      },
      {
        description: "Streaming bundle",
        category: "subscriptions",
        amount: 28,
        date: daysAgo(6),
      },
      {
        description: "Dinner out with friends",
        category: "eating_out",
        amount: 64,
        date: daysAgo(4),
      },
      {
        description: "Coffee & pastries",
        category: "eating_out",
        amount: 18,
        date: daysAgo(0),
      },
      {
        description: "Clothes shopping",
        category: "shopping",
        amount: 120,
        date: daysAgo(8),
      },
      {
        description: "Fuel",
        category: "transport",
        amount: 55,
        date: daysAgo(9),
      },
      {
        description: "Credit card payment",
        category: "debt",
        amount: 150,
        date: daysAgo(11),
      },
    ];

    for (const d of demoTxs) {
      transactions.push({
        id: "tx_demo_" + Math.random().toString(16).slice(2),
        description: d.description,
        category: d.category,
        amount: d.amount,
        date: d.date,
        type: d.category === "income" ? "income" : "expense",
      });
    }

    saveState();
    renderAll();
    generateAIInsights();
  });

  refreshAiBtn.addEventListener("click", () => {
    generateAIInsights();
  });

  clearBtn.addEventListener("click", () => {
    if (
      transactions.length === 0 ||
      confirm("Clear all transactions and reset the dashboard?")
    ) {
      transactions = [];
      saveState();
      renderAll();
      generateAIInsights();
    }
  });

  window.addEventListener("resize", () => {
    renderChart();
  });

  // Bootstrap
  initDate();
  loadState();
  renderAll();
  generateAIInsights();
})();
