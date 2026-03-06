// Main JavaScript file for College Event Management System

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips and other UI components
    initializeTooltips();
    initializeCharts();
    setupEventHandlers();
});

function initializeTooltips() {
    // Add tooltip functionality if needed
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'absolute bg-gray-800 text-white text-xs rounded px-2 py-1 z-50';
            tooltip.textContent = this.getAttribute('data-tooltip');
            tooltip.style.top = (this.offsetTop - 30) + 'px';
            tooltip.style.left = this.offsetLeft + 'px';
            document.body.appendChild(tooltip);
            
            this.addEventListener('mouseleave', function() {
                tooltip.remove();
            }, { once: true });
        });
    });
}

function initializeCharts() {
    // Chart initialization is handled in individual view files
    // This function can be used for global chart settings
    Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';
    Chart.defaults.color = '#4a5568';
}

function setupEventHandlers() {
    // Handle form submissions with AJAX
    const forms = document.querySelectorAll('form[data-ajax]');
    forms.forEach(form => {
        form.addEventListener('submit', handleAjaxForm);
    });

    // Handle delete confirmations
    const deleteButtons = document.querySelectorAll('[data-confirm-delete]');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteConfirmation);
    });

    // Handle dynamic content loading
    const loadMoreButtons = document.querySelectorAll('[data-load-more]');
    loadMoreButtons.forEach(button => {
        button.addEventListener('click', handleLoadMore);
    });
}

function handleAjaxForm(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const url = form.getAttribute('action');
    const method = form.getAttribute('method') || 'POST';

    fetch(url, {
        method: method,
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message || 'Operation successful', 'success');
            if (data.redirect) {
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 1500);
            }
        } else {
            showNotification(data.message || 'Operation failed', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred. Please try again.', 'error');
    });
}

function handleDeleteConfirmation(e) {
    const message = e.target.getAttribute('data-confirm-delete') || 'Are you sure you want to delete this item?';
    
    if (confirm(message)) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = e.target.getAttribute('data-url');
        
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (csrfToken) {
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = 'csrf_token';
            csrfInput.value = csrfToken.getAttribute('content');
            form.appendChild(csrfInput);
        }
        
        document.body.appendChild(form);
        form.submit();
    }
}

function handleLoadMore(e) {
    const button = e.target;
    const url = button.getAttribute('data-load-more');
    const container = button.getAttribute('data-container');
    const targetContainer = document.querySelector(container);
    
    if (!targetContainer) return;
    
    button.disabled = true;
    button.textContent = 'Loading...';
    
    fetch(url)
    .then(response => response.text())
    .then(html => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const newItems = tempDiv.querySelector(container).innerHTML;
        targetContainer.innerHTML += newItems;
        
        // Update or remove button based on response
        const hasMore = tempDiv.querySelector('[data-load-more]');
        if (!hasMore) {
            button.remove();
        } else {
            button.disabled = false;
            button.textContent = 'Load More';
            button.setAttribute('data-load-more', hasMore.getAttribute('data-load-more'));
        }
    })
    .catch(error => {
        console.error('Error loading more content:', error);
        button.disabled = false;
        button.textContent = 'Load More';
        showNotification('Failed to load more content', 'error');
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;
    
    const colors = {
        success: 'bg-green-100 border-l-4 border-green-500 text-green-700',
        error: 'bg-red-100 border-l-4 border-red-500 text-red-700',
        warning: 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700',
        info: 'bg-blue-100 border-l-4 border-blue-500 text-blue-700'
    };
    
    notification.className += ' ' + colors[type];
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <div class="flex">
            <div class="flex-shrink-0">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="ml-3">
                <p class="text-sm font-medium">${message}</p>
            </div>
            <div class="ml-auto pl-3">
                <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
        notification.classList.add('translate-x-0');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Utility functions
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(time) {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Search functionality
const searchInputs = document.querySelectorAll('[data-search]');
searchInputs.forEach(input => {
    input.addEventListener('input', debounce(function(e) {
        const query = e.target.value;
        const url = e.target.getAttribute('data-search');
        const container = e.target.getAttribute('data-search-container');
        
        if (query.length < 2) {
            // Reset to original content if query is too short
            return;
        }
        
        fetch(`${url}?q=${encodeURIComponent(query)}`)
        .then(response => response.text())
        .then(html => {
            const targetContainer = document.querySelector(container);
            if (targetContainer) {
                targetContainer.innerHTML = html;
            }
        })
        .catch(error => {
            console.error('Search error:', error);
        });
    }, 300));
});

// Print functionality
function printElement(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print</title>
            <style>
                body { font-family: system-ui, sans-serif; margin: 20px; }
                .no-print { display: none; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            ${element.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Export functionality
function exportToCSV(data, filename) {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function convertToCSV(data) {
    if (!data || !data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') 
                ? `"${value}"` 
                : value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}
