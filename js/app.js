// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Failed', err));
    });
}

// App State
let state = {
    income: 0,
    categories: [
        { id: '1', name: 'Comida', limit: 200 },
        { id: '2', name: 'Gasolina', limit: 100 },
        { id: '3', name: 'Suscripciones', limit: 50 },
        { id: '4', name: 'Ocio', limit: 150 },
        { id: '5', name: 'Ezra', limit: 100 }
    ],
    expenses: [],
    archives: [],
    selectedCategoryId: '1',
    currentDate: new Date().toISOString()
};

let balanceChart = null;
let historyChart = null;

// DOM Elements
const categoryList = document.getElementById('category-list');
const recentExpensesList = document.getElementById('recent-expenses-list');
const totalSpentEl = document.getElementById('total-spent');
const totalBudgetEl = document.getElementById('total-budget');
const totalIncomeEl = document.getElementById('total-income');
const totalBalanceEl = document.getElementById('total-balance');
const totalProgressBar = document.getElementById('total-progress');
const expenseModal = document.getElementById('expense-modal');
const categoryModal = document.getElementById('category-modal');
const incomeModal = document.getElementById('income-modal');
const historyModal = document.getElementById('history-modal');
const modalCategoryBadges = document.getElementById('modal-category-badges');
const historyListContainer = document.getElementById('history-list-container');

// --- Initialization ---
function init() {
    const oldState = localStorage.getItem('gastoProState');
    const savedState = localStorage.getItem('TeiLoAhorrasteState');
    
    if (savedState) {
        state = JSON.parse(savedState);
    } else if (oldState) {
        state = JSON.parse(oldState);
        save(); // Migrate to new key
    }
    
    updateDateDisplay();
    initChart();
    initHistoryChart();
    render();
}

function save() {
    localStorage.setItem('TeiLoAhorrasteState', JSON.stringify(state));
}

function updateDateDisplay() {
    const date = new Date(state.currentDate);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    document.getElementById('date-display').textContent = `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// --- Chart ---
function initChart() {
    const ctx = document.getElementById('balanceChart').getContext('2d');
    balanceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Gastado', 'Restante'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#9d50bb', '#2d313e'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            cutout: '75%',
            plugins: { legend: { display: false } }
        }
    });
}

function updateChart(spent, incomeValue) {
    if (!balanceChart) return;
    const balance = incomeValue - spent;
    balanceChart.data.datasets[0].data = [spent, Math.max(0, balance)];
    balanceChart.data.datasets[0].backgroundColor = [
        spent > incomeValue ? '#ef4444' : '#9d50bb',
        '#2d313e'
    ];
    balanceChart.update();
}

// --- Historical Chart ---
function initHistoryChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    historyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Gastado',
                data: [],
                backgroundColor: '#9d50bb',
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.parsed.y.toFixed(2)} €`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                }
            }
        }
    });
    updateHistoryChart();
}

