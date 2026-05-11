// Main application logic

let currentSurvey = null;
let currentTemplate = null;
let currentLetterTemplate = null;
let currentFormData = null;
let navigatedFromDirectory = false;

// DOM Elements
const directoryView = document.getElementById('directoryView');
const surveyView = document.getElementById('surveyView');
const letterView = document.getElementById('letterView');
const templateGrid = document.getElementById('templateGrid');
const surveyElement = document.getElementById('surveyElement');
const surveyTitle = document.getElementById('surveyTitle');
const surveyDescription = document.getElementById('surveyDescription');
const templateDocCallout = document.getElementById('templateDocCallout');
const templateDocLink = document.getElementById('templateDocLink');
const letterTitle = document.getElementById('letterTitle');
const letterContent = document.getElementById('letterContent');
const generateButton = document.getElementById('generateButton');
const backButton = document.getElementById('backButton');
const editButton = document.getElementById('editButton');
const copyButton = document.getElementById('copyButton');
const emailButton = document.getElementById('emailButton');
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
    emailButton.addEventListener('click', handleEmail);

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const templateId = params.get('template');
        if (templateId) {
            navigatedFromDirectory = true; // User went back/forward, so there's history
            loadTemplate(templateId);
        } else {
            navigatedFromDirectory = false;
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
            navigatedFromDirectory = true;
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
    surveyDescription.textContent = template.description;

    // Show/hide Word template link
    if (template.templateDocUrl) {
        templateDocLink.href = template.templateDocUrl;
        templateDocCallout.style.display = '';
    } else {
        templateDocCallout.style.display = 'none';
    }

    // Only show back button if user navigated from directory
    backButton.style.display = navigatedFromDirectory ? '' : 'none';

    // Create SurveyJS model
    currentSurvey = new Survey.Model(formConfig);

    // Restore previous data if editing
    if (currentFormData) {
        currentSurvey.data = currentFormData;
    }

    // Render survey to DOM - create fresh container to avoid SurveyJS re-render issues
    surveyElement.innerHTML = '<div id="surveyContainer"></div>';
    const container = document.getElementById('surveyContainer');
    currentSurvey.render(container);

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

    gtag('event', 'letter_start', {
        'template': template.id
    });
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
        const errorFields = currentSurvey.getAllQuestions()
            .filter(q => q.errors && q.errors.length > 0)
            .map(q => q.name);
        gtag('event', 'letter_error', {
            'template': currentTemplate.id,
            'error_fields': errorFields.join(',')
        });
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

    gtag('event', 'letter_generate', {
        'template': currentTemplate.id
    });
}

/**
 * Handle back button click
 */
function handleBack() {
    currentFormData = null;
    navigatedFromDirectory = false;
    history.pushState({}, '', window.location.pathname);
    showDirectoryView();
}

/**
 * Handle edit button click
 */
function handleEdit() {
    fetch(`templates/${currentTemplate.id}.form.json`)
        .then(response => response.json())
        .then(formConfig => {
            showSurveyView(currentTemplate, formConfig);
        })
        .catch(error => {
            console.error('Error loading form config:', error);
            showToast('Error loading form');
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
            gtag('event', 'letter_action', {
                'method': 'clipboard',
                'template': currentTemplate.id
            });
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
 * Handle email button click
 */
function handleEmail() {
    const plainText = letterContent.dataset.plainText || letterContent.innerText;
    const subject = encodeURIComponent(currentTemplate.name);
    // Use %0D%0A for line breaks (CRLF) which works better with email clients like Gmail
    const body = encodeURIComponent(plainText).replace(/%0A/g, '%0D%0A');
    gtag('event', 'letter_action', {
        'method': 'email',
        'template': currentTemplate.id
    });
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
        gtag('event', 'letter_action', {
            'method': 'clipboard',
            'template': currentTemplate.id
        });
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
