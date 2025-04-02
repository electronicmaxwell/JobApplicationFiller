const fs = require('fs');
const path = require('path');

/**
 * Imports a CV JSON file into the job application system
 * @param {string} jsonFilePath - Path to the CV JSON file
 * @returns {Promise<Object>} - The processed user data
 */
async function importCVJson(jsonFilePath) {
  try {
    // Read the JSON file
    console.log(`Reading CV JSON from: ${jsonFilePath}`);
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    const cvData = JSON.parse(fileContent);
    
    // Convert the CV data to the application's user data format
    const userData = convertToUserData(cvData);
    
    // Create a backup of existing user data if it exists
    const userDataPath = 'data/user_data.json';
    if (fs.existsSync(userDataPath)) {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = `data/user_data_backup_${timestamp}.json`;
      fs.copyFileSync(userDataPath, backupPath);
      console.log(`Created backup of existing user data at: ${backupPath}`);
    }
    
    // Ensure the data directory exists
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data', { recursive: true });
    }
    
    // Save the converted data to the user_data.json file
    fs.writeFileSync(userDataPath, JSON.stringify(userData, null, 2));
    console.log(`CV data saved to: ${userDataPath}`);
    
    return {
      userData: userData,
      missingFields: []
    };
  } catch (error) {
    console.error(`Error importing CV JSON: ${error.message}`);
    throw error;
  }
}

/**
 * Converts the CV JSON format to the application's user data format
 * @param {Object} cvData - The CV data in the input format
 * @returns {Object} - The user data in the application's format
 */
function convertToUserData(cvData) {
  // Create the user data structure
  const userData = {
    personalInfo: {
      fullName: `${cvData.first_name} ${cvData.last_name}`,
      email: cvData.email,
      phone: cvData.phone,
      location: generateLocation(cvData),
      dateOfBirth: null
    },
    education: [],
    experience: [],
    skills: cvData.skills || [],
    languages: [],
    certifications: cvData.certifications || [],
    workAuthorizationStatus: cvData.citizenship,
    socialMediaProfiles: {}
  };
  
  // Add LinkedIn if available
  if (cvData.linkedin) {
    userData.socialMediaProfiles.linkedin = cvData.linkedin;
  }
  
  // Convert education data
  if (cvData.education && Array.isArray(cvData.education)) {
    userData.education = cvData.education;
  } else if (cvData.university) {
    // Create education entry from university fields
    userData.education.push({
      institution: cvData.university,
      degree: `${cvData.degree} in ${cvData.discipline}`,
      dates: `${formatDate(cvData.undergrad_start_date)} to ${formatDate(cvData.undergrad_end_date)}`,
      gpa: cvData.degree_score
    });
    
    // Add school education if available
    if (cvData.school_name) {
      userData.education.push({
        institution: cvData.school_name,
        degree: cvData.school_system,
        dates: `${formatDate(cvData.school_start_date)} to ${formatDate(cvData.school_end_date)}`,
        gpa: cvData.school_grades
      });
    }
  }
  
  // Convert experience data
  for (let i = 1; i <= 5; i++) {
    const employerKey = i === 1 ? 'employer_name' : `employer_name${i}`;
    const titleKey = i === 1 ? 'role_title' : `role_title${i}`;
    const startDateKey = i === 1 ? 'start_date' : `start_date${i}`;
    const endDateKey = i === 1 ? 'end_date' : `end_date${i}`;
    const countryKey = i === 1 ? 'country_of_employer' : `country_of_employer${i}`;
    
    if (cvData[employerKey] && cvData[titleKey]) {
      userData.experience.push({
        company: cvData[employerKey],
        title: cvData[titleKey],
        dates: `${formatDisplayDate(cvData[startDateKey])} to ${formatDisplayDate(cvData[endDateKey])}`,
        description: `Worked as ${cvData[titleKey]} at ${cvData[employerKey]} in ${cvData[countryKey]}`
      });
    }
  }
  
  // Add languages
  if (cvData.native_language) {
    userData.languages.push({
      language: cvData.native_language,
      proficiency: 'Native'
    });
  }
  
  if (cvData.fluent_language) {
    userData.languages.push({
      language: cvData.fluent_language,
      proficiency: 'Fluent'
    });
  }
  
  if (cvData.professional_language && cvData.professional_language !== 'None') {
    userData.languages.push({
      language: cvData.professional_language,
      proficiency: 'Professional'
    });
  }
  
  // Add credentials placeholders
  userData.linkedinCredentials = {
    username: cvData.email,
    password: cvData.password || 'placeholder'
  };
  
  userData.indeedCredentials = {
    username: cvData.email,
    password: cvData.password || 'placeholder'
  };
  
  userData.glassdoorCredentials = {
    username: cvData.email,
    password: cvData.password || 'placeholder'
  };
  
  return userData;
}

/**
 * Generates a location string from address components
 * @param {Object} cvData - The CV data
 * @returns {string} - The formatted location
 */
function generateLocation(cvData) {
  const components = [];
  
  if (cvData.address1) components.push(cvData.address1);
  if (cvData.address2) components.push(cvData.address2);
  if (cvData.city) components.push(cvData.city);
  if (cvData.county) components.push(cvData.county);
  if (cvData.postcode) components.push(cvData.postcode);
  if (cvData.residence) components.push(cvData.residence);
  
  return components.join(', ');
}

/**
 * Formats a date string for display (handling different input formats)
 * @param {string} dateStr - The date string in various formats
 * @returns {string} - Formatted date string
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  
  // Check for DD/MM/YYYY format
  if (dateStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
    const [day, month, year] = dateStr.split('/');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[parseInt(month) - 1]} ${year}`;
  }
  
  // Check for YYYY-MM format
  if (dateStr.match(/\d{4}-\d{2}/)) {
    const [year, month] = dateStr.split('-');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[parseInt(month) - 1]} ${year}`;
  }
  
  return dateStr;
}

/**
 * Formats a date string (handling different input formats)
 * @param {string} dateStr - The date string in various formats
 * @returns {string} - Formatted date string
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // No transformation needed for now, return as is
  return dateStr;
}

// CLI command wrapper
async function importCVJsonCommand(jsonFilePath) {
  try {
    await importCVJson(jsonFilePath);
    console.log('\nCV JSON import completed successfully!');
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

module.exports = {
  importCVJson,
  convertToUserData,
  importCVJsonCommand
};