function updateHistoryChart() {
    if (!historyChart || state.archives.length === 0) {
        document.getElementById('history-chart-section').style.display = 'none';
        return;
    }
    
    document.getElementById('history-chart-section').style.display = 'block';
    
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    // Take last 6 months
    const lastMonths = state.archives.slice(-6);
    
    historyChart.data.labels = lastMonths.map(item => {
        const d = new Date(item.date);
        return `${months[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
    });
    
    historyChart.data.datasets[0].data = lastMonths.map(item => {
        return item.categories.reduce((acc, c) => acc + (c.spent || 0), 0);
    });
    
    historyChart.update();
}

// --- Rendering ---
function render() {
    renderCategories();
    renderRecentExpenses();
    renderDashboard();
    renderModalBadges();
    lucide.createIcons();
}

function getSpentByCategory(catId) {
    return state.expenses
        .filter(exp => exp.categoryId === catId)
        .reduce((sum, exp) => sum + exp.amount, 0);
}

function renderCategories() {
    categoryList.innerHTML = '';
    state.categories.forEach(cat => {
        const spent = getSpentByCategory(cat.id);
        const percent = (spent / cat.limit) * 100;
        const colorClass = percent >= 100 ? 'over' : (percent > 90 ? 'warning' : '');
        
        const card = document.createElement('div');
        card.className = `category-card ${colorClass}`;
        card.onclick = () => openCategoryModal(cat.id);
        
        card.innerHTML = `
            <div class="category-header">
                <div class="category-info">
                    <div class="category-icon"><i data-lucide="tag"></i></div>
                    <div class="category-name">${cat.name}</div>
                </div>
                <div class="category-meta">
                    <div class="category-amount">${spent.toFixed(2)} €</div>
                    <div class="category-limit">de ${cat.limit.toFixed(2)} €</div>
                </div>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${Math.min(percent, 100)}%; background: ${percent >= 100 ? '#ef4444' : 'var(--primary-gradient)'}"></div>
            </div>
        `;
        categoryList.appendChild(card);
    });
}

function renderRecentExpenses() {
    recentExpensesList.innerHTML = '';
    const recent = [...state.expenses].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    
    if (recent.length === 0) {
        recentExpensesList.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:20px; font-size:0.8rem;">Sin gastos este mes.</div>';
        return;
    }

    recent.forEach(exp => {
        const cat = state.categories.find(c => c.id === exp.categoryId) || { name: 'Sin cat.' };
        const date = new Date(exp.date);
        
        const item = document.createElement('div');
        item.className = 'expense-item';
        item.innerHTML = `
            <div class="expense-info">
                <div class="expense-concept">${exp.concept || 'Gasto'}</div>
                <div class="expense-date-cat">${date.toLocaleDateString()} • ${cat.name}</div>
            </div>
            <div class="expense-actions">
                <div class="expense-val">${exp.amount.toFixed(2)} €</div>
                <button onclick="deleteExpense('${exp.id}')" class="delete-expense-btn">
                    <i data-lucide="trash-2" style="width: 16px;"></i>
                </button>
            </div>
        `;
        recentExpensesList.appendChild(item);
    });
}

function renderDashboard() {
    const totalSpent = state.expenses.reduce((acc, exp) => acc + exp.amount, 0);
    const totalLimit = state.categories.reduce((acc, cat) => acc + cat.limit, 0);
    const balance = state.income - totalSpent;
    const percent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

    totalSpentEl.textContent = `${totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
    totalBudgetEl.textContent = `${totalLimit.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
    totalIncomeEl.textContent = `${state.income.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
    totalBalanceEl.textContent = `${balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
    totalBalanceEl.style.color = balance < 0 ? '#ef4444' : '#f1f5f9';
    
    totalProgressBar.style.width = `${Math.min(percent, 100)}%`;
    totalProgressBar.style.background = percent >= 100 ? '#ef4444' : 'var(--primary-gradient)';
    
    updateChart(totalSpent, state.income);
}

function renderModalBadges() {
    modalCategoryBadges.innerHTML = '';
    state.categories.forEach(cat => {
        const badge = document.createElement('div');
        badge.className = `category-badge ${state.selectedCategoryId === cat.id ? 'active' : ''}`;
        badge.textContent = cat.name;
        badge.onclick = () => {
            state.selectedCategoryId = cat.id;
            renderModalBadges();
        };
        modalCategoryBadges.appendChild(badge);
    });
}

// --- Modal Logic ---
function openExpenseModal() {
    expenseModal.style.display = 'flex';
    setTimeout(() => expenseModal.querySelector('.modal').classList.add('active'), 10);
}

function closeExpenseModal() {
    expenseModal.querySelector('.modal').classList.remove('active');
    setTimeout(() => expenseModal.style.display = 'none', 300);
}

function openIncomeModal() {
    incomeModal.style.display = 'flex';
    setTimeout(() => incomeModal.querySelector('.modal').classList.add('active'), 10);
}

function closeIncomeModal() {
    incomeModal.querySelector('.modal').classList.remove('active');
    setTimeout(() => incomeModal.style.display = 'none', 300);
}

function openHistoryModal() {
    renderHistory();
    historyModal.style.display = 'flex';
    setTimeout(() => historyModal.querySelector('.modal').classList.add('active'), 10);
}

function closeHistoryModal() {
    historyModal.querySelector('.modal').classList.remove('active');
    setTimeout(() => historyModal.style.display = 'none', 300);
}

let editingCategoryId = null;
function openCategoryModal(catId = null) {
    editingCategoryId = catId;
    const deleteBtn = document.getElementById('cat-delete-btn');
    const title = categoryModal.querySelector('.modal-title');
    
    if (catId) {
        const cat = state.categories.find(c => c.id === catId);
        document.getElementById('cat-name').value = cat.name;
        document.getElementById('cat-limit').value = cat.limit;
        deleteBtn.style.display = 'block';
        title.textContent = 'Editar Categoría';
    } else {
        document.getElementById('category-form').reset();
        deleteBtn.style.display = 'none';
        title.textContent = 'Nueva Categoría';
    }
    
    categoryModal.style.display = 'flex';
    setTimeout(() => categoryModal.querySelector('.modal').classList.add('active'), 10);
}

function closeCategoryModal() {
    categoryModal.querySelector('.modal').classList.remove('active');
    setTimeout(() => categoryModal.style.display = 'none', 300);
}

// --- Actions ---
function deleteExpense(id) {
    if (confirm('¿Eliminar este gasto?')) {
        state.expenses = state.expenses.filter(e => e.id !== id);
        save();
        render();
    }
}

// --- Form Handling ---
document.getElementById('expense-form').onsubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const concept = document.getElementById('expense-concept').value;
    
    const cat = state.categories.find(c => c.id === state.selectedCategoryId);
    if (cat) {
        const currentSpent = getSpentByCategory(cat.id);
        if (currentSpent + amount > cat.limit) {
            showNotification(`¡Presupuesto superado en ${cat.name}!`);
        }
        
        state.expenses.push({
            id: Date.now().toString(),
            amount,
            concept,
            categoryId: state.selectedCategoryId,
            date: new Date().toISOString()
        });
        
        save();
        render();
        closeExpenseModal();
        e.target.reset();
    }
};

document.getElementById('income-form').onsubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('income-amount').value);
    state.income += amount;
    save();
    render();
    closeIncomeModal();
    e.target.reset();
};

document.getElementById('category-form').onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value;
    const limit = parseFloat(document.getElementById('cat-limit').value);
    
    if (editingCategoryId) {
        const cat = state.categories.find(c => c.id === editingCategoryId);
        cat.name = name;
        cat.limit = limit;
    } else {
        state.categories.push({ id: Date.now().toString(), name, limit });
    }
    
    save();
    render();
    closeCategoryModal();
};

document.getElementById('cat-delete-btn').onclick = () => {
    if (confirm('¿Eliminar esta categoría?')) {
        state.categories = state.categories.filter(c => c.id !== editingCategoryId);
        // Clean up expenses for deleted category? Maybe better to keep them as "Uncategorized"
        save();
        render();
        closeCategoryModal();
    }
};

document.getElementById('new-cycle-btn').onclick = () => {
    if (confirm('¿Cerrar el mes actual y empezar uno nuevo? Se guardará un histórico.')) {
        state.archives.push({
            date: state.currentDate,
            income: state.income,
            categories: state.categories.map(c => ({...c, spent: getSpentByCategory(c.id)}))
        });
        state.income = 0;
        state.expenses = [];
        const d = new Date(state.currentDate);
        d.setMonth(d.getMonth() + 1);
        state.currentDate = d.toISOString();
        updateDateDisplay();
        save();
        updateHistoryChart();
        render();
    }
};

function renderHistory() {
    historyListContainer.innerHTML = '';
    if (state.archives.length === 0) {
        historyListContainer.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:20px;">Sin meses finalizados.</div>';
        return;
    }
    state.archives.forEach(item => {
        const totalSpent = item.categories.reduce((acc, c) => acc + (c.spent || 0), 0);
        const balance = item.income - totalSpent;
        const date = new Date(item.date);
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<div class="history-date">${months[date.getMonth()]} ${date.getFullYear()}</div><div class="history-stats"><div class="history-stat"><span>Ingresos</span><strong>${item.income.toFixed(2)}€</strong></div><div class="history-stat"><span>Gastos</span><strong>${totalSpent.toFixed(2)}€</strong></div><div class="history-stat"><span>Balance</span><strong style="color: ${balance < 0 ? '#ef4444' : 'var(--success)'}">${balance.toFixed(2)}€</strong></div></div>`;
        historyListContainer.appendChild(div);
    });
}

function showNotification(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #ef4444; color: white; padding: 15px 25px; border-radius: 12px; z-index: 1000; box-shadow: 0 10px 20px rgba(0,0,0,0.3); font-weight: 600; animation: fadeIn 0.3s ease-out;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 3000);
}

document.getElementById('add-expense-btn').onclick = openExpenseModal;
document.getElementById('close-expense-modal').onclick = closeExpenseModal;
document.getElementById('close-category-modal').onclick = closeCategoryModal;
document.getElementById('close-income-modal').onclick = closeIncomeModal;
document.getElementById('history-btn').onclick = openHistoryModal;
document.getElementById('close-history-modal').onclick = closeHistoryModal;

init();
