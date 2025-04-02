// jobApplicationBot.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class JobApplicationBot {
  constructor(userData) {
    this.userData = userData;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.formMappings = {};
    this.loggedInSites = new Map();
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: false // Set to true in production, false for debugging
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        geolocation: { longitude: -122.084, latitude: 37.422 },
        permissions: ['geolocation'],
        recordVideo: {
          dir: 'videos/',
          size: { width: 1280, height: 800 }
        }
      });
      this.page = await this.context.newPage();
      
      // Load saved mappings if available
      await this.loadFormMappings();
      
      // Load saved cookies/sessions if available
      await this.loadSavedSessions();
      
      return true;
    } catch (error) {
      console.error('Error initializing browser:', error);
      return false;
    }
  }

  async loadFormMappings() {
    try {
      if (fs.existsSync('data/form_mappings.json')) {
        const mappingsJson = fs.readFileSync('data/form_mappings.json', 'utf8');
        this.formMappings = JSON.parse(mappingsJson);
      }
    } catch (error) {
      console.error('Error loading form mappings:', error);
    }
  }

  async saveFormMappings() {
    try {
      if (!fs.existsSync('data')) {
        fs.mkdirSync('data');
      }
      fs.writeFileSync('data/form_mappings.json', JSON.stringify(this.formMappings, null, 2));
    } catch (error) {
      console.error('Error saving form mappings:', error);
    }
  }

  async loadSavedSessions() {
    try {
      if (fs.existsSync('data/sessions.json')) {
        const sessionsJson = fs.readFileSync('data/sessions.json', 'utf8');
        const sessions = JSON.parse(sessionsJson);
        
        for (const session of sessions) {
          this.loggedInSites.set(session.domain, {
            username: session.username,
            cookie: session.cookie
          });
          
          // Restore cookies for this domain
          if (session.cookie) {
            await this.context.addCookies([session.cookie]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved sessions:', error);
    }
  }

  async saveSessions() {
    try {
      if (!fs.existsSync('data')) {
        fs.mkdirSync('data');
      }
      
      const sessions = [];
      for (const [domain, data] of this.loggedInSites.entries()) {
        sessions.push({
          domain,
          username: data.username,
          cookie: data.cookie
        });
      }
      
      fs.writeFileSync('data/sessions.json', JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }

  async applyToJob(url) {
    try {
      console.log(`Starting application for job at: ${url}`);
      
      // Navigate to the job posting
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Check for login requirement
      const requiresLogin = await this.checkLoginRequirement();
      
      if (requiresLogin) {
        const loggedIn = await this.handleAuthentication(url);
        if (!loggedIn) {
          console.error('Failed to authenticate. Aborting application.');
          return {
            success: false,
            message: 'Authentication failed'
          };
        }
      }
      
      // Start the application process
      const applyButton = await this.findApplyButton();
      if (applyButton) {
        await applyButton.click();
        
        // Wait for the application form to load
        await this.page.waitForLoadState('networkidle');
        
        // Process the application across multiple pages if needed
        const result = await this.processMultiPageApplication();
        
        return result;
      } else {
        console.error('Could not find an apply button on the page.');
        return {
          success: false,
          message: 'Could not find application button'
        };
      }
    } catch (error) {
      console.error('Error applying to job:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  async findApplyButton() {
    // Common apply button selectors
    const applyButtonSelectors = [
      'button:has-text("Apply")',
      'a:has-text("Apply")',
      'button:has-text("Apply Now")',
      'a:has-text("Apply Now")',
      '[role="button"]:has-text("Apply")',
      '[role="button"]:has-text("Apply Now")',
      'button:has-text("Easy Apply")',
      'a:has-text("Easy Apply")',
      'button:has-text("Quick Apply")',
      'a:has-text("Quick Apply")'
    ];
    
    for (const selector of applyButtonSelectors) {
      const button = await this.page.$(selector);
      if (button) {
        return button;
      }
    }
    
    return null;
  }

  async checkLoginRequirement() {
    // Check for common login indicators
    const loginSelectors = [
      'button:has-text("Sign In")',
      'a:has-text("Sign In")',
      'button:has-text("Log In")',
      'a:has-text("Log In")',
      'form[action*="login"]',
      'form[action*="signin"]',
      'input[name="username"]',
      'input[name="email"]:visible',
      'input[name="password"]:visible'
    ];
    
    for (const selector of loginSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        return true;
      }
    }
    
    return false;
  }

  async handleAuthentication(url) {
    // Extract domain from URL
    const domain = new URL(url).hostname;
    
    // Check if we already have login info for this domain
    if (this.loggedInSites.has(domain)) {
      console.log(`Already have login info for ${domain}`);
      // Check if the cookies are still valid
      const isLoggedIn = await this.checkIfStillLoggedIn();
      if (isLoggedIn) {
        return true;
      }
    }
    
    // Determine the login strategy based on the domain
    if (domain.includes('linkedin')) {
      return await this.handleLinkedInLogin();
    } else if (domain.includes('indeed')) {
      return await this.handleIndeedLogin();
    } else if (domain.includes('glassdoor')) {
      return await this.handleGlassdoorLogin();
    } else {
      // Generic login handling
      return await this.handleGenericLogin(domain);
    }
  }

  async checkIfStillLoggedIn() {
    // Check for login indicators vs logged-in indicators
    const loginIndicators = [
      'button:has-text("Sign In")',
      'a:has-text("Sign In")',
      'button:has-text("Log In")',
      'a:has-text("Log In")'
    ];
    
    const loggedInIndicators = [
      '[aria-label="Profile"]',
      '[aria-label="Account"]',
      '.user-profile',
      '.user-avatar',
      '.profile-menu'
    ];
    
    // If any login indicators are visible, we're not logged in
    for (const selector of loginIndicators) {
      const element = await this.page.$(selector);
      if (element && await element.isVisible()) {
        return false;
      }
    }
    
    // If any logged-in indicators are visible, we're logged in
    for (const selector of loggedInIndicators) {
      const element = await this.page.$(selector);
      if (element && await element.isVisible()) {
        return true;
      }
    }
    
    // Default to not logged in if we can't determine
    return false;
  }

  async handleLinkedInLogin() {
    try {
      // Check if we're already on the login page, if not navigate to it
      if (!this.page.url().includes('linkedin.com/login')) {
        await this.page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
      }
      
      // Fill in login details
      await this.page.fill('input#username', this.userData.linkedinCredentials.username);
      await this.page.fill('input#password', this.userData.linkedinCredentials.password);
      
      // Click sign in button
      await this.page.click('button[type="submit"]');
      
      // Wait for navigation to complete
      await this.page.waitForLoadState('networkidle');
      
      // Check if login was successful
      const isLoggedIn = await this.page.$('.global-nav__me-photo');
      
      if (isLoggedIn) {
        console.log('Successfully logged into LinkedIn');
        
        // Save the session
        const cookies = await this.context.cookies();
        this.loggedInSites.set('linkedin.com', {
          username: this.userData.linkedinCredentials.username,
          cookie: cookies.find(c => c.name === 'li_at')
        });
        
        await this.saveSessions();
        return true;
      } else {
        console.error('Failed to log into LinkedIn');
        return false;
      }
    } catch (error) {
      console.error('Error during LinkedIn login:', error);
      return false;
    }
  }

  async handleIndeedLogin() {
    try {
      // Check if we're already on the login page, if not navigate to it
      if (!this.page.url().includes('indeed.com/account/login')) {
        await this.page.goto('https://www.indeed.com/account/login', { waitUntil: 'domcontentloaded' });
      }
      
      // Fill in login details
      await this.page.fill('input[name="email"]', this.userData.indeedCredentials.username);
      await this.page.click('button[type="submit"]');
      
      // Wait for password field to appear
      await this.page.waitForSelector('input[name="password"]');
      await this.page.fill('input[name="password"]', this.userData.indeedCredentials.password);
      
      // Click sign in button
      await this.page.click('button[type="submit"]');
      
      // Wait for navigation to complete
      await this.page.waitForLoadState('networkidle');
      
      // Check if login was successful
      const isLoggedIn = await this.page.$('.gnav-menu');
      
      if (isLoggedIn) {
        console.log('Successfully logged into Indeed');
        
        // Save the session
        const cookies = await this.context.cookies();
        this.loggedInSites.set('indeed.com', {
          username: this.userData.indeedCredentials.username,
          cookie: cookies.find(c => c.name === 'JSESSIONID')
        });
        
        await this.saveSessions();
        return true;
      } else {
        console.error('Failed to log into Indeed');
        return false;
      }
    } catch (error) {
      console.error('Error during Indeed login:', error);
      return false;
    }
  }

  async handleGlassdoorLogin() {
    try {
      // Check if we're already on the login page, if not navigate to it
      if (!this.page.url().includes('glassdoor.com/profile/login')) {
        await this.page.goto('https://www.glassdoor.com/profile/login_input.htm', { waitUntil: 'domcontentloaded' });
      }
      
      // Fill in login details
      await this.page.fill('input[name="username"]', this.userData.glassdoorCredentials.username);
      await this.page.fill('input[name="password"]', this.userData.glassdoorCredentials.password);
      
      // Click sign in button
      await this.page.click('button[type="submit"]');
      
      // Wait for navigation to complete
      await this.page.waitForLoadState('networkidle');
      
      // Check if login was successful
      const isLoggedIn = await this.page.$('[data-test="profilePhoto"]');
      
      if (isLoggedIn) {
        console.log('Successfully logged into Glassdoor');
        
        // Save the session
        const cookies = await this.context.cookies();
        this.loggedInSites.set('glassdoor.com', {
          username: this.userData.glassdoorCredentials.username,
          cookie: cookies.find(c => c.name === 'GSESSIONID')
        });
        
        await this.saveSessions();
        return true;
      } else {
        console.error('Failed to log into Glassdoor');
        return false;
      }
    } catch (error) {
      console.error('Error during Glassdoor login:', error);
      return false;
    }
  }
  
  async handleGenericLogin(domain) {
    try {
      console.log(`Attempting generic login flow for domain: ${domain}`);
      
      // Try to locate login form
      const usernameSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[id="email"]',
        'input[name="username"]',
        'input[id="username"]',
        'input[name="user"]',
        'input[id="user"]'
      ];
      
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id="password"]',
        'input[name="pwd"]',
        'input[id="pwd"]'
      ];
      
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign In")',
        'button:has-text("Log In")',
        'button:has-text("Login")',
        'a:has-text("Sign In")',
        'a:has-text("Log In")'
      ];
      
      // Try to find username field
      let usernameField = null;
      for (const selector of usernameSelectors) {
        const field = await this.page.$(selector);
        if (field && await field.isVisible()) {
          usernameField = field;
          break;
        }
      }
      
      // Try to find password field
      let passwordField = null;
      for (const selector of passwordSelectors) {
        const field = await this.page.$(selector);
        if (field && await field.isVisible()) {
          passwordField = field;
          break;
        }
      }
      
      // Try to find submit button
      let submitButton = null;
      for (const selector of submitSelectors) {
        const button = await this.page.$(selector);
        if (button && await button.isVisible()) {
          submitButton = button;
          break;
        }
      }
      
      if (!usernameField || !passwordField || !submitButton) {
        console.error('Could not find all required login form elements');
        return false;
      }
      
      // Ask for credentials if we don't have them
      if (!this.userData.genericCredentials || !this.userData.genericCredentials[domain]) {
        console.error(`No saved credentials for ${domain}`);
        // In a real application, you would prompt the user for credentials here
        return false;
      }
      
      // Fill in the form
      await usernameField.fill(this.userData.genericCredentials[domain].username);
      await passwordField.fill(this.userData.genericCredentials[domain].password);
      
      // Submit the form
      await submitButton.click();
      
      // Wait for navigation to complete
      await this.page.waitForLoadState('networkidle');
      
      // Check if login was successful by checking for login form absence
      const loginFormStillPresent = await this.checkLoginRequirement();
      
      if (!loginFormStillPresent) {
        console.log(`Successfully logged into ${domain}`);
        
        // Save the session
        const cookies = await this.context.cookies();
        this.loggedInSites.set(domain, {
          username: this.userData.genericCredentials[domain].username,
          cookie: cookies[0] // Just save the first cookie as a marker
        });
        
        await this.saveSessions();
        return true;
      } else {
        console.error(`Failed to log into ${domain}`);
        return false;
      }
    } catch (error) {
      console.error(`Error during login to ${domain}:`, error);
      return false;
    }
  }
}