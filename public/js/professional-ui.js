/**
 * Professional UI JavaScript Library
 * Modern, accessible, and responsive UI components
 */

class ProfessionalUI {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupAnimations();
        this.setupTooltips();
        this.setupModals();
        this.setupDropdowns();
        this.setupFormValidation();
        this.setupLoadingStates();
    }

    // Event Listeners
    setupEventListeners() {
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    this.smoothScrollTo(target);
                }
            });
        });

        // Ripple effect for buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.prof-btn, .btn')) {
                this.createRipple(e);
            }
        });
    }

    // Animations
    setupAnimations() {
        // Intersection Observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in');
                }
            });
        }, observerOptions);

        // Observe all elements with data-animate attribute
        document.querySelectorAll('[data-animate]').forEach(el => {
            observer.observe(el);
        });
    }

    // Tooltips
    setupTooltips() {
        const tooltipTriggers = document.querySelectorAll('[data-tooltip]');
        
        tooltipTriggers.forEach(trigger => {
            trigger.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, trigger.getAttribute('data-tooltip'));
            });
            
            trigger.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'prof-tooltip';
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: absolute;
            background: var(--gray-900);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
        
        setTimeout(() => {
            tooltip.style.opacity = '1';
        }, 10);
    }

    hideTooltip() {
        const tooltip = document.querySelector('.prof-tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                tooltip.remove();
            }, 200);
        }
    }

    // Modals
    setupModals() {
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Close modals on background click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('prof-modal')) {
                this.closeAllModals();
            }
        });
    }

    openModal(content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'prof-modal';
        modal.innerHTML = `
            <div class="prof-modal-content">
                <div class="prof-card-header">
                    <h3>${options.title || 'Modal'}</h3>
                    <button class="prof-modal-close" onclick="this.closest('.prof-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="prof-card-body">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }

    closeModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove('active');
            setTimeout(() => {
                modalElement.remove();
            }, 300);
        }
    }

    closeAllModals() {
        document.querySelectorAll('.prof-modal.active').forEach(modal => {
            this.closeModal(modal);
        });
    }

    // Dropdowns
    setupDropdowns() {
        document.addEventListener('click', (e) => {
            const dropdown = e.target.closest('.prof-dropdown');
            if (dropdown) {
                e.preventDefault();
                this.toggleDropdown(dropdown);
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.prof-dropdown')) {
                document.querySelectorAll('.prof-dropdown.active').forEach(dropdown => {
                    dropdown.classList.remove('active');
                });
            }
        });
    }

    toggleDropdown(dropdown) {
        const content = dropdown.querySelector('.prof-dropdown-content');
        if (dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
            this.animateDropdown(content, false);
        } else {
            dropdown.classList.add('active');
            this.animateDropdown(content, true);
        }
    }

    animateDropdown(content, show) {
        if (show) {
            content.style.opacity = '1';
            content.style.transform = 'translateY(0)';
            content.style.visibility = 'visible';
        } else {
            content.style.opacity = '0';
            content.style.transform = 'translateY(-10px)';
            content.style.visibility = 'hidden';
        }
    }

    // Form Validation
    setupFormValidation() {
        const forms = document.querySelectorAll('form[data-validate]');
        
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                if (!this.validateForm(form)) {
                    e.preventDefault();
                    this.showFormErrors(form);
                }
            });

            // Real-time validation
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                input.addEventListener('blur', () => {
                    this.validateField(input);
                });
                
                input.addEventListener('input', () => {
                    this.clearFieldError(input);
                });
            });
        });
    }

    validateForm(form) {
        let isValid = true;
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                this.showFieldError(field, 'This field is required');
            } else {
                this.clearFieldError(field);
            }
        });

        return isValid;
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Email validation
        if (field.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        }

        // Password validation
        if (field.type === 'password') {
            if (value.length < 8) {
                isValid = false;
                errorMessage = 'Password must be at least 8 characters long';
            }
        }

        // Phone validation
        if (field.type === 'tel') {
            const phoneRegex = /^[\d\s\-\(\)]+$/;
            if (!phoneRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid phone number';
            }
        }

        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }

        return isValid;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        field.classList.add('border-red-500');
        
        const errorElement = document.createElement('div');
        errorElement.className = 'prof-field-error';
        errorElement.textContent = message;
        errorElement.style.cssText = `
            color: var(--error-600);
            font-size: 12px;
            margin-top: 4px;
        `;
        
        field.parentNode.appendChild(errorElement);
    }

    clearFieldError(field) {
        field.classList.remove('border-red-500');
        const errorElement = field.parentNode.querySelector('.prof-field-error');
        if (errorElement) {
            errorElement.remove();
        }
    }

    showFormErrors(form) {
        const errorContainer = form.querySelector('.prof-form-errors') || 
                            this.createFormErrorContainer(form);
        
        errorContainer.innerHTML = '';
        errorContainer.style.display = 'block';
        
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (!input.value.trim() && input.hasAttribute('required')) {
                const errorItem = document.createElement('div');
                errorItem.className = 'prof-error-item';
                errorItem.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    ${input.getAttribute('data-error-message') || 'This field is required'}
                `;
                errorContainer.appendChild(errorItem);
            }
        });
    }

    createFormErrorContainer(form) {
        const container = document.createElement('div');
        container.className = 'prof-form-errors';
        container.style.cssText = `
            background: var(--error-50);
            border: 1px solid var(--error-200);
            border-radius: var(--radius-lg);
            padding: 16px;
            margin-bottom: 16px;
            display: none;
        `;
        
        form.insertBefore(container, form.firstChild);
        return container;
    }

    // Loading States
    setupLoadingStates() {
        this.loadingStates = new Map();
    }

    showLoading(element, options = {}) {
        const loadingElement = document.createElement('div');
        loadingElement.className = 'prof-loading-overlay';
        loadingElement.innerHTML = `
            <div class="prof-loading-spinner">
                <div class="prof-loading-ring"></div>
                <div class="prof-loading-ring"></div>
                <div class="prof-loading-ring"></div>
            </div>
            <div class="prof-loading-text">${options.text || 'Loading...'}</div>
        `;
        
        loadingElement.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
        `;
        
        element.style.position = 'relative';
        element.appendChild(loadingElement);
        this.loadingStates.set(element, loadingElement);
    }

    hideLoading(element) {
        const loadingElement = this.loadingStates.get(element);
        if (loadingElement) {
            loadingElement.style.opacity = '0';
            setTimeout(() => {
                loadingElement.remove();
                this.loadingStates.delete(element);
            }, 300);
        }
    }

    // Utility Functions
    smoothScrollTo(element) {
        const offset = 80; // Header offset
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }

    // Notification System
    showNotification(message, type = 'info', options = {}) {
        const notification = document.createElement('div');
        notification.className = `prof-notification prof-notification-${type}`;
        notification.innerHTML = `
            <div class="prof-notification-content">
                <div class="prof-notification-icon">
                    <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                </div>
                <div class="prof-notification-message">
                    <h4>${options.title || 'Notification'}</h4>
                    <p>${message}</p>
                </div>
                <button class="prof-notification-close" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        if (options.autoClose !== false) {
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, options.duration || 5000);
        }
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Counter Animation
    animateCounter(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            element.textContent = Math.floor(current);
            
            if (current >= target) {
                element.textContent = target;
                clearInterval(timer);
            }
        }, 16);
    }

    // Progress Bar
    createProgressBar(container, options = {}) {
        const progressBar = document.createElement('div');
        progressBar.className = 'prof-progress';
        progressBar.innerHTML = `
            <div class="prof-progress-bar" style="width: ${options.percentage || 0}%"></div>
            ${options.showLabel ? `<span class="prof-progress-label">${options.percentage || 0}%</span>` : ''}
        `;
        
        if (container) {
            container.appendChild(progressBar);
        }
        
        return progressBar;
    }

    // Tab System
    createTabContainer(container, tabs) {
        const tabContainer = document.createElement('div');
        tabContainer.className = 'prof-tab-container';
        
        const tabHeaders = document.createElement('div');
        tabHeaders.className = 'prof-tab-headers';
        
        const tabContent = document.createElement('div');
        tabContent.className = 'prof-tab-content';
        
        tabs.forEach((tab, index) => {
            const tabButton = document.createElement('button');
            tabButton.className = `prof-tab-button ${index === 0 ? 'active' : ''}`;
            tabButton.innerHTML = `
                <i class="fas fa-${tab.icon}"></i>
                ${tab.label}
            `;
            tabButton.addEventListener('click', () => {
                this.switchTab(tabButton, tab.content, tabContent, tabs);
            });
            
            const contentDiv = document.createElement('div');
            contentDiv.className = `prof-tab-pane ${index === 0 ? 'active' : ''}`;
            contentDiv.innerHTML = tab.content;
            
            tabHeaders.appendChild(tabButton);
            tabContent.appendChild(contentDiv);
        });
        
        tabContainer.appendChild(tabHeaders);
        tabContainer.appendChild(tabContent);
        
        if (container) {
            container.appendChild(tabContainer);
        }
    }

    switchTab(activeButton, content, tabContent, allTabs) {
        // Remove active class from all tabs
        allTabs.forEach((tab, index) => {
            const button = tabContent.children[index];
            const pane = tabContent.children[index];
            button.classList.remove('active');
            pane.classList.remove('active');
        });
        
        // Add active class to clicked tab
        const tabIndex = Array.from(tabContent.children).indexOf(content);
        const button = tabContent.children[tabIndex];
        const pane = tabContent.children[tabIndex];
        button.classList.add('active');
        pane.classList.add('active');
    }
}

// Initialize Professional UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.profUI = new ProfessionalUI();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfessionalUI;
}
