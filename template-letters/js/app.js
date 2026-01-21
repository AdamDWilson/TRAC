// Main application logic

let currentSurvey = null;
let currentTemplate = null;
let currentLetterTemplate = null;
let currentFormData = null;

// DOM Elements
const directoryView = document.getElementById('directoryView');
const surveyView = document.getElementById('surveyView');
const letterView = document.getElementById('letterView');
const templateGrid = document.getElementById('templateGrid');
const surveyElement = document.getElementById('surveyElement');
const surveyTitle = document.getElementById('surveyTitle');
const letterTitle = document.getElementById('letterTitle');
const letterContent = document.getElementById('letterContent');
const generateButton = document.getElementById('generateButton');
const backButton = document.getElementById('backButton');
const editButton = document.getElementById('editButton');
const copyButton = document.getElementById('copyButton');
const toast = document.getElementById('toast');

/**
 * Initialize the application
 */
function init() {
    // Parse URL for template parameter
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get('template');

    if (templateId) {
        // Load specific template
        loadTemplate(templateId);
    } else {
        // Show directory
        showDirectoryView();
    }

    // Set up event listeners
    setupEventListeners();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    generateButton.addEventListener('click', handleGenerate);
    backButton.addEventListener('click', handleBack);
    editButton.addEventListener('click', handleEdit);
    copyButton.addEventListener('click', handleCopy);

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const templateId = params.get('template');
        if (templateId) {
            loadTemplate(templateId);
        } else {
            showDirectoryView();
        }
    });
}

/**
 * Load template by ID
 */
async function loadTemplate(id) {
    // Find template metadata
    const template = TEMPLATES.find(t => t.id === id);
    if (!template) {
        showToast('Template not found');
        showDirectoryView();
        return;
    }

    currentTemplate = template;

    try {
        // Fetch template files
        const [letterResponse, formResponse] = await Promise.all([
            fetch(`templates/${id}.letter.md`),
            fetch(`templates/${id}.form.json`)
        ]);

        if (!letterResponse.ok || !formResponse.ok) {
            throw new Error('Failed to load template files');
        }

        currentLetterTemplate = await letterResponse.text();
        const formConfig = await formResponse.json();

        // Show survey view
        showSurveyView(template, formConfig);

    } catch (error) {
        console.error('Error loading template:', error);
        showToast('Error loading template');
        showDirectoryView();
    }
}

/**
 * Show directory view
 */
function showDirectoryView() {
    // Update URL
    history.pushState({}, '', window.location.pathname);

    // Clear and populate grid
    templateGrid.innerHTML = '';

    // Sort templates by index
    const sortedTemplates = [...TEMPLATES].sort((a, b) => a.index - b.index);

    sortedTemplates.forEach(template => {
        const card = document.createElement('a');
        card.href = `?template=${template.id}`;
        card.className = 'template-card';
        card.innerHTML = `
            <h2>${template.name}</h2>
            <p>${template.description}</p>
        `;
        card.addEventListener('click', (e) => {
            e.preventDefault();
            history.pushState({}, '', `?template=${template.id}`);
            loadTemplate(template.id);
        });
        templateGrid.appendChild(card);
    });

    // Show directory, hide others
    directoryView.classList.remove('hidden');
    surveyView.classList.add('hidden');
    letterView.classList.add('hidden');
}

/**
 * Show survey view
 */
function showSurveyView(template, formConfig) {
    surveyTitle.textContent = template.name;

    // Create SurveyJS model
    currentSurvey = new Survey.Model(formConfig);

    // Restore previous data if editing
    if (currentFormData) {
        currentSurvey.data = currentFormData;
    }

    // Render survey to DOM
    surveyElement.innerHTML = '';
    currentSurvey.render(surveyElement);

    // Set inputmode="decimal" on number inputs for iOS numeric keyboard
    function setNumericInputModes() {
        surveyElement.querySelectorAll('input[type="number"]').forEach(input => {
            input.setAttribute('inputmode', 'decimal');
        });
    }
    setNumericInputModes();
    currentSurvey.onAfterRenderQuestion.add(setNumericInputModes);

    // Show survey, hide others
    directoryView.classList.add('hidden');
    surveyView.classList.remove('hidden');
    letterView.classList.add('hidden');
}

/**
 * Show letter view
 */
function showLetterView(html) {
    letterTitle.textContent = currentTemplate.name;
    letterContent.innerHTML = html;

    // Show letter, hide others
    directoryView.classList.add('hidden');
    surveyView.classList.add('hidden');
    letterView.classList.remove('hidden');

    // Scroll to top of page
    window.scrollTo(0, 0);
}

/**
 * Handle generate button click
 */
function handleGenerate() {
    if (!currentSurvey) return;

    // Validate
    if (!currentSurvey.validate()) {
        showToast('Please fill in all required fields');
        return;
    }

    // Get form data
    currentFormData = currentSurvey.data;

    // Render letter
    const { html, text } = renderLetter(currentLetterTemplate, { ...currentFormData });

    // Store plain text for clipboard
    letterContent.dataset.plainText = text;

    // Show letter
    showLetterView(html);
}

/**
 * Handle back button click
 */
function handleBack() {
    currentFormData = null;
    history.pushState({}, '', window.location.pathname);
    showDirectoryView();
}

/**
 * Handle edit button click
 */
function handleEdit() {
    // Reload form config and re-show survey with existing data
    fetch(`templates/${currentTemplate.id}.form.json`)
        .then(response => response.json())
        .then(formConfig => {
            showSurveyView(currentTemplate, formConfig);
        });
}

/**
 * Handle copy button click
 */
async function handleCopy() {
    const plainText = letterContent.dataset.plainText || letterContent.innerText;

    try {
        // Modern clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(plainText);
            showToast('Copied to clipboard!');
        } else {
            // Fallback for older browsers
            fallbackCopy(plainText);
        }
    } catch (error) {
        console.error('Copy failed:', error);
        fallbackCopy(plainText);
    }
}

/**
 * Fallback copy using execCommand
 */
function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
        showToast('Copied to clipboard!');
    } catch (error) {
        showToast('Failed to copy');
    }

    document.body.removeChild(textarea);
}

/**
 * Show toast notification
 */
function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');

    // Trigger reflow for animation
    toast.offsetHeight;
    toast.classList.add('visible');

    // Hide after delay
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 2000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
