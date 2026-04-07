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
        { id: '1', name: 'Comida', limit: 200, spent: 0 },
        { id: '2', name: 'Gasolina', limit: 100, spent: 0 },
        { id: '3', name: 'Suscripciones', limit: 50, spent: 0 },
        { id: '4', name: 'Ocio', limit: 150, spent: 0 },
        { id: '5', name: 'Ezra', limit: 100, spent: 0 }
    ],
    expenses: [],
    archives: [],
    selectedCategoryId: '1',
    currentDate: new Date().toISOString()
};

let balanceChart = null;

// DOM Elements
const categoryList = document.getElementById('category-list');
const totalSpentEl = document.getElementById('total-spent');
const totalBudgetEl = document.getElementById('total-budget');
const totalIncomeEl = document.getElementById('total-income');
const totalBalanceEl = document.getElementById('total-balance');
const totalProgressBar = document.getElementById('total-progress');
const expenseModal = document.getElementById('expense-modal');
const categoryModal = document.getElementById('category-modal');
const incomeModal = document.getElementById('income-modal');
const modalCategoryBadges = document.getElementById('modal-category-badges');

// --- Initialization ---
function init() {
    const savedState = localStorage.getItem('gastoProState');
    if (savedState) {
        state = JSON.parse(savedState);
    }
    
    updateDateDisplay();
    initChart();
    render();
}

function save() {
    localStorage.setItem('gastoProState', JSON.stringify(state));
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
            plugins: {
                legend: { display: false }
            }
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

// --- Rendering ---
function render() {
    renderCategories();
    renderDashboard();
    renderModalBadges();
    lucide.createIcons();
}

function renderCategories() {
    categoryList.innerHTML = '';
    state.categories.forEach(cat => {
        const percent = (cat.spent / cat.limit) * 100;
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
                    <div class="category-amount">${cat.spent.toFixed(2)} €</div>
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

function renderDashboard() {
    const totalSpent = state.categories.reduce((acc, cat) => acc + cat.spent, 0);
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

// --- Form Handling ---
document.getElementById('expense-form').onsubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const concept = document.getElementById('expense-concept').value;
    
    const catIndex = state.categories.findIndex(c => c.id === state.selectedCategoryId);
    if (catIndex !== -1) {
        const cat = state.categories[catIndex];
        cat.spent += amount;
        
        if (cat.spent > cat.limit) {
            showNotification(`¡Presupuesto superado en ${cat.name}!`);
        }
        
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
        state.categories.push({ id: Date.now().toString(), name, limit, spent: 0 });
    }
    
    save();
    render();
    closeCategoryModal();
};

document.getElementById('cat-delete-btn').onclick = () => {
    if (confirm('¿Eliminar esta categoría?')) {
        state.categories = state.categories.filter(c => c.id !== editingCategoryId);
        save();
        render();
        closeCategoryModal();
    }
};

// --- Cycle Management ---
document.getElementById('new-cycle-btn').onclick = () => {
    if (confirm('¿Quieres cerrar el mes actual y empezar uno nuevo? Se guardará un histórico y se reiniciarán los gastos e ingresos.')) {
        // Archive
        state.archives.push({
            date: state.currentDate,
            income: state.income,
            categories: JSON.parse(JSON.stringify(state.categories))
        });
        
        // Reset
        state.income = 0;
        state.categories.forEach(c => c.spent = 0);
        state.expenses = [];
        
        // Advance month
        const d = new Date(state.currentDate);
        d.setMonth(d.getMonth() + 1);
        state.currentDate = d.toISOString();
        
        updateDateDisplay();
        save();
        render();
    }
};

// --- Notifications ---
function showNotification(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #ef4444; color: white; padding: 15px 25px; border-radius: 12px; z-index: 1000; box-shadow: 0 10px 20px rgba(0,0,0,0.3); font-weight: 600; animation: fadeIn 0.3s ease-out;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Events
document.getElementById('add-expense-btn').onclick = openExpenseModal;
document.getElementById('close-expense-modal').onclick = closeExpenseModal;
document.getElementById('close-category-modal').onclick = closeCategoryModal;
document.getElementById('close-income-modal').onclick = closeIncomeModal;

init();
