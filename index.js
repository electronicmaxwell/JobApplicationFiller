#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ResumeParser = require('./resumeParser');
const JobApplicationBot = require('./jobApplicationBot');
const { importCVJsonCommand } = require('./cvUtils');

// Create necessary directories
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

ensureDirectoryExists('data');
ensureDirectoryExists('logs');
ensureDirectoryExists('videos');

// Setup logging
const logFile = `logs/app-${new Date().toISOString().replace(/:/g, '-')}.log`;
const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + '\n');
};

// Initialize readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for user input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Load user data from file if it exists
const loadUserData = () => {
  try {
    if (fs.existsSync('data/user_data.json')) {
      const data = fs.readFileSync('data/user_data.json', 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading user data: ${error.message}`);
  }
  return null;
};

// Save user data to file
const saveUserData = (userData) => {
  try {
    fs.writeFileSync('data/user_data.json', JSON.stringify(userData, null, 2));
    log('User data saved successfully');
  } catch (error) {
    log(`Error saving user data: ${error.message}`);
  }
};

// Process missing fields and collect additional information
const processMissingFields = async (userData, missingFields) => {
  log(`Processing ${missingFields.length} missing fields`);
  
  for (const field of missingFields) {
    switch (field) {
      case 'fullName':
        userData.personalInfo.fullName = await prompt('Full Name: ');
        break;
      case 'email':
        userData.personalInfo.email = await prompt('Email: ');
        break;
      case 'phone':
        userData.personalInfo.phone = await prompt('Phone Number: ');
        break;
      case 'location':
        userData.personalInfo.location = await prompt('Location (City, State): ');
        break;
      case 'dateOfBirth':
        const includeDob = await prompt('Do you want to include date of birth? (y/n): ');
        if (includeDob.toLowerCase() === 'y') {
          userData.personalInfo.dateOfBirth = await prompt('Date of Birth (MM/DD/YYYY): ');
        }
        break;
      case 'education':
        const addEducation = await prompt('Add education information? (y/n): ');
        if (addEducation.toLowerCase() === 'y') {
          const education = {
            institution: await prompt('Institution Name: '),
            degree: await prompt('Degree: '),
            dates: await prompt('Dates (e.g., 2018-2022): '),
            gpa: await prompt('GPA (optional): ')
          };
          userData.education.push(education);
        }
        break;
      case 'completeEducationDetails':
        log('Some education entries have incomplete information');
        for (let i = 0; i < userData.education.length; i++) {
          const edu = userData.education[i];
          if (!edu.degree) {
            edu.degree = await prompt(`Degree for ${edu.institution}: `);
          }
          if (!edu.dates) {
            edu.dates = await prompt(`Dates for ${edu.institution} (e.g., 2018-2022): `);
          }
        }
        break;
      case 'workExperience':
        const addExperience = await prompt('Add work experience? (y/n): ');
        if (addExperience.toLowerCase() === 'y') {
          const experience = {
            company: await prompt('Company Name: '),
            title: await prompt('Job Title: '),
            dates: await prompt('Dates (e.g., 2018-2022): '),
            description: await prompt('Job Description: ')
          };
          userData.experience.push(experience);
        }
        break;
      case 'completeWorkExperienceDetails':
        log('Some work experience entries have incomplete information');
        for (let i = 0; i < userData.experience.length; i++) {
          const exp = userData.experience[i];
          if (!exp.title) {
            exp.title = await prompt(`Job Title for ${exp.company}: `);
          }
          if (!exp.dates) {
            exp.dates = await prompt(`Dates for ${exp.company} (e.g., 2018-2022): `);
          }
        }
        break;
      case 'skills':
        log('No skills found in resume');
        const skillsInput = await prompt('Enter skills (comma-separated): ');
        userData.skills = skillsInput.split(',').map(skill => skill.trim());
        break;
      case 'languages':
        log('No languages found in resume');
        const addLanguage = await prompt('Add language proficiency? (y/n): ');
        if (addLanguage.toLowerCase() === 'y') {
          const language = {
            language: await prompt('Language: '),
            proficiency: await prompt('Proficiency Level: ')
          };
          userData.languages.push(language);
        }
        break;
      case 'references':
        const addReferences = await prompt('Would you like to add references? (y/n): ');
        if (addReferences.toLowerCase() === 'y') {
          if (!userData.references) {
            userData.references = [];
          }
          const reference = {
            name: await prompt('Reference Name: '),
            title: await prompt('Reference Title: '),
            company: await prompt('Reference Company: '),
            email: await prompt('Reference Email: '),
            phone: await prompt('Reference Phone: ')
          };
          userData.references.push(reference);
        }
        break;
      case 'workAuthorizationStatus':
        userData.workAuthorizationStatus = await prompt('Work Authorization Status: ');
        break;
      case 'socialMediaProfiles':
        if (!userData.socialMediaProfiles) {
          userData.socialMediaProfiles = {};
        }
        const addLinkedIn = await prompt('Add LinkedIn profile? (y/n): ');
        if (addLinkedIn.toLowerCase() === 'y') {
          userData.socialMediaProfiles.linkedin = await prompt('LinkedIn URL: ');
        }
        const addGitHub = await prompt('Add GitHub profile? (y/n): ');
        if (addGitHub.toLowerCase() === 'y') {
          userData.socialMediaProfiles.github = await prompt('GitHub URL: ');
        }
        break;
    }
  }
  
  return userData;
};

// Collect credentials for job sites
const collectCredentials = async (userData) => {
  log('Collecting credentials for job application sites');
  
  if (!userData.linkedinCredentials) {
    const addLinkedIn = await prompt('Add LinkedIn credentials? (y/n): ');
    if (addLinkedIn.toLowerCase() === 'y') {
      userData.linkedinCredentials = {
        username: await prompt('LinkedIn Email: '),
        password: await prompt('LinkedIn Password: ')
      };
    }
  }
  
  if (!userData.indeedCredentials) {
    const addIndeed = await prompt('Add Indeed credentials? (y/n): ');
    if (addIndeed.toLowerCase() === 'y') {
      userData.indeedCredentials = {
        username: await prompt('Indeed Email: '),
        password: await prompt('Indeed Password: ')
      };
    }
  }
  
  if (!userData.glassdoorCredentials) {
    const addGlassdoor = await prompt('Add Glassdoor credentials? (y/n): ');
    if (addGlassdoor.toLowerCase() === 'y') {
      userData.glassdoorCredentials = {
        username: await prompt('Glassdoor Email: '),
        password: await prompt('Glassdoor Password: ')
      };
    }
  }
  
  return userData;
};

// Command: Parse Resume
const parseResume = async (filePath) => {
  try {
    log(`Parsing resume: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      log(`File not found: ${filePath}`);
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    
    const parser = new ResumeParser();
    const { userData, missingFields } = await parser.parseResume(filePath);
    
    log(`Resume parsed successfully. Found ${missingFields.length} missing fields.`);
    console.log('\nResume Information:');
    console.log('-------------------');
    console.log(`Name: ${userData.personalInfo.fullName || 'Not found'}`);
    console.log(`Email: ${userData.personalInfo.email || 'Not found'}`);
    console.log(`Phone: ${userData.personalInfo.phone || 'Not found'}`);
    console.log(`Location: ${userData.personalInfo.location || 'Not found'}`);
    console.log(`Education: ${userData.education.length} entries`);
    console.log(`Experience: ${userData.experience.length} entries`);
    console.log(`Skills: ${userData.skills.length} found`);
    console.log('-------------------');
    
    if (missingFields.length > 0) {
      console.log('\nSome information is missing or incomplete:');
      missingFields.forEach(field => console.log(`- ${field}`));
      
      const fillMissing = await prompt('\nWould you like to provide the missing information now? (y/n): ');
      if (fillMissing.toLowerCase() === 'y') {
        const completeUserData = await processMissingFields(userData, missingFields);
        
        // Collect credentials for job sites
        const finalUserData = await collectCredentials(completeUserData);
        
        // Save the complete information
        saveUserData(finalUserData);
        
        log('All required information has been collected and saved.');
        console.log('\nAll information has been collected and saved successfully!');
      } else {
        saveUserData(userData);
        log('Incomplete user data saved.');
        console.log('\nIncomplete information has been saved. You can update it later using the update-user-data command.');
      }
    } else {
      // Collect credentials for job sites
      const finalUserData = await collectCredentials(userData);
      
      // Save the complete information
      saveUserData(finalUserData);
      
      log('All required information has been collected and saved.');
      console.log('\nAll information has been collected and saved successfully!');
    }
  } catch (error) {
    log(`Error: ${error.message}`);
    console.error(`Error: ${error.message}`);
  } finally {
    rl.close();
  }
};

// Command: Apply to a job
const applyToJob = async (url) => {
  try {
    log(`Applying to job at: ${url}`);
    
    // Load user data
    const userData = loadUserData();
    if (!userData) {
      log('No user data found. Please run parse-resume first.');
      console.error('Error: No user data found. Please run the parse-resume command first.');
      process.exit(1);
    }
    
    // Initialize the bot
    const bot = new JobApplicationBot(userData);
    const initialized = await bot.initialize();
    
    if (!initialized) {
      log('Failed to initialize the browser.');
      console.error('Error: Failed to initialize the browser.');
      process.exit(1);
    }
    
    console.log(`Applying to job at: ${url}`);
    console.log('Please wait while the bot navigates to the job page...');
    
    // Apply to the job
    const result = await bot.applyToJob(url);
    
    if (result.success) {
      log('Job application successful!');
      console.log('\nJob application successful!');
      console.log(`Message: ${result.message}`);
    } else {
      log(`Job application failed: ${result.message}`);
      console.error('\nJob application failed.');
      console.error(`Reason: ${result.message}`);
    }
    
    // Close the browser
    await bot.browser.close();
    
  } catch (error) {
    log(`Error: ${error.message}`);
    console.error(`Error: ${error.message}`);
  } finally {
    process.exit(0);
  }
};

// Command: Apply to multiple jobs
const batchApply = async (filePath) => {
  try {
    log(`Batch applying to jobs from: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      log(`File not found: ${filePath}`);
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const urls = fileContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    log(`Found ${urls.length} job URLs in the file.`);
    console.log(`Found ${urls.length} job URLs in the file.`);
    
    // Load user data
    const userData = loadUserData();
    if (!userData) {
      log('No user data found. Please run parse-resume first.');
      console.error('Error: No user data found. Please run the parse-resume command first.');
      process.exit(1);
    }
    
    // Initialize the bot
    const bot = new JobApplicationBot(userData);
    const initialized = await bot.initialize();
    
    if (!initialized) {
      log('Failed to initialize the browser.');
      console.error('Error: Failed to initialize the browser.');
      process.exit(1);
    }
    
    // Apply to each job
    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n[${i+1}/${urls.length}] Applying to: ${url}`);
      log(`Applying to job ${i+1}/${urls.length}: ${url}`);
      
      const result = await bot.applyToJob(url);
      results.push({
        url,
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        console.log('Application successful!');
      } else {
        console.error(`Application failed: ${result.message}`);
      }
      
      // Wait a bit between applications to avoid being flagged as a bot
      if (i < urls.length - 1) {
        console.log('Waiting before next application...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Close the browser
    await bot.browser.close();
    
    // Report summary
    console.log('\nApplication Summary:');
    console.log('-----------------');
    console.log(`Total: ${urls.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    
    // Save results to file
    const resultFile = `logs/batch-results-${new Date().toISOString().replace(/:/g, '-')}.json`;
    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
    log(`Results saved to ${resultFile}`);
    console.log(`\nDetailed results saved to: ${resultFile}`);
    
  } catch (error) {
    log(`Error: ${error.message}`);
    console.error(`Error: ${error.message}`);
  } finally {
    process.exit(0);
  }
};

// Command: Update user data
const updateUserData = async () => {
  try {
    log('Updating user data');
    
    // Load existing user data
    let userData = loadUserData();
    if (!userData) {
      log('No user data found. Creating new data.');
      console.log('No existing user data found. Creating new data.');
      userData = {
        personalInfo: {
          fullName: null,
          email: null,
          phone: null,
          location: null,
          dateOfBirth: null
        },
        education: [],
        experience: [],
        skills: [],
        languages: [],
        certifications: []
      };
    }
    
    console.log('\nUpdate User Information');
    console.log('----------------------');
    
    // Main menu loop
    let exit = false;
    while (!exit) {
      console.log('\nSelect information to update:');
      console.log('1. Personal Information');
      console.log('2. Education');
      console.log('3. Work Experience');
      console.log('4. Skills');
      console.log('5. Languages');
      console.log('6. Certifications');
      console.log('7. Job Site Credentials');
      console.log('8. Save and Exit');
      
      const choice = await prompt('\nEnter your choice (1-8): ');
      
      switch (choice) {
        case '1':
          console.log('\nUpdating Personal Information:');
          userData.personalInfo.fullName = await prompt(`Full Name [${userData.personalInfo.fullName || ''}]: `) || userData.personalInfo.fullName;
          userData.personalInfo.email = await prompt(`Email [${userData.personalInfo.email || ''}]: `) || userData.personalInfo.email;
          userData.personalInfo.phone = await prompt(`Phone [${userData.personalInfo.phone || ''}]: `) || userData.personalInfo.phone;
          userData.personalInfo.location = await prompt(`Location [${userData.personalInfo.location || ''}]: `) || userData.personalInfo.location;
          userData.personalInfo.dateOfBirth = await prompt(`Date of Birth [${userData.personalInfo.dateOfBirth || ''}]: `) || userData.personalInfo.dateOfBirth;
          break;
          
        case '2':
          console.log('\nUpdating Education:');
          if (userData.education.length > 0) {
            console.log('\nCurrent Education:');
            userData.education.forEach((edu, i) => {
              console.log(`${i+1}. ${edu.institution} - ${edu.degree} (${edu.dates})`);
            });
            console.log('a. Add new education entry');
            console.log('b. Remove an education entry');
            console.log('c. Go back');
            
            const eduChoice = await prompt('\nEnter your choice: ');
            
            if (eduChoice.toLowerCase() === 'a') {
              const education = {
                institution: await prompt('Institution Name: '),
                degree: await prompt('Degree: '),
                dates: await prompt('Dates (e.g., 2018-2022): '),
                gpa: await prompt('GPA (optional): ')
              };
              userData.education.push(education);
            } else if (eduChoice.toLowerCase() === 'b') {
              const index = parseInt(await prompt('Enter the number of the entry to remove: ')) - 1;
              if (index >= 0 && index < userData.education.length) {
                userData.education.splice(index, 1);
                console.log('Education entry removed.');
              } else {
                console.log('Invalid entry number.');
              }
            }
          } else {
            console.log('No education entries found.');
            const addEducation = await prompt('Add education entry? (y/n): ');
            if (addEducation.toLowerCase() === 'y') {
              const education = {
                institution: await prompt('Institution Name: '),
                degree: await prompt('Degree: '),
                dates: await prompt('Dates (e.g., 2018-2022): '),
                gpa: await prompt('GPA (optional): ')
              };
              userData.education.push(education);
            }
          }
          break;
          
        case '3':
          console.log('\nUpdating Work Experience:');
          if (userData.experience.length > 0) {
            console.log('\nCurrent Work Experience:');
            userData.experience.forEach((exp, i) => {
              console.log(`${i+1}. ${exp.company} - ${exp.title} (${exp.dates})`);
            });
            console.log('a. Add new experience entry');
            console.log('b. Remove an experience entry');
            console.log('c. Go back');
            
            const expChoice = await prompt('\nEnter your choice: ');
            
            if (expChoice.toLowerCase() === 'a') {
              const experience = {
                company: await prompt('Company Name: '),
                title: await prompt('Job Title: '),
                dates: await prompt('Dates (e.g., 2018-2022): '),
                description: await prompt('Job Description: ')
              };
              userData.experience.push(experience);
            } else if (expChoice.toLowerCase() === 'b') {
              const index = parseInt(await prompt('Enter the number of the entry to remove: ')) - 1;
              if (index >= 0 && index < userData.experience.length) {
                userData.experience.splice(index, 1);
                console.log('Experience entry removed.');
              } else {
                console.log('Invalid entry number.');
              }
            }
          } else {
            console.log('No work experience entries found.');
            const addExperience = await prompt('Add work experience entry? (y/n): ');
            if (addExperience.toLowerCase() === 'y') {
              const experience = {
                company: await prompt('Company Name: '),
                title: await prompt('Job Title: '),
                dates: await prompt('Dates (e.g., 2018-2022): '),
                description: await prompt('Job Description: ')
              };
              userData.experience.push(experience);
            }
          }
          break;
          
        case '4':
          console.log('\nUpdating Skills:');
          if (userData.skills.length > 0) {
            console.log('\nCurrent Skills:');
            console.log(userData.skills.join(', '));
          } else {
            console.log('No skills found.');
          }
          const updateSkills = await prompt('Update skills? (y/n): ');
          if (updateSkills.toLowerCase() === 'y') {
            const skillsInput = await prompt('Enter skills (comma-separated): ');
            userData.skills = skillsInput.split(',').map(skill => skill.trim());
          }
          break;
          
        case '5':
          console.log('\nUpdating Languages:');
          if (userData.languages.length > 0) {
            console.log('\nCurrent Languages:');
            userData.languages.forEach((lang, i) => {
              console.log(`${i+1}. ${lang.language} - ${lang.proficiency}`);
            });
            console.log('a. Add new language');
            console.log('b. Remove a language');
            console.log('c. Go back');
            
            const langChoice = await prompt('\nEnter your choice: ');
            
            if (langChoice.toLowerCase() === 'a') {
              const language = {
                language: await prompt('Language: '),
                proficiency: await prompt('Proficiency Level: ')
              };
              userData.languages.push(language);
            } else if (langChoice.toLowerCase() === 'b') {
              const index = parseInt(await prompt('Enter the number of the language to remove: ')) - 1;
              if (index >= 0 && index < userData.languages.length) {
                userData.languages.splice(index, 1);
                console.log('Language removed.');
              } else {
                console.log('Invalid language number.');
              }
            }
          } else {
            console.log('No languages found.');
            const addLanguage = await prompt('Add language? (y/n): ');
            if (addLanguage.toLowerCase() === 'y') {
              const language = {
                language: await prompt('Language: '),
                proficiency: await prompt('Proficiency Level: ')
              };
              userData.languages.push(language);
            }
          }
          break;
          
        case '6':
          console.log('\nUpdating Certifications:');
          if (userData.certifications.length > 0) {
            console.log('\nCurrent Certifications:');
            userData.certifications.forEach((cert, i) => {
              console.log(`${i+1}. ${cert.name} (${cert.date || 'No date'}) - ${cert.issuer || 'No issuer'}`);
            });
            console.log('a. Add new certification');
            console.log('b. Remove a certification');
            console.log('c. Go back');
            
            const certChoice = await prompt('\nEnter your choice: ');
            
            if (certChoice.toLowerCase() === 'a') {
              const certification = {
                name: await prompt('Certification Name: '),
                date: await prompt('Date (optional): '),
                issuer: await prompt('Issuer (optional): ')
              };
              userData.certifications.push(certification);
            } else if (certChoice.toLowerCase() === 'b') {
              const index = parseInt(await prompt('Enter the number of the certification to remove: ')) - 1;
              if (index >= 0 && index < userData.certifications.length) {
                userData.certifications.splice(index, 1);
                console.log('Certification removed.');
              } else {
                console.log('Invalid certification number.');
              }
            }
          } else {
            console.log('No certifications found.');
            const addCertification = await prompt('Add certification? (y/n): ');
            if (addCertification.toLowerCase() === 'y') {
              const certification = {
                name: await prompt('Certification Name: '),
                date: await prompt('Date (optional): '),
                issuer: await prompt('Issuer (optional): ')
              };
              userData.certifications.push(certification);
            }
          }
          break;
          
        case '7':
          console.log('\nUpdating Job Site Credentials:');
          console.log('1. LinkedIn');
          console.log('2. Indeed');
          console.log('3. Glassdoor');
          console.log('4. Go back');
          
          const credChoice = await prompt('\nEnter your choice (1-4): ');
          
          switch (credChoice) {
            case '1':
              if (!userData.linkedinCredentials) {
                userData.linkedinCredentials = {};
              }
              userData.linkedinCredentials.username = await prompt(`LinkedIn Email [${userData.linkedinCredentials.username || ''}]: `) || userData.linkedinCredentials.username;
              userData.linkedinCredentials.password = await prompt('LinkedIn Password: ');
              break;
              
            case '2':
              if (!userData.indeedCredentials) {
                userData.indeedCredentials = {};
              }
              userData.indeedCredentials.username = await prompt(`Indeed Email [${userData.indeedCredentials.username || ''}]: `) || userData.indeedCredentials.username;
              userData.indeedCredentials.password = await prompt('Indeed Password: ');
              break;
              
            case '3':
              if (!userData.glassdoorCredentials) {
                userData.glassdoorCredentials = {};
              }
              userData.glassdoorCredentials.username = await prompt(`Glassdoor Email [${userData.glassdoorCredentials.username || ''}]: `) || userData.glassdoorCredentials.username;
              userData.glassdoorCredentials.password = await prompt('Glassdoor Password: ');
              break;
          }
          break;
          
        case '8':
          saveUserData(userData);
          log('User data updated and saved.');
          console.log('\nUser data updated and saved successfully!');
          exit = true;
          break;
          
        default:
          console.log('Invalid choice. Please try again.');
      }
    }
  } catch (error) {
    log(`Error: ${error.message}`);
    console.error(`Error: ${error.message}`);
  } finally {
    rl.close();
  }
};

// Command: Generate Chrome Extension
const generateExtension = async () => {
  try {
    log('Generating Chrome extension');
    
    // Create extension directory
    ensureDirectoryExists('extension');
    
    // Create manifest.json
    const manifest = {
      "manifest_version": 3,
      "name": "Job Application Assistant",
      "version": "1.0",
      "description": "Automates job application form filling",
      "action": {
        "default_popup": "popup.html",
        "default_icon": {
          "16": "icons/icon16.png",
          "48": "icons/icon48.png",
          "128": "icons/icon128.png"
        }
      },
      "permissions": [
        "activeTab",
        "storage",
        "scripting"
      ],
      "host_permissions": [
        "*://*/*"
      ],
      "content_scripts": [
        {
          "matches": ["*://*/*"],
          "js": ["content.js"]
        }
      ],
      "background": {
        "service_worker": "background.js"
      },
      "icons": {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    };
    
    fs.writeFileSync('extension/manifest.json', JSON.stringify(manifest, null, 2));
    
    // Create icons directory
    ensureDirectoryExists('extension/icons');
    
    // Create placeholder icons
    // In a real application, you would provide actual icon files
    log('Creating placeholder icons. Replace these with actual icons before using the extension.');
    
    const iconSizes = [16, 48, 128];
    for (const size of iconSizes) {
      // Creating a simple SVG icon
      const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#4285f4"/>
        <text x="50%" y="50%" font-family="Arial" font-size="${size/2}px" fill="white" text-anchor="middle" dominant-baseline="middle">JA</text>
      </svg>`;
      fs.writeFileSync(`extension/icons/icon${size}.png`, svg);
    }
    
    // Create popup.html
    const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Job Application Assistant</title>
  <style>
    body { width: 350px; font-family: Arial, sans-serif; padding: 10px; }
    .tab { display: none; }
    .tab.active { display: block; }
    .nav { display: flex; margin-bottom: 10px; }
    .nav-item { padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; }
    .nav-item.active { border-bottom: 2px solid #4285f4; }
    button { background: #4285f4; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
    button:hover { background: #3b78e7; }
    input, select, textarea { width: 100%; padding: 8px; margin: 5px 0 15px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    h3 { margin-top: 0; }
    .status { margin-top: 10px; padding: 10px; border-radius: 4px; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="nav">
    <div class="nav-item active" data-tab="profile">Profile</div>
    <div class="nav-item" data-tab="apply">Apply</div>
    <div class="nav-item" data-tab="settings">Settings</div>
  </div>
  
  <div class="tab active" id="profile">
    <h3>Your Profile</h3>
    <input type="file" id="resume-upload" accept=".pdf,.docx,.txt">
    <button id="parse-resume">Parse Resume</button>
    
    <div id="profile-details" style="margin-top: 15px; display: none;">
      <h4>Personal Information</h4>
      <label>Full Name</label>
      <input type="text" id="full-name">
      
      <label>Email</label>
      <input type="email" id="email">
      
      <label>Phone</label>
      <input type="tel" id="phone">
      
      <label>Location</label>
      <input type="text" id="location">
      
      <h4>Education</h4>
      <div id="education-list"></div>
      <button id="add-education">Add Education</button>
      
      <h4>Experience</h4>
      <div id="experience-list"></div>
      <button id="add-experience">Add Experience</button>
      
      <h4>Skills</h4>
      <textarea id="skills" rows="3"></textarea>
      
      <button id="save-profile">Save Profile</button>
    </div>
  </div>
  
  <div class="tab" id="apply">
    <h3>Apply to Job</h3>
    <p>Navigate to a job application page, then:</p>
    <button id="analyze-page">Analyze Page</button>
    <button id="auto-fill">Auto-Fill Application</button>
    
    <div id="status-message" class="status" style="display: none;"></div>
  </div>
  
  <div class="tab" id="settings">
    <h3>Settings</h3>
    
    <h4>Credentials</h4>
    <label>LinkedIn Email</label>
    <input type="email" id="linkedin-email">
    
    <label>LinkedIn Password</label>
    <input type="password" id="linkedin-password">
    
    <label>Indeed Email</label>
    <input type="email" id="indeed-email">
    
    <label>Indeed Password</label>
    <input type="password" id="indeed-password">
    
    <label>Glassdoor Email</label>
    <input type="email" id="glassdoor-email">
    
    <label>Glassdoor Password</label>
    <input type="password" id="glassdoor-password">
    
    <button id="save-settings">Save Settings</button>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>`;
    
    fs.writeFileSync('extension/popup.html', popupHtml);
    
    // Create popup.js
    const popupJs = `// Popup script
document.addEventListener('DOMContentLoaded', function() {
  // Tab navigation
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      // Remove active class from all tabs and nav items
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      navItems.forEach(nav => nav.classList.remove('active'));
      
      // Add active class to selected tab and nav item
      const tabName = this.getAttribute('data-tab');
      document.getElementById(tabName).classList.add('active');
      this.classList.add('active');
    });
  });
  
  // Load user data
  chrome.storage.local.get(['userData'], function(result) {
    if (result.userData) {
      populateProfile(result.userData);
      document.getElementById('profile-details').style.display = 'block';
    }
  });
  
  // Parse resume
  document.getElementById('parse-resume').addEventListener('click', function() {
    const fileInput = document.getElementById('resume-upload');
    if (fileInput.files.length === 0) {
      showStatus('Please select a resume file first', 'error');
      return;
    }
    
    const file = fileInput.files[0];
    
    // In a real extension, you would use a service worker to handle the file parsing
    // For this demo, we'll simulate parsing success
    setTimeout(() => {
      showStatus('Resume parsed successfully!', 'success');
      document.getElementById('profile-details').style.display = 'block';
      
      // Simulate some extracted data
      const demoData = {
        personalInfo: {
          fullName: 'John Doe',
          email: 'john.doe@example.com',
          phone: '(555) 123-4567',
          location: 'San Francisco, CA'
        },
        education: [
          {
            institution: 'University of California',
            degree: 'Bachelor of Science in Computer Science',
            dates: '2016-2020',
            gpa: '3.8'
          }
        ],
        experience: [
          {
            company: 'Tech Company Inc.',
            title: 'Software Engineer',
            dates: '2020-Present',
            description: 'Developing web applications using React and Node.js'
          }
        ],
        skills: ['JavaScript', 'React', 'Node.js', 'HTML', 'CSS']
      };
      
      populateProfile(demoData);
      chrome.storage.local.set({userData: demoData});
    }, 1500);
  });
  
  // Save profile
  document.getElementById('save-profile').addEventListener('click', function() {
    const userData = {
      personalInfo: {
        fullName: document.getElementById('full-name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        location: document.getElementById('location').value
      },
      education: getEducationData(),
      experience: getExperienceData(),
      skills: document.getElementById('skills').value.split(',').map(skill => skill.trim())
    };
    
    chrome.storage.local.set({userData: userData}, function() {
      showStatus('Profile saved successfully!', 'success');
    });
  });
  
  // Analyze page
  document.getElementById('analyze-page').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'analyzePage'}, function(response) {
        if (response && response.success) {
          showStatus('Page analyzed. Found ' + response.formFields + ' form fields.', 'success');
        } else {
          showStatus('Could not analyze page. Make sure you are on a job application page.', 'error');
        }
      });
    });
  });
  
  // Auto-fill application
  document.getElementById('auto-fill').addEventListener('click', function() {
    chrome.storage.local.get(['userData'], function(result) {
      if (!result.userData) {
        showStatus('Please parse your resume or fill in your profile first.', 'error');
        return;
      }
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'autoFill',
          userData: result.userData
        }, function(response) {
          if (response && response.success) {
            showStatus('Application form filled successfully!', 'success');
          } else {
            showStatus('Could not fill the application form.', 'error');
          }
        });
      });
    });
  });
  
  // Save settings
  document.getElementById('save-settings').addEventListener('click', function() {
    const credentials = {
      linkedin: {
        username: document.getElementById('linkedin-email').value,
        password: document.getElementById('linkedin-password').value
      },
      indeed: {
        username: document.getElementById('indeed-email').value,
        password: document.getElementById('indeed-password').value
      },
      glassdoor: {
        username: document.getElementById('glassdoor-email').value,
        password: document.getElementById('glassdoor-password').value
      }
    };
    
    chrome.storage.local.set({credentials: credentials}, function() {
      showStatus('Settings saved successfully!', 'success');
    });
  });
  
  // Load settings
  chrome.storage.local.get(['credentials'], function(result) {
    if (result.credentials) {
      const creds = result.credentials;
      if (creds.linkedin) {
        document.getElementById('linkedin-email').value = creds.linkedin.username || '';
        document.getElementById('linkedin-password').value = creds.linkedin.password || '';
      }
      if (creds.indeed) {
        document.getElementById('indeed-email').value = creds.indeed.username || '';
        document.getElementById('indeed-password').value = creds.indeed.password || '';
      }
      if (creds.glassdoor) {
        document.getElementById('glassdoor-email').value = creds.glassdoor.username || '';
        document.getElementById('glassdoor-password').value = creds.glassdoor.password || '';
      }
    }
  });
  
  // Helper functions
  function populateProfile(userData) {
    // Populate personal info
    document.getElementById('full-name').value = userData.personalInfo.fullName || '';
    document.getElementById('email').value = userData.personalInfo.email || '';
    document.getElementById('phone').value = userData.personalInfo.phone || '';
    document.getElementById('location').value = userData.personalInfo.location || '';
    
    // Populate education
    const educationList = document.getElementById('education-list');
    educationList.innerHTML = '';
    if (userData.education && userData.education.length > 0) {
      userData.education.forEach((edu, index) => {
        const eduElem = document.createElement('div');
        eduElem.innerHTML = \`
          <div style="margin-bottom: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <label>Institution</label>
            <input type="text" class="edu-institution" value="\${edu.institution || ''}">
            
            <label>Degree</label>
            <input type="text" class="edu-degree" value="\${edu.degree || ''}">
            
            <label>Dates</label>
            <input type="text" class="edu-dates" value="\${edu.dates || ''}">
            
            <label>GPA</label>
            <input type="text" class="edu-gpa" value="\${edu.gpa || ''}">
            
            <button class="remove-edu" data-index="\${index}">Remove</button>
          </div>
        \`;
        educationList.appendChild(eduElem);
      });
      
      // Add event listeners for remove buttons
      document.querySelectorAll('.remove-edu').forEach(button => {
        button.addEventListener('click', function() {
          const index = this.getAttribute('data-index');
          userData.education.splice(index, 1);
          chrome.storage.local.set({userData: userData});
          populateProfile(userData);
        });
      });
    }
    
    // Populate experience
    const experienceList = document.getElementById('experience-list');
    experienceList.innerHTML = '';
    if (userData.experience && userData.experience.length > 0) {
      userData.experience.forEach((exp, index) => {
        const expElem = document.createElement('div');
        expElem.innerHTML = \`
          <div style="margin-bottom: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <label>Company</label>
            <input type="text" class="exp-company" value="\${exp.company || ''}">
            
            <label>Title</label>
            <input type="text" class="exp-title" value="\${exp.title || ''}">
            
            <label>Dates</label>
            <input type="text" class="exp-dates" value="\${exp.dates || ''}">
            
            <label>Description</label>
            <textarea class="exp-description" rows="3">\${exp.description || ''}</textarea>
            
            <button class="remove-exp" data-index="\${index}">Remove</button>
          </div>
        \`;
        experienceList.appendChild(expElem);
      });
      
      // Add event listeners for remove buttons
      document.querySelectorAll('.remove-exp').forEach(button => {
        button.addEventListener('click', function() {
          const index = this.getAttribute('data-index');
          userData.experience.splice(index, 1);
          chrome.storage.local.set({userData: userData});
          populateProfile(userData);
        });
      });
    }
    
    // Populate skills
    document.getElementById('skills').value = userData.skills ? userData.skills.join(', ') : '';
  }
  
  function getEducationData() {
    const education = [];
    const institutions = document.querySelectorAll('.edu-institution');
    const degrees = document.querySelectorAll('.edu-degree');
    const dates = document.querySelectorAll('.edu-dates');
    const gpas = document.querySelectorAll('.edu-gpa');
    
    for (let i = 0; i < institutions.length; i++) {
      education.push({
        institution: institutions[i].value,
        degree: degrees[i].value,
        dates: dates[i].value,
        gpa: gpas[i].value
      });
    }
    
    return education;
  }
  
  function getExperienceData() {
    const experience = [];
    const companies = document.querySelectorAll('.exp-company');
    const titles = document.querySelectorAll('.exp-title');
    const dates = document.querySelectorAll('.exp-dates');
    const descriptions = document.querySelectorAll('.exp-description');
    
    for (let i = 0; i < companies.length; i++) {
      experience.push({
        company: companies[i].value,
        title: titles[i].value,
        dates: dates[i].value,
        description: descriptions[i].value
      });
    }
    
    return experience;
  }
  
  function showStatus(message, type) {
    const statusElem = document.getElementById('status-message');
    statusElem.textContent = message;
    statusElem.className = 'status ' + type;
    statusElem.style.display = 'block';
    
    setTimeout(() => {
      statusElem.style.display = 'none';
    }, 3000);
  }
  
  // Add education button
  document.getElementById('add-education').addEventListener('click', function() {
    chrome.storage.local.get(['userData'], function(result) {
      if (!result.userData) {
        result.userData = {
          personalInfo: {},
          education: [],
          experience: [],
          skills: []
        };
      }
      
      if (!result.userData.education) {
        result.userData.education = [];
      }
      
      result.userData.education.push({
        institution: '',
        degree: '',
        dates: '',
        gpa: ''
      });
      
      chrome.storage.local.set({userData: result.userData});
      populateProfile(result.userData);
    });
  });
  
  // Add experience button
  document.getElementById('add-experience').addEventListener('click', function() {
    chrome.storage.local.get(['userData'], function(result) {
      if (!result.userData) {
        result.userData = {
          personalInfo: {},
          education: [],
          experience: [],
          skills: []
        };
      }
      
      if (!result.userData.experience) {
        result.userData.experience = [];
      }
      
      result.userData.experience.push({
        company: '',
        title: '',
        dates: '',
        description: ''
      });
      
      chrome.storage.local.set({userData: result.userData});
      populateProfile(result.userData);
    });
  });
});`;
    
    fs.writeFileSync('extension/popup.js', popupJs);
    
    // Create content.js
    const contentJs = `// Content script that runs on job application pages

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'analyzePage') {
    const result = analyzePage();
    sendResponse(result);
  } else if (request.action === 'autoFill') {
    const result = autoFillApplication(request.userData);
    sendResponse(result);
  }
  return true; // Required for async response
});

// Analyze the page to identify form fields
function analyzePage() {
  try {
    // Find all form elements
    const forms = document.querySelectorAll('form');
    
    // If no forms found, look for input fields directly
    let formFields = 0;
    
    if (forms.length > 0) {
      // Count input fields in forms
      forms.forEach(form => {
        const inputs = form.querySelectorAll('input, select, textarea');
        formFields += inputs.length;
        
        // Mark form elements for easier identification
        inputs.forEach(input => {
          input.dataset.automationAnalyzed = 'true';
        });
      });
    } else {
      // Count input fields on the page
      const inputs = document.querySelectorAll('input, select, textarea');
      formFields = inputs.length;
      
      // Mark input elements for easier identification
      inputs.forEach(input => {
        input.dataset.automationAnalyzed = 'true';
      });
    }
    
    // Create mapping of form fields for later use
    createFormMappings();
    
    return {
      success: true,
      formFields: formFields
    };
  } catch (error) {
    console.error('Error analyzing page:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Create mappings between form fields and user data
function createFormMappings() {
  const fieldMappings = {};
  
  // Find all input elements
  const inputs = document.querySelectorAll('input, select, textarea');
  
  inputs.forEach(input => {
    // Store original background color
    input.dataset.originalBg = input.style.backgroundColor;
    
    // Try to identify the field type based on attributes
    const name = input.name ? input.name.toLowerCase() : '';
    const id = input.id ? input.id.toLowerCase() : '';
    const placeholder = input.placeholder ? input.placeholder.toLowerCase() : '';
    const label = findLabelForInput(input);
    
    // Check for common field types
    if (
      name.includes('name') || id.includes('name') || 
      placeholder.includes('name') || (label && label.includes('name'))
    ) {
      if (
        name.includes('first') || id.includes('first') || 
        placeholder.includes('first') || (label && label.includes('first'))
      ) {
        input.dataset.fieldType = 'firstName';
      } else if (
        name.includes('last') || id.includes('last') || 
        placeholder.includes('last') || (label && label.includes('last'))
      ) {
        input.dataset.fieldType = 'lastName';
      } else {
        input.dataset.fieldType = 'fullName';
      }
    } else if (
      name.includes('email') || id.includes('email') || 
      placeholder.includes('email') || (label && label.includes('email')) ||
      input.type === 'email'
    ) {
      input.dataset.fieldType = 'email';
    } else if (
      name.includes('phone') || id.includes('phone') || 
      placeholder.includes('phone') || (label && label.includes('phone')) ||
      input.type === 'tel'
    ) {
      input.dataset.fieldType = 'phone';
    } else if (
      name.includes('address') || id.includes('address') || 
      placeholder.includes('address') || (label && label.includes('address'))
    ) {
      input.dataset.fieldType = 'address';
    } else if (
      name.includes('city') || id.includes('city') || 
      placeholder.includes('city') || (label && label.includes('city'))
    ) {
      input.dataset.fieldType = 'city';
    } else if (
      name.includes('state') || id.includes('state') || 
      placeholder.includes('state') || (label && label.includes('state'))
    ) {
      input.dataset.fieldType = 'state';
    } else if (
      name.includes('zip') || id.includes('zip') || name.includes('postal') || 
      id.includes('postal') || placeholder.includes('zip') || 
      placeholder.includes('postal') || (label && (label.includes('zip') || label.includes('postal')))
    ) {
      input.dataset.fieldType = 'zip';
    } else if (
      name.includes('education') || id.includes('education') || 
      placeholder.includes('education') || (label && label.includes('education'))
    ) {
      input.dataset.fieldType = 'education';
    } else if (
      name.includes('experience') || id.includes('experience') || 
      placeholder.includes('experience') || (label && label.includes('experience'))
    ) {
      input.dataset.fieldType = 'experience';
    } else if (
      name.includes('skill') || id.includes('skill') || 
      placeholder.includes('skill') || (label && label.includes('skill'))
    ) {
      input.dataset.fieldType = 'skills';
    }
  });
  
  return fieldMappings;
}

// Find label text for an input element
function findLabelForInput(input) {
  // Check for label with 'for' attribute
  if (input.id) {
    const label = document.querySelector(\`label[for="\${input.id}"]\`);
    if (label) {
      return label.textContent.toLowerCase();
    }
  }
  
  // Check for parent label
  let parent = input.parentElement;
  while (parent && parent.tagName !== 'BODY') {
    if (parent.tagName === 'LABEL') {
      return parent.textContent.toLowerCase();
    }
    parent = parent.parentElement;
  }
  
  // Check for preceding label or text
  const previousElement = input.previousElementSibling;
  if (previousElement && (
      previousElement.tagName === 'LABEL' || 
      previousElement.tagName === 'SPAN' || 
      previousElement.tagName === 'DIV'
    )) {
    return previousElement.textContent.toLowerCase();
  }
  
  return null;
}

// Auto-fill the application form with user data
function autoFillApplication(userData) {
  try {
    // Get all input elements that were analyzed
    const inputs = document.querySelectorAll('[data-automation-analyzed="true"]');
    let filledFields = 0;
    
    inputs.forEach(input => {
      // Get the identified field type
      const fieldType = input.dataset.fieldType;
      
      if (fieldType) {
        let value = null;
        
        // Set value based on field type
        switch (fieldType) {
          case 'firstName':
            if (userData.personalInfo.fullName) {
              value = userData.personalInfo.fullName.split(' ')[0];
            }
            break;
          case 'lastName':
            if (userData.personalInfo.fullName) {
              const nameParts = userData.personalInfo.fullName.split(' ');
              value = nameParts[nameParts.length - 1];
            }
            break;
          case 'fullName':
            value = userData.personalInfo.fullName;
            break;
          case 'email':
            value = userData.personalInfo.email;
            break;
          case 'phone':
            value = userData.personalInfo.phone;
            break;
          case 'address':
            if (userData.personalInfo.location) {
              value = userData.personalInfo.location;
            }
            break;
          case 'education':
            if (userData.education && userData.education.length > 0) {
              // For textareas, include full education history
              if (input.tagName === 'TEXTAREA') {
                value = userData.education.map(edu => 
                  \`\${edu.institution}, \${edu.degree}, \${edu.dates}\`
                ).join('\\n');
              } else {
                // For input fields, just use the most recent education
                const mostRecent = userData.education[0];
                value = \`\${mostRecent.institution} - \${mostRecent.degree}\`;
              }
            }
            break;
          case 'experience':
            if (userData.experience && userData.experience.length > 0) {
              // For textareas, include full work history
              if (input.tagName === 'TEXTAREA') {
                value = userData.experience.map(exp => 
                  \`\${exp.company}, \${exp.title}, \${exp.dates}\\n\${exp.description}\`
                ).join('\\n\\n');
              } else {
                // For input fields, just use the most recent experience
                const mostRecent = userData.experience[0];
                value = \`\${mostRecent.company} - \${mostRecent.title}\`;
              }
            }
            break;
          case 'skills':
            if (userData.skills && userData.skills.length > 0) {
              value = userData.skills.join(', ');
            }
            break;
        }
        
        // Fill the field if we have a value
        if (value) {
          // Handle different input types
          if (input.tagName === 'SELECT') {
            // Try to find an option that matches our value
            const options = Array.from(input.options);
            const option = options.find(opt => 
              opt.text.toLowerCase().includes(value.toLowerCase())
            );
            
            if (option) {
              input.value = option.value;
              highlightField(input, true);
              filledFields++;
            }
          } else {
            // Regular input or textarea
            input.value = value;
            highlightField(input, true);
            filledFields++;
          }
        }
      }
    });
    
    // Look for file upload fields for resume
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      // Highlight file inputs that likely need manual intervention
      const name = input.name ? input.name.toLowerCase() : '';
      const id = input.id ? input.id.toLowerCase() : '';
      
      if (
        name.includes('resume') || id.includes('resume') ||
        name.includes('cv') || id.includes('cv') ||
        name.includes('document') || id.includes('document')
      ) {
        highlightField(input, false);
      }
    });
    
    return {
      success: true,
      filledFields: filledFields
    };
  } catch (error) {
    console.error('Error auto-filling application:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Highlight a field to show it's been filled
function highlightField(field, success) {
  // Save original background color if not already saved
  if (!field.dataset.originalBg) {
    field.dataset.originalBg = field.style.backgroundColor;
  }
  
  // Set highlight color based on success
  field.style.backgroundColor = success ? '#d4edda' : '#fff3cd';
  field.style.borderColor = success ? '#c3e6cb' : '#ffeeba';
  
  // Restore original background after 3 seconds
  setTimeout(() => {
    field.style.backgroundColor = field.dataset.originalBg;
    field.style.borderColor = '';
  }, 3000);
}`;
    
    fs.writeFileSync('extension/content.js', contentJs);
    
    // Create background.js
    const backgroundJs = `// Background service worker for the extension

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Job Application Assistant installed');
});

// Context menu for analyzing the current page
chrome.contextMenus.create({
  id: 'analyzePage',
  title: 'Analyze Job Application Form',
  contexts: ['page']
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzePage') {
    chrome.tabs.sendMessage(tab.id, { action: 'analyzePage' });
  }
});`;
    
    fs.writeFileSync('extension/background.js', backgroundJs);
    
    console.log('Chrome extension generated successfully!');
    console.log('To install the extension:');
    console.log('1. Open Chrome and navigate to chrome://extensions');
    console.log('2. Enable "Developer mode" by toggling the switch in the top-right corner');
    console.log('3. Click "Load unpacked" and select the "extension" directory created by this script');
    console.log('4. The Job Application Assistant extension should now be installed and visible in your browser toolbar');
    
    log('Chrome extension generated successfully');
  } catch (error) {
    log(`Error generating Chrome extension: ${error.message}`);
    console.error(`Error: ${error.message}`);
  }
};

// Set up command line interface
program
  .name('job-application-automation')
  .description('CLI tool for automating job applications')
  .version('1.0.0');

// Parse resume command
program
  .command('parse-resume')
  .description('Parse a resume file to extract information')
  .argument('<file-path>', 'Path to the resume file (PDF, DOCX, or TXT)')
  .action(parseResume);

// Apply to job command
program
  .command('apply')
  .description('Apply to a job using the stored user information')
  .argument('<url>', 'URL of the job posting to apply for')
  .action(applyToJob);

// Batch apply command
program
  .command('batch-apply')
  .description('Apply to multiple jobs listed in a text file')
  .argument('<file-path>', 'Path to a text file containing job URLs (one per line)')
  .action(batchApply);

// Update user data command
program
  .command('update-user-data')
  .description('Update your personal information, education, experience, and skills')
  .action(updateUserData);

// Generate extension command
program
  .command('generate-extension')
  .description('Generate a Chrome extension for browser-based job application assistance')
  .action(generateExtension);

// Parse command line arguments
program.parse(process.argv);

// If no arguments are provided, show help
if (process.argv.length <= 2) {
  program.help();
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  log(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

program
  .command('import-cv-json')
  .description('Import a CV from a JSON file in the application-specific format')
  .argument('<file-path>', 'Path to the JSON file containing the CV data')
  .action(importCVJsonCommand);

program
  .command('generate-template')
  .description('Generate an empty CV JSON template')
  .option('-o, --output <file-path>', 'Output file path', 'cv-template.json')
  .action((options) => {
    const templateJson = {
      // Template contents (same as the template artifact)
      "resume_path": "",
      "cover_letter_path": "",
      "transcript_path": "",
      // ... rest of template
    };
    
    fs.writeFileSync(options.output, JSON.stringify(templateJson, null, 2));
    console.log(`Template CV JSON generated at: ${options.output}`);
  });