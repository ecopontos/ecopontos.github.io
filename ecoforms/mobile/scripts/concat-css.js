import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..');
const wwwCssDir = path.join(root, 'www', 'css');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateUniversalCSS() {
  ensureDir(wwwCssDir);
  
  const outputFile = path.join(wwwCssDir, 'design-system.css');
  
  // Include component-specific CSS files
  const componentCssDir = path.join(wwwCssDir, 'components', 'fields');
  let componentCSS = '';
  
  if (fs.existsSync(componentCssDir)) {
    const componentFiles = fs.readdirSync(componentCssDir)
      .filter(file => file.endsWith('.css'))
      .map(file => path.join(componentCssDir, file));
    
    for (const file of componentFiles) {
      try {
        const cssContent = fs.readFileSync(file, 'utf8');
        componentCSS += `\n/* === ${path.basename(file)} === */\n${cssContent}\n`;
        console.log(`✓ Included component CSS: ${path.basename(file)}`);
      } catch (error) {
        console.warn(`Warning: Could not read component CSS file ${file}:`, error.message);
      }
    }
  }
  
  // Universal Mobile CSS - Mobile-first responsive design
  const universalMobileCSS = `/* Universal Mobile-First CSS - EcoForms App */
/* Generated: ${new Date().toISOString()} */
/* Mobile-first responsive design - optimized for touch interfaces */

:root {
  /* == UNIVERSAL COLOR SYSTEM == */
  
  /* Primary Colors - Modern Blue Palette */
  --color-primary: #1E3A5F;
  --color-primary-light: #3D5A7C;
  --color-primary-dark: #003D5C;
  --color-primary-hover: #2A4A6F;
  --color-primary-active: #152A45;
  --color-primary-surface: rgba(30, 58, 95, 0.08);
  --color-primary-rgb: 30, 58, 95;
  
  /* Secondary Colors - Cyan Accent */
  --color-secondary: #5DCDDE;
  --color-secondary-light: #A8D5E2;
  --color-secondary-surface: rgba(93, 205, 222, 0.08);
  --color-secondary-hover: rgba(44, 122, 123, 0.2);
  --color-secondary-active: rgba(44, 122, 123, 0.25);
  
  /* Surface Colors - Universal design */
  --color-background: #FEFEFE;
  --color-surface: #FFFFFF;
  --color-surface-variant: #F7F9F9;
  --color-surface-elevated: #FFFFFF;
  --color-surface-tonal: rgba(0, 106, 106, 0.05);
  
  /* Text Colors - High contrast for all screens */
  --color-text: #1A202C;
  --color-text-primary: #1A202C;
  --color-text-secondary: #4A5568;
  --color-text-tertiary: #718096;
  --color-text-inverse: #FFFFFF;
  --color-text-disabled: #A0AEC0;
  
  /* Status Colors - Clear visual feedback */
  --color-success: #38A169;
  --color-success-light: #68D391;
  --color-success-surface: rgba(56, 161, 105, 0.1);
  --color-success-rgb: 56, 161, 105;
  
  --color-warning: #ED8936;
  --color-warning-light: #F6AD55;
  --color-warning-surface: rgba(237, 137, 54, 0.1);
  --color-warning-rgb: 237, 137, 54;
  
  --color-error: #E53E3E;
  --color-error-light: #FC8181;
  --color-error-surface: rgba(229, 62, 62, 0.1);
  --color-error-rgb: 229, 62, 62;
  
  --color-info: #3182CE;
  --color-info-light: #63B3ED;
  --color-info-surface: rgba(49, 130, 206, 0.1);
  --color-info-rgb: 49, 130, 206;
  
  /* Border Colors */
  --color-border: #E2E8F0;
  --color-border-strong: #CBD5E0;
  --color-border-focus: var(--color-primary);
  --color-divider: #F1F5F9;
  --color-card-border: rgba(0, 106, 106, 0.12);
  --color-card-border-inner: rgba(0, 106, 106, 0.12);
  
  /* Legacy compatibility colors */
  --color-cream-50: #FEFEFE;
  --color-cream-100: #FFFFFF;
  --color-slate-900: #1A202C;
  --color-slate-500: #4A5568;
  --color-teal-500: #1E3A5F;
  --color-teal-600: #2A4A6F;
  --color-teal-700: #152A45;
  --color-btn-primary-text: var(--color-text-inverse);
  
  /* Focus styles */
  --focus-ring: 0 0 0 3px var(--color-primary-surface);
  --focus-outline: 2px solid var(--color-primary);
  --color-focus-ring: rgba(var(--color-primary-rgb), 0.4);
  
  /* == UNIVERSAL SPACING SYSTEM == */
  /* Mobile-first spacing that works on all devices */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  
  /* Form-specific spacing */
  --form-field-gap: var(--space-4);
  --form-section-gap: var(--space-8);
  --form-padding: var(--space-4);
  --form-padding-large: var(--space-6);
  
  /* Legacy spacing compatibility */
  --spacing-xs: var(--space-1);
  --spacing-sm: var(--space-2);
  --spacing-md: var(--space-4);
  --spacing-lg: var(--space-6);
  --spacing-xl: var(--space-8);
  
  /* == UNIVERSAL TYPOGRAPHY == */
  /* Mobile-optimized typography for all devices */
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;
  --font-family: var(--font-family-base);
  --font-family-mono: "Berkeley Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  --font-size-4xl: 36px;
  
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;
  
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* == UNIVERSAL FORM DIMENSIONS == */
  /* Touch-friendly sizes for all devices */
  --touch-target-min: 48px;
  --input-height: 56px;
  --input-height-compact: 48px;
  --button-height: 56px;
  --button-height-compact: 48px;
  --checkbox-size: 24px;
  --radio-size: 24px;
  --footer-height: 88px;
  
  /* == BORDER RADIUS == */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-base: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  /* Form-specific radius */
  --input-radius: var(--radius-base);
  --button-radius: var(--radius-lg);
  --card-radius: var(--radius-lg);
  
  /* == SHADOWS == */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-base: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  
  /* Legacy shadow compatibility */
  --md-sys-elevation-level1: var(--shadow-sm);
  --md-sys-elevation-level2: var(--shadow-base);
  --md-sys-elevation-level3: var(--shadow-lg);
  
  /* == TRANSITIONS == */
  --transition-fast: 150ms ease-out;
  --transition-base: 200ms ease-out;
  --transition-slow: 300ms ease-out;
  
  /* Legacy transition compatibility */
  --duration-fast: var(--transition-fast);
  --ease-standard: ease-out;
  
  /* == Z-INDEX SCALE == */
  --z-dropdown: 1000;
  --z-modal: 1050;
  --z-popover: 1100;
  --z-tooltip: 1150;
  --z-toast: 1200;
  
  /* == SELECT CARET ICONS == */
  --select-caret-light: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234A5568' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  --select-caret-dark: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
}

/* == UNIVERSAL BASE STYLES == */
/* Mobile-first design applied to all screen sizes */
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  -moz-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  background-color: var(--color-background);
  margin: 0;
  padding: 0;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* == UNIVERSAL FORM CONTAINER == */
/* Mobile-first form design for all devices */
.form-container,
.container {
  max-width: min(800px, 100vw);
  padding: var(--form-padding);
  margin: 0 auto;
  background: var(--color-surface);
  min-height: 100vh;
}

/* == ENHANCED MOBILE FORM HEADER == */
.form-header {
  position: sticky;
  top: 0;
  z-index: 200;
  background: var(--color-primary, #1E3A5F);
  color: white;
  padding: var(--space-4) var(--form-padding) var(--space-5);
  padding-top: calc(var(--space-4) + env(safe-area-inset-top, 0px));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 106, 106, 0.25);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.form-header-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: min(800px, 100vw);
  margin: 0 auto;
}

/* Top bar with navigation and status */
.header-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.header-nav-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.back-button {
  padding: var(--space-2);
  border-radius: var(--radius-base);
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 40px;
  font-weight: bold;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.header-breadcrumb {
  font-size: var(--font-size-xs);
  opacity: 0.8;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  opacity: 0.9;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success, #38A169);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Main title section */
.header-title-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: white;
  margin: 0;
  line-height: var(--line-height-tight);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.form-subtitle {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  line-height: var(--line-height-normal);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Progress and metadata */
.header-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.form-progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  opacity: 0.9;
}

.progress-bar {
  width: 80px;
  height: 6px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffffff 0%, #e6ffff 100%);
  border-radius: 3px;
  transition: width var(--transition-base);
  width: 0%;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
}

.form-context {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-xs);
  opacity: 0.85;
  flex-wrap: wrap;
}

.context-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.context-icon {
  font-size: 14px;
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .form-header {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
  
  .form-title {
    font-size: var(--font-size-lg);
  }
  
  .header-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  
  .form-context {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 360px) {
  .header-top-bar {
    flex-wrap: wrap;
  }
  
  .header-breadcrumb {
    display: none;
  }
}

/* == UNIVERSAL FORM FIELDS == */
/* Touch-friendly form fields for all devices */
.form-field,
.field-container {
  margin-bottom: var(--form-field-gap);
}

.form-body {
  padding-bottom: calc(var(--footer-height, 88px) + var(--space-4));
  margin-bottom: calc(-1 * var(--footer-height, 88px));
  position: relative;
  z-index: 0;
}

.form-field:last-child,
.field-container:last-child {
  margin-bottom: 0;
}

.form-label,
.field-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
  line-height: var(--line-height-normal);
}

.form-label-required::after,
.field-label.required::after {
  content: ' *';
  color: var(--color-error);
}

/* == UNIVERSAL INPUT STYLES == */
/* Touch-optimized inputs for all devices */
.form-input,
.form-select,
.form-textarea,
.field-input,
.field-select,
.field-textarea,
input[type="text"],
input[type="email"],
input[type="number"],
input[type="password"],
input[type="search"],
input[type="tel"],
input[type="url"],
input[type="date"],
input[type="datetime-local"],
input[type="time"],
select,
textarea {
  width: 100%;
  height: var(--input-height);
  padding: var(--space-4);
  font-size: var(--font-size-base);
  font-family: var(--font-family);
  color: var(--color-text-primary);
  background-color: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--input-radius);
  outline: none;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  appearance: none;
  -webkit-appearance: none;
}

.form-textarea,
.field-textarea,
textarea {
  height: auto;
  min-height: calc(var(--input-height) * 2);
  resize: vertical;
  line-height: var(--line-height-normal);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus,
.field-input:focus,
.field-select:focus,
.field-textarea:focus,
input:focus,
select:focus,
textarea:focus {
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-surface);
}

.form-input::placeholder,
.form-textarea::placeholder,
.field-input::placeholder,
.field-textarea::placeholder,
input::placeholder,
textarea::placeholder {
  color: var(--color-text-tertiary);
}

.form-input:disabled,
.form-select:disabled,
.form-textarea:disabled,
.field-input:disabled,
.field-select:disabled,
.field-textarea:disabled,
input:disabled,
select:disabled,
textarea:disabled {
  background-color: var(--color-surface-variant);
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

/* == UNIVERSAL SELECT STYLING == */
.form-select,
.field-select,
select {
  background-image: var(--select-caret-light);
  background-repeat: no-repeat;
  background-position: right var(--space-3) center;
  background-size: 20px;
  padding-right: var(--space-10);
}

/* == UNIVERSAL BUTTON STYLES == */
/* Touch-friendly buttons for all devices */
.form-button,
.btn,
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--button-height);
  padding: var(--space-4) var(--space-6);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family);
  border-radius: var(--button-radius);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
  outline: none;
  position: relative;
  overflow: hidden;
  -webkit-user-select: none;
  user-select: none;
  text-decoration: none;
}

.form-button:active,
.btn:active,
button:active {
  transform: translateY(1px);
}

.form-button:disabled,
.btn:disabled,
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

/* Button Variants */
.form-button-primary,
.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.form-button-primary:hover:not(:disabled),
.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  box-shadow: var(--shadow-sm);
}

.form-button-secondary,
.btn-secondary {
  background-color: var(--color-surface-elevated);
  color: var(--color-text-primary);
  border: 2px solid var(--color-border-strong);
}

.form-button-secondary:hover:not(:disabled),
.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
  border-color: var(--color-primary);
}

.form-button-success,
.btn-success {
  background-color: var(--color-success);
  color: var(--color-text-inverse);
}

.form-button-error,
.btn-error {
  background-color: var(--color-error);
  color: var(--color-text-inverse);
}

/* == UNIVERSAL FORM SECTIONS == */
.form-section {
  margin-bottom: var(--form-section-gap);
  padding: var(--form-padding-large);
  background: var(--color-surface-elevated);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-xs);
}

.form-section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-4);
  line-height: var(--line-height-tight);
}

/* == UNIVERSAL VALIDATION STYLES == */
.form-field-error .form-input,
.form-field-error .form-select,
.form-field-error .form-textarea,
.field-error input,
.field-error select,
.field-error textarea {
  border-color: var(--color-error);
  background-color: var(--color-error-surface);
}

.form-field-error .form-input:focus,
.form-field-error .form-select:focus,
.form-field-error .form-textarea:focus,
.field-error input:focus,
.field-error select:focus,
.field-error textarea:focus {
  box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.2);
}

.form-error-message,
.field-error-message {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-error);
  margin-top: var(--space-2);
  line-height: var(--line-height-normal);
}

.form-success-message {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-success);
  margin-top: var(--space-2);
  line-height: var(--line-height-normal);
}

/* == UNIVERSAL CHECKBOX & RADIO == */
.form-checkbox,
.form-radio {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  cursor: pointer;
  padding: var(--space-2) 0;
  min-height: var(--touch-target-min);
}

.form-checkbox input,
.form-radio input {
  width: var(--checkbox-size);
  height: var(--checkbox-size);
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px; /* Align with first line of text */
}

.form-checkbox-label,
.form-radio-label {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
  cursor: pointer;
  flex: 1;
}

/* == RESPONSIVE ENHANCEMENTS (Tablets/Landscape) == */
/* Scale up for larger screens while maintaining mobile design */
@media (min-width: 768px) {
  .form-container,
  .container {
    max-width: 800px;
    padding: var(--space-8);
    margin: var(--space-8) auto;
    border-radius: var(--card-radius);
    box-shadow: var(--shadow-base);
  }
  
  .form-header {
    padding: var(--space-8);
    border-radius: var(--card-radius) var(--card-radius) 0 0;
  }
  
  .form-title {
    font-size: var(--font-size-3xl);
  }
  
  .form-section {
    padding: var(--space-8);
  }
  
  /* Multi-column layouts for desktop */
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
  
  .form-row.three-columns {
    grid-template-columns: 1fr 1fr 1fr;
  }
  
  .form-field.full-width {
    grid-column: 1 / -1;
  }
}

/* == LARGE SCREEN ENHANCEMENTS == */
@media (min-width: 1200px) {
  .form-container,
  .container {
    max-width: 1000px;
  }
  
  .form-row {
    gap: var(--space-8);
  }
}

/* == MOBILE SPECIFIC ADJUSTMENTS == */
@media (max-width: 480px) {
  :root {
    --form-padding: var(--space-3);
    --form-padding-large: var(--space-4);
    --input-height: 52px;
    --button-height: 52px;
  }
  
  .form-title {
    font-size: var(--font-size-xl);
  }
  
  .form-section {
    padding: var(--space-4);
    margin-bottom: var(--space-6);
  }
  
  /* Force single column on small screens */
  .form-row {
    display: block;
  }
  
  .form-row .form-field {
    margin-bottom: var(--form-field-gap);
  }
}

/* == DARK MODE SUPPORT == */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #1a1a1a;
    --color-surface: #2d2d2d;
    --color-surface-elevated: #3a3a3a;
    --color-surface-variant: #2a2a2a;
    --color-text-primary: #ffffff;
    --color-text-secondary: #b3b3b3;
    --color-text-tertiary: #8a8a8a;
    --color-border: #404040;
    --color-border-strong: #595959;
    --color-divider: #353535;
  }
  
  .form-select,
  .field-select,
  select {
    background-image: var(--select-caret-dark);
  }
}

/* == ACCESSIBILITY == */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media (prefers-contrast: high) {
  :root {
    --color-border: #000000;
    --color-border-strong: #000000;
    --color-text-primary: #000000;
    --color-text-secondary: #333333;
  }
  
  .form-input,
  .form-select,
  .form-textarea,
  .field-input,
  .field-select,
  .field-textarea,
  input,
  select,
  textarea {
    border-width: 2px;
  }
}

/* == MOBILE APP FOOTER == */
.mobile-footer {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(800px, calc(100vw - var(--space-4) * 2));
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-top: 1px solid var(--color-border, #e2e8f0);
  box-shadow: 0 -2px 12px rgba(15, 23, 42, 0.08);
  z-index: calc(var(--z-modal, 1050) + 10);
  min-height: 64px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  overflow: visible;
}

.mobile-footer .btn-submit {
  flex: 1;
}

.footer-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: var(--space-2);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: background-color var(--transition-fast, 150ms ease-out);
}

.footer-nav-item:hover,
.footer-nav-item:focus-visible {
  background: var(--color-secondary-surface, rgba(44, 122, 123, 0.12));
}

.footer-nav-item .material-icons {
  font-size: 20px;
  margin-bottom: 4px;
}

.footer-nav-item span {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #4a5568);
}

.mobile-footer::before {
  content: '';
  position: absolute;
  top: -24px;
  left: 0;
  right: 0;
  height: 24px;
  background: linear-gradient(to top, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.form-selector-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg);
  max-height: 240px;
  overflow-y: auto;
  z-index: calc(var(--z-dropdown, 1000) + 1);
}

.form-selector-dropdown select {
  width: 100%;
  padding: var(--space-3);
  border: none;
  background: transparent;
  color: var(--color-text-primary, #1a202c);
  font-size: var(--font-size-sm);
}

.form-selector-dropdown select:focus {
  outline: none;
}

/* == UTILITY CLASSES == */
.visually-hidden,
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.w-full { width: 100%; }
.flex { display: flex; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.gap-4 { gap: var(--space-4); }

.mb-4 { margin-bottom: var(--space-4); }
.mb-6 { margin-bottom: var(--space-6); }
.mb-8 { margin-bottom: var(--space-8); }

.mt-4 { margin-top: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }
.mt-8 { margin-top: var(--space-8); }

/* == LOADING STATES == */
.form-loading {
  opacity: 0.7;
  pointer-events: none;
}

.form-button-loading {
  position: relative;
  color: transparent;
}

.form-button-loading::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  top: 50%;
  left: 50%;
  margin-left: -10px;
  margin-top: -10px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* == LEGACY CLASS COMPATIBILITY == */
/* Ensure backwards compatibility with existing forms */
.md-sys-color-primary { color: var(--color-primary); }
.md-sys-color-secondary { color: var(--color-secondary); }
.md-sys-color-surface { background-color: var(--color-surface); }
.md-elevation-1 { box-shadow: var(--shadow-sm); }
.md-elevation-2 { box-shadow: var(--shadow-base); }
.md-elevation-3 { box-shadow: var(--shadow-lg); }
`;
  
  try {
    // Combine universal CSS with component-specific CSS
    const finalCSS = universalMobileCSS + componentCSS;
    fs.writeFileSync(outputFile, finalCSS, 'utf8');
    console.log(`✓ Universal Mobile-Desktop CSS generated: ${outputFile}`);
    console.log('✓ Mobile-first design applied to all devices');
    console.log('✓ Responsive enhancements included (tablets and large screens)');
    console.log('✓ Component-specific styles included');
    console.log('✓ Legacy compatibility maintained');
    console.log(`✓ File size: ${(fs.statSync(outputFile).size / 1024).toFixed(1)}KB`);
  } catch (error) {
    console.error('Error writing CSS file:', error.message);
    process.exit(1);
  }
}

generateUniversalCSS();