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
const letterTitle = document.getElementById('letterTitle');
const letterContent = document.getElementById('letterContent');
const generateButton = document.getElementById('generateButton');
const backButton = document.getElementById('backButton');
const editButton = document.getElementById('editButton');
const copyButton = document.getElementById('copyButton');
const toast = document.getElementById('toast');

// Address fields that need Google Places Autocomplete
const addressFieldNames = [
    'tenant_address_full',
    'landlord_address_full',
    'tenant_forwarding_address_full'
];

// Track autocomplete instances to prevent duplicates
const autocompleteInstances = new Map();

/**
 * Initialize Google Places Autocomplete on address fields
 */
async function initAddressAutocomplete() {
    // Wait for Google Maps API to load (googleMapsReady is set in index.html)
    if (!window.googleMapsReady) {
        return;
    }

    // Import the Places library for the new API
    await google.maps.importLibrary('places');

    addressFieldNames.forEach(fieldName => {
        // SurveyJS wraps questions in divs with data-name attribute
        const questionContainer = surveyElement.querySelector(`[data-name="${fieldName}"]`);
        const input = questionContainer ? questionContainer.querySelector('input[type="text"]') : null;
        if (!input || autocompleteInstances.has(input)) {
            return;
        }

        // Create the new PlaceAutocompleteElement
        const autocompleteEl = new google.maps.places.PlaceAutocompleteElement({
            includedRegionCodes: ['ca'],
            includedPrimaryTypes: ['street_address', 'subpremise', 'premise']
        });

        // Style the autocomplete element to match
        autocompleteEl.style.width = '100%';
        autocompleteEl.setAttribute('placeholder', 'Search for a Canadian address');

        // Hide the original input and insert autocomplete element
        input.style.display = 'none';
        input.parentNode.insertBefore(autocompleteEl, input);

        // When user selects a place, update the hidden input value
        autocompleteEl.addEventListener('gmp-placeselect', async (event) => {
            const place = event.place;
            await place.fetchFields({ fields: ['formattedAddress'] });
            if (place.formattedAddress) {
                input.value = place.formattedAddress;
                // Trigger SurveyJS to recognize the change
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        autocompleteInstances.set(input, autocompleteEl);
    });
}

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

    // Initialize Google Places Autocomplete on address fields
    initAddressAutocomplete();
    currentSurvey.onAfterRenderQuestion.add((survey, options) => {
        if (addressFieldNames.includes(options.question.name)) {
            initAddressAutocomplete();
        }
    });

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